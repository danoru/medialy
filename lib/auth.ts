import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter,
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async session({ session, token }) {
      // JWTs outlive the User row: if a user is deleted (or re-homed) the
      // signed cookie still validates, and a naive `session.user.id = sub`
      // would hand callers a ghost id pointing at nothing. Verify the row
      // still exists before populating; otherwise leave `session.user`
      // undefined so consumers (signin page, requireUser) treat it as
      // unauthenticated.
      if (!token.sub) return session;
      const exists = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { id: true },
      });
      if (!exists) {
        session.user = undefined as unknown as typeof session.user;
        return session;
      }
      if (session.user) session.user.id = token.sub;
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  debug: !isProd,
});
