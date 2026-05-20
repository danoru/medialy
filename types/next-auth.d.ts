// Augments NextAuth's `Session` so `session.user.id` is part of the public
// type, mirroring what the `session` callback in `lib/auth.ts` exposes at
// runtime. Without this, every reader has to `as` the id.
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
