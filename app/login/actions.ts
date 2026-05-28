"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cleanText, sanitizeRedirectPath } from "@/lib/utils/format";

function redirectLoginWithError(message: string, nextPath: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(nextPath)}`);
}

function getRequestMetadata(requestHeaders: Headers) {
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const realIp = requestHeaders.get("x-real-ip")?.trim() ?? "";
  const cfIp = requestHeaders.get("cf-connecting-ip")?.trim() ?? "";

  return {
    ipAddress: forwardedFor || realIp || cfIp || "",
    userAgent: requestHeaders.get("user-agent")?.trim() ?? "",
  };
}

export async function signInAction(formData: FormData) {
  const email = cleanText(formData.get("email"));
  const password = cleanText(formData.get("password"));
  const nextPath = sanitizeRedirectPath(cleanText(formData.get("next")), "/dashboard");

  if (!email || !password) {
    redirectLoginWithError("이메일과 비밀번호를 입력해 주세요.", nextPath);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectLoginWithError("로그인에 실패했습니다. 계정 정보를 확인해 주세요.", nextPath);
  }

  const userId = data.user?.id ?? "";
  const userEmail = data.user?.email ?? email;

  if (userId) {
    try {
      const requestHeaders = await headers();
      const { ipAddress, userAgent } = getRequestMetadata(requestHeaders);
      const adminSupabase = createSupabaseAdminClient();
      const { data: appUser } = await adminSupabase
        .from("users")
        .select("name, role")
        .eq("id", userId)
        .maybeSingle();

      const { error: historyError } = await adminSupabase.from("login_history").insert({
        user_id: userId,
        user_name: (appUser as { name?: string | null } | null)?.name ?? null,
        user_email: userEmail,
        user_role: (appUser as { role?: string | null } | null)?.role ?? null,
        signed_in_at: new Date().toISOString(),
        user_agent: userAgent || null,
        ip_address: ipAddress || null,
      });

      if (historyError) {
        console.error("Failed to write login history:", historyError);
      }
    } catch (historyError) {
      console.error("Failed to prepare login history:", historyError);
    }
  }

  redirect(nextPath);
}
