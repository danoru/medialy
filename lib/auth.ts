import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

// Inlined (not imported from `lib/user.ts`) to avoid a circular import — that
// module imports `auth` from here.
const DEFAULT_USER_ID = "usr_default";

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
 * First-sign-in claim: if the seeded `usr_default` row exists with no email,
 * `events.createUser` re-homes the freshly-minted Auth.js user onto it
 * (moving Account rows and copying email / name / image, then deleting the
 * new user). The JWT cookie was issued with `sub = <the new user id>` that
 * we just deleted, so the `jwt` callback re-resolves the correct userId via
 * the Account table so subsequent requests see the post-claim state.
 */

const isProd = process.env.NODE_ENV === "production";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
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
  events: {
    async createUser({ user }) {
      if (!user.id || !user.email) return;

      const seeded = await prisma.user.findUnique({
        where: { id: DEFAULT_USER_ID },
        select: { id: true, email: true },
      });
      if (!seeded || seeded.email) return;
      if (user.id === DEFAULT_USER_ID) return;

      // Move OAuth account rows under usr_default, copy profile info onto
      // usr_default, then drop the freshly-minted user row. Wrapped in a
      // transaction so we don't strand orphan rows on failure.
      await prisma.$transaction(async (tx) => {
        await tx.account.updateMany({
          where: { userId: user.id },
          data: { userId: DEFAULT_USER_ID },
        });
        await tx.user.update({
          where: { id: DEFAULT_USER_ID },
          data: {
            email: user.email,
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          },
        });
        await tx.user.delete({ where: { id: user.id } });
      });
    },
  },
  callbacks: {
    async jwt({ token, account, trigger }) {
      // On sign-in the createUser event may have re-homed the new user onto
      // usr_default; the JWT was minted with the now-deleted user id as
      // `sub`. Re-resolve from the Account table so subsequent requests see
      // the correct id.
      if (
        (trigger === "signIn" || trigger === "signUp") &&
        account?.provider &&
        account.providerAccountId
      ) {
        const linked = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          select: { userId: true },
        });
        if (linked) token.sub = linked.userId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  debug: !isProd,
});
