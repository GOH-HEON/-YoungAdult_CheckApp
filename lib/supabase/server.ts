import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getRememberLoginCookie, getSessionCookieOptions, REMEMBER_LOGIN_COOKIE } from "@/lib/auth/session-cookies";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function createSupabaseServerClient(options: { rememberLogin?: boolean } = {}) {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();
  const rememberLogin = options.rememberLogin ?? cookieStore.get(REMEMBER_LOGIN_COOKIE)?.value === "1";

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, getSessionCookieOptions(options, rememberLogin));
          });
          if (cookiesToSet.some(({ options }) => options.maxAge !== 0)) {
            cookieStore.set(getRememberLoginCookie(rememberLogin));
          }
        } catch {
          // Server Component에서 set 시도 시 예외가 발생할 수 있으며,
          // middleware/route handler에서 세션을 갱신하도록 설계합니다.
        }
      },
    },
  });
}
