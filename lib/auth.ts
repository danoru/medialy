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
 * - Database sessions via the Prisma adapter (Account / Session / User tables).
 * - Google as the sole provider — the local-first single-user history means
 *   the only person signing in is the owner of the install.
 * - `signIn` event re-homes the very first Google sign-in onto the seeded
 *   `usr_default` row if it doesn't yet have an email, so the existing media
 *   library (which is owned by `usr_default`) is preserved rather than
 *   stranded under a new user id. Subsequent sign-ins take the normal adapter
 *   path and create / look up their own `User` row.
 * - `session` callback exposes `session.user.id` to server components, where
 *   `lib/user.ts` reads it.
 */

const isProd = process.env.NODE_ENV === "production";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
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
      // First sign-in claim: if the seeded `usr_default` row exists and has no
      // linked email yet, merge the newly-created Auth.js user into it. We
      // can't actually "rename" the new user's id back to usr_default (the
      // adapter has already inserted the Account row pointing at the new id),
      // so we instead delete the freshly-minted row and move its Account/
      // Session rows under usr_default. Done in a transaction so we don't
      // strand orphaned rows on failure.
      if (!user.id || !user.email) return;

      const seeded = await prisma.user.findUnique({
        where: { id: DEFAULT_USER_ID },
        select: { id: true, email: true },
      });
      if (!seeded || seeded.email) return;
      if (user.id === DEFAULT_USER_ID) return;

      await prisma.$transaction(async (tx) => {
        await tx.account.updateMany({
          where: { userId: user.id },
          data: { userId: DEFAULT_USER_ID },
        });
        await tx.session.updateMany({
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
    async session({ session, user }) {
      // With the database strategy, Auth.js passes the resolved DB user as
      // `user`. Re-expose `id` on session.user so server code can read it.
      if (session.user && user?.id) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  debug: !isProd,
});
