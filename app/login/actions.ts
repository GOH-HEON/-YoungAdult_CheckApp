"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cleanText, sanitizeRedirectPath } from "@/lib/utils/format";

function redirectLoginWithError(message: string, nextPath: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(nextPath)}`);
}

export async function signInAction(formData: FormData) {
  const email = cleanText(formData.get("email"));
  const password = cleanText(formData.get("password"));
  const nextPath = sanitizeRedirectPath(cleanText(formData.get("next")), "/dashboard");

  if (!email || !password) {
    redirectLoginWithError("이메일과 비밀번호를 입력해 주세요.", nextPath);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectLoginWithError("로그인에 실패했습니다. 계정 정보를 확인해 주세요.", nextPath);
  }

  redirect(nextPath);
}
