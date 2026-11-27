import type { CookieOptions } from "@supabase/ssr";

export const REMEMBER_LOGIN_COOKIE = "youngadult-remember-login";
export const REMEMBER_LOGIN_MAX_AGE = 30 * 24 * 60 * 60;

export function getSessionCookieOptions(options: CookieOptions, rememberLogin: boolean): CookieOptions {
  const secureOptions = {
    ...options,
    secure: process.env.NODE_ENV === "production",
  };

  // Supabase uses maxAge: 0 to delete old chunks and signed-out sessions.
  if (options.maxAge === 0) {
    return secureOptions;
  }

  return {
    ...secureOptions,
    maxAge: rememberLogin ? REMEMBER_LOGIN_MAX_AGE : undefined,
    expires: undefined,
  };
}

export function getRememberLoginCookie(rememberLogin: boolean) {
  return {
    name: REMEMBER_LOGIN_COOKIE,
    value: rememberLogin ? "1" : "0",
    ...getSessionCookieOptions({ path: "/", sameSite: "lax", httpOnly: true }, rememberLogin),
  };
}
