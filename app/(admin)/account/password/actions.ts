"use server";

import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { cleanText } from "@/lib/utils/format";

function redirectPasswordPage(message: string, level: "ok" | "error" = "ok"): never {
  const params = new URLSearchParams({
    level,
    message,
  });

  redirect(`/account/password?${params.toString()}`);
}

function isValidPassword(password: string) {
  return password.length >= 6 && /[A-Za-z]/.test(password) && /[^A-Za-z0-9\s]/.test(password);
}

export async function updateCurrentPasswordAction(formData: FormData) {
  const password = cleanText(formData.get("password"));
  const confirmPassword = cleanText(formData.get("confirmPassword"));

  if (!password || !confirmPassword) {
    redirectPasswordPage("새 비밀번호와 확인 값을 모두 입력해 주세요.", "error");
  }

  if (password !== confirmPassword) {
    redirectPasswordPage("새 비밀번호와 확인 값이 일치하지 않습니다.", "error");
  }

  if (!isValidPassword(password)) {
    redirectPasswordPage("비밀번호는 6자 이상이며 영문자와 특수문자를 포함해야 합니다.", "error");
  }

  const { supabase } = await requireSession();
  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    redirectPasswordPage(`비밀번호 변경 실패: ${error.message}`, "error");
  }

  redirectPasswordPage("비밀번호가 변경되었습니다.");
}
