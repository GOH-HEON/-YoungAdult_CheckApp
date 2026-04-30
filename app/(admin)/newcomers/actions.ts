"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GENDER_OPTIONS } from "@/lib/constants/domain";
import { requireAdminSession } from "@/lib/auth/session";
import { cleanText, toInteger } from "@/lib/utils/format";

function redirectNewcomers(message: string, level: "ok" | "error" = "ok"): never {
  redirect(`/newcomers?level=${level}&message=${encodeURIComponent(message)}`);
}

function normalizePhone(value: string) {
  return value.replace(/[^0-9-]/g, "").trim();
}

export async function createNewcomerAction(formData: FormData) {
  const name = cleanText(formData.get("name"));
  const gender = cleanText(formData.get("gender"));
  const birthYear = toInteger(formData.get("birth_year"));
  const salvationDate = cleanText(formData.get("salvation_date"));
  const phone = normalizePhone(cleanText(formData.get("phone")));
  const departmentId = toInteger(formData.get("department_id"));
  const inviterName = cleanText(formData.get("inviter_name"));
  const notes = cleanText(formData.get("notes"));

  if (
    !name ||
    !GENDER_OPTIONS.includes(gender as (typeof GENDER_OPTIONS)[number]) ||
    !birthYear ||
    !departmentId
  ) {
    redirectNewcomers("필수 입력값(이름, 성별, 생년, 소속부서)을 확인해 주세요.", "error");
  }

  const { supabase } = await requireAdminSession();

  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      name,
      gender,
      birth_year: birthYear,
      salvation_date: salvationDate || null,
      phone: phone || null,
      department_id: departmentId,
      is_active: true,
      is_newcomer: true,
    })
    .select("id")
    .single();

  if (memberError || !member) {
    redirectNewcomers(`새가족 등록 실패: ${memberError?.message ?? "members 저장 실패"}`, "error");
  }

  const { error: newcomerError } = await supabase.from("newcomer_profiles").insert({
    member_id: member.id,
    inviter_name: inviterName || null,
    notes: notes || null,
  });

  if (newcomerError) {
    await supabase.from("members").delete().eq("id", member.id);
    redirectNewcomers(`새가족 프로필 저장 실패: ${newcomerError.message}`, "error");
  }

  revalidatePath("/newcomers");
  revalidatePath("/members");
  redirectNewcomers("새가족이 등록되었습니다.");
}
