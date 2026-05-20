"use server";

import { signIn, signOut } from "@/lib/auth";

/**
 * Sign-out action invoked from a client component (e.g. the AppShell user
 * menu) via the `form action={...}` prop. Drops the session cookie and
 * sends the visitor back to the home page where the chrome will render the
 * anonymous "Sign In" entry.
 */
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/**
 * Sign-in action — primarily exists so the chrome can offer a Google flow
 * from a single button without bouncing through `/signin`. The `/signin`
 * page still exists as the canonical entry / redirect target.
 */
export async function signInAction(callbackUrl?: string) {
  await signIn("google", { redirectTo: callbackUrl ?? "/" });
}
