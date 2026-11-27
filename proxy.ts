import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

const protectedPrefixes = [
  "/dashboard",
  "/members",
  "/attendance",
  "/newcomers",
  "/leaders",
  "/reports",
  "/settings",
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectWithSession(url: URL, sessionResponse: NextResponse) {
  const response = NextResponse.redirect(url);
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  for (const name of ["Cache-Control", "Expires", "Pragma"]) {
    const value = sessionResponse.headers.get(name);
    if (value) {
      response.headers.set(name, value);
    }
  }
  return response;
}

export async function proxy(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next({ request });
  }

  const pathname = request.nextUrl.pathname;
  const { user, response } = await createSupabaseMiddlewareClient(request);

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return redirectWithSession(loginUrl, response);
  }

  if (pathname === "/login" && user) {
    return redirectWithSession(new URL("/dashboard", request.url), response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
