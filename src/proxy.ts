import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic auth gate only. Proxy runs before rendering and is deliberately kept
 * free of database and crypto work (Auth.js session decoding included) — the real
 * checks live in the route handlers and server components via `requireUser`/
 * `requireAdmin`. All this does is bounce obviously-signed-out visitors to /login.
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

// /signup is public because it has to be reachable with no session at all. It
// gates itself: the page redirects to /login once the store has an owner.
const PUBLIC_PATHS = ["/login", "/signup"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  // Send them back where they were headed once they've signed in.
  if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Page routes only. API routes are deliberately excluded: redirecting an API call
  // to an HTML login page gives clients a useless 307, so the route handlers answer
  // with a proper 401/403 JSON via requireUser/requireAdmin instead.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
