import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRememberLoginCookie, getSessionCookieOptions, REMEMBER_LOGIN_COOKIE } from "@/lib/auth/session-cookies";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const { url, anonKey } = getSupabasePublicEnv();
  const rememberLogin = request.cookies.get(REMEMBER_LOGIN_COOKIE)?.value === "1";

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        const previousCookies = response.cookies.getAll();
        response = NextResponse.next({ request });
        previousCookies.forEach((cookie) => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, getSessionCookieOptions(options, rememberLogin));
        });
        if (cookiesToSet.some(({ options }) => options.maxAge !== 0)) {
          response.cookies.set(getRememberLoginCookie(rememberLogin));
        }
        response.headers.set("Cache-Control", "private, no-store");
        Object.entries(cacheHeaders).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user, response };
}
