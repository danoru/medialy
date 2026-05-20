import type { User } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * Who is acting?
 *
 * Anonymous browsing is supported: most read paths return data even when
 * there is no session. Mutations and personal pages must use
 * `requireUserId()` / `requireUser()`, which redirect to `/signin`.
 *
 * Resolution order in `getCurrentUser()`:
 *   1. Real session → the signed-in user from the DB.
 *   2. No session → `null`. The catalog still renders; user-scoped joins
 *      gracefully return defaults via `userMediaInclude(null)` /
 *      `mergeUserMedia`.
 *
 * `auth()` is imported dynamically so `next-auth` (and its `next/server` dep)
 * stays out of the Vitest module graph through every `lib/*` file that
 * imports this module.
 */

export const DEFAULT_USER_ID = "usr_default";

export async function getCurrentUser(): Promise<User | null> {
  let sessionUserId: string | null = null;
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    sessionUserId = session?.user?.id ?? null;
  } catch {
    sessionUserId = null;
  }

  if (!sessionUserId) return null;

  try {
    const user = await prisma.user.findUnique({ where: { id: sessionUserId } });
    return user;
  } catch {
    return null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/**
 * Gating helper for pages and server actions that require a signed-in user.
 * Redirects to `/signin?callbackUrl=<current>` if there is no session.
 * Pass `callbackUrl` to control where the user lands after sign-in.
 */
export async function requireUser(callbackUrl?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const target = callbackUrl
      ? `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/signin";
    redirect(target);
  }
  return user;
}

export async function requireUserId(callbackUrl?: string): Promise<string> {
  const user = await requireUser(callbackUrl);
  return user.id;
}

export function userInitial(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || "U";
}
