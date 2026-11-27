"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getRememberLoginCookie, getSessionCookieOptions } from "@/lib/auth/session-cookies";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  const cookieStore = await cookies();
  if (error) {
    console.error("Failed to revoke sessions during sign out:", error.message);
    // A remote revocation failure must not keep this browser signed in.
    const { url } = getSupabasePublicEnv();
    const authCookieName = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
    for (const cookie of cookieStore.getAll()) {
      if (cookie.name === authCookieName ||
          (cookie.name.startsWith(`${authCookieName}.`) && /^\d+$/.test(cookie.name.slice(authCookieName.length + 1)))) {
        cookieStore.set(cookie.name, "", getSessionCookieOptions({ path: "/", maxAge: 0 }, false));
      }
    }
  }
  cookieStore.set({ ...getRememberLoginCookie(false), value: "", maxAge: 0 });
  redirect("/login");
}
