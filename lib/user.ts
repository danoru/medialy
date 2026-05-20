import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// `auth()` is imported dynamically inside `getCurrentUser()` rather than at
// the top of the module. The static import would pull `next-auth` (and its
// `next/server` dependency) into the test environment's module graph
// transitively via every `lib/*` file that imports this module — Vitest can't
// resolve `next/server` from inside next-auth's nested node_modules, so the
// tests fail before they run. Dynamic import keeps the test graph clean
// while still working at runtime.

/**
 * Single source of truth for "who is acting". Auth.js (NextAuth v5) provides
 * the session via `auth()`; everything user-scoped goes through here so the
 * rest of the app never needs to thread session plumbing itself.
 *
 * Resolution order:
 *  1. Real session — return the signed-in user from the DB.
 *  2. No session and we're running outside a request (build-time prerender
 *     of `/_not-found`, or a Vitest test that imports something touching this
 *     module) — return the seeded `usr_default` row if it exists, else the
 *     in-memory `FALLBACK_USER`. This must never throw, since `RootLayout`
 *     calls it and an exception breaks every static page.
 *
 * Middleware (`middleware.ts`) already redirects unauthenticated requests to
 * `/signin`, so within normal request handling step 1 is always what happens.
 * The fallback exists solely for the no-request contexts.
 */

export const DEFAULT_USER_ID = "usr_default";

const FALLBACK_USER: User = {
  id: DEFAULT_USER_ID,
  displayName: "You",
  name: null,
  email: null,
  emailVerified: null,
  image: null,
  avatarColor: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export async function getCurrentUser(): Promise<User> {
  // `auth()` can throw if invoked outside a request context (e.g. during
  // static prerender or in a test); guard it.
  let sessionUserId: string | null = null;
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    sessionUserId = session?.user?.id ?? null;
  } catch {
    sessionUserId = null;
  }

  try {
    if (sessionUserId) {
      const user = await prisma.user.findUnique({
        where: { id: sessionUserId },
      });
      if (user) return user;
    }

    // No session (or session.user.id refers to a deleted row): fall back to
    // the seeded default so prerender / tests stay alive.
    const fallback = await prisma.user.findUnique({
      where: { id: DEFAULT_USER_ID },
    });
    return fallback ?? FALLBACK_USER;
  } catch {
    return FALLBACK_USER;
  }
}

export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.id;
}

export function userInitial(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || "U";
}
