import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

/**
 * Auth.js (NextAuth v5) wiring.
 *
 * Anonymous browsing is allowed at the page level, so there is no proxy / no
 * `middleware.ts` — gating happens via `requireUserId()` in server actions
 * and inside the few personal pages that need a session. With no Edge-runtime
 * consumer, this single config file is the whole story (no `auth.config.ts`
 * split needed).
 *
 * Session strategy is JWT, not database: it sidesteps any future Edge size
 * issues and removes a DB roundtrip on every request. Account / User /
 * VerificationToken still go through the Prisma adapter; the `Session` table
 * is left in place but unused — flipping back to `strategy: "database"` is a
 * one-liner if we ever decide we want server-side session revocation.
 *
 * Note on `usr_default`: the seeded single-user data lives under `usr_default`.
 * The first real OAuth account was re-homed onto that row by a one-off script
 * (see commit history). New OAuth users from here on out get a fresh `User`
 * row and an empty `UserMedia` set — no further migration needed.
 */

const isProd = process.env.NODE_ENV === "production";

/**
 * Wrap the stock PrismaAdapter so `createUser` fills in our required
 * `displayName` column — Auth.js itself only passes `name`, `email`, `image`,
 * `emailVerified`, so an unwrapped adapter would hit a NOT NULL violation
 * and surface to the user as a misleading `/api/auth/error?error=Configuration`.
 * We derive a display name from the Google profile, falling back to the local
 * part of the email and finally a literal "User" so the insert always
 * succeeds.
 */
const baseAdapter = PrismaAdapter(prisma) as Adapter;
const adapter: Adapter = {
  ...baseAdapter,
  async createUser(data) {
    const displayName =
      data.name?.trim() || data.email?.split("@")[0] || "User";
    const created = await prisma.user.create({
      data: {
        name: data.name ?? null,
        email: data.email,
        image: data.image ?? null,
        emailVerified: data.emailVerified ?? null,
        displayName,
      },
    });
    return created as unknown as AdapterUser;
  },
};

/**
 * DEV ONLY. A password-less sign-in that mints a JWT session for an existing
 * user, so local signed-in flows can be exercised without going through Google.
 *
 * Never shipped: it's only pushed into `providers` when NODE_ENV !==
 * "production", and `authorize` itself hard-refuses in production as a second
 * guard. It creates no users and grants no admin it didn't already find on the
 * row — it only re-attaches to a user that already exists (defaulting to the
 * seeded `usr_default`). An optional `email` input picks a different user.
 */
const devLoginProvider = Credentials({
  id: "dev-login",
  name: "Dev Login",
  credentials: { email: { label: "Email (optional)", type: "text" } },
  async authorize(credentials) {
    if (process.env.NODE_ENV === "production") return null;
    const email =
      typeof credentials?.email === "string" ? credentials.email.trim() : "";
    const user = email
      ? await prisma.user.findFirst({ where: { email } })
      : ((await prisma.user.findUnique({ where: { id: "usr_default" } })) ??
        (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })));
    if (!user) return null;
    return { id: user.id, name: user.displayName, email: user.email };
  },
});

const providers: Provider[] = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
];
if (!isProd) providers.push(devLoginProvider);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter,
  session: { strategy: "jwt" },
  trustHost: true,
  providers,
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async session({ session, token }) {
      // Populate the id from the token and stop — no DB read here.
      //
      // JWTs outlive the User row (a deleted/re-homed user still has a valid
      // cookie), so `session.user.id` can be a ghost id. We deliberately do
      // NOT verify existence in this callback anymore: it ran a `user.findUnique`
      // on every `auth()` call, and `auth()` is called inside `getCurrentUser`
      // — which then does its own full-row `findUnique` and returns null for a
      // missing row. That second read is the single source of truth (and stays
      // fresh for `isAdmin` etc.), so the existence check here was pure
      // duplication. The only other direct `auth()` caller, the sign-in page,
      // resolves through `getCurrentUser` for the same guard.
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  debug: !isProd,
});
