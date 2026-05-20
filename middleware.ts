// Route guard: every page except the sign-in page and the Auth.js endpoints
// requires a session. Static assets (`_next/*`, favicons, images) are excluded
// via the matcher below so they don't pay the auth roundtrip.
//
// Note: Auth.js v5's middleware export reads the session cookie only — it does
// NOT touch the DB — so this is cheap. Database lookups still happen inside
// server components via `auth()` / `getCurrentUser()`.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = Boolean(req.auth);

  // Public surfaces.
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/signin" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (!isAuthed) {
    const signInUrl = new URL("/signin", req.nextUrl);
    // Preserve where the user was trying to go so we can bounce them back
    // after sign-in.
    if (pathname !== "/") {
      signInUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Match everything except Next internals and obvious static files. Auth.js's
  // own /api/auth/* routes are handled by the early-return above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
