"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { GENDER_OPTIONS } from "@/lib/constants/domain";
import { requireSession } from "@/lib/auth/session";
import { cleanText, toBoolean, toInteger } from "@/lib/utils/format";

function redirectMembers(message: string, level: "ok" | "error" = "ok"): never {
  redirect(`/members?level=${level}&message=${encodeURIComponent(message)}`);
}

type MemberPayload = {
  name: string;
  gender: string;
  birth_year: number;
  salvation_date: string | null;
  phone: string | null;
  department_id: number;
  is_active: boolean;
};

type ParsedMemberForm =
  | {
      ok: true;
      payload: MemberPayload;
    }
  | {
      ok: false;
      message: string;
    };

function normalizePhone(value: string) {
  return value.replace(/[^0-9-]/g, "").trim();
}

function validateGender(value: string) {
  return GENDER_OPTIONS.includes(value as (typeof GENDER_OPTIONS)[number]);
}

function parseMemberForm(formData: FormData): ParsedMemberForm {
  const name = cleanText(formData.get("name"));
  const gender = cleanText(formData.get("gender"));
  const birthYear = toInteger(formData.get("birth_year"));
  const salvationDate = cleanText(formData.get("salvation_date"));
  const phone = normalizePhone(cleanText(formData.get("phone")));
  const departmentId = toInteger(formData.get("department_id"));
  const isActive = toBoolean(formData.get("is_active"));

  if (!name || !validateGender(gender) || !birthYear || !departmentId) {
    return { ok: false as const, message: "필수 입력값(이름, 성별, 생년, 소속부서)을 확인해 주세요." };
  }

  return {
    ok: true,
    payload: {
      name,
      gender,
      birth_year: birthYear,
      salvation_date: salvationDate || null,
      phone: phone || null,
      department_id: departmentId,
      is_active: isActive,
    },
  };
}

export async function createMemberAction(formData: FormData) {
  const parsed = parseMemberForm(formData);
  if (!parsed.ok) {
    redirectMembers(parsed.message, "error");
  }
  const payload = parsed.payload;

  const { supabase } = await requireSession();
  const { error } = await supabase.from("members").insert({
    ...payload,
    is_newcomer: false,
  });

  if (error) {
    redirectMembers(`명단 등록 실패: ${error.message}`, "error");
  }

  revalidatePath("/members");
  revalidatePath("/members/new");
  redirectMembers("형제/자매 명단이 등록되었습니다.");
}

export async function updateMemberAction(formData: FormData) {
  const memberId = cleanText(formData.get("id"));
  const parsed = parseMemberForm(formData);

  if (!memberId) {
    redirectMembers("수정 대상 ID가 누락되었습니다.", "error");
  }
  if (!parsed.ok) {
    redirectMembers(parsed.message, "error");
  }
  const payload = parsed.payload;

  const { supabase } = await requireSession();
  const { error } = await supabase
    .from("members")
    .update(payload)
    .eq("id", memberId);

  if (error) {
    redirectMembers(`명단 수정 실패: ${error.message}`, "error");
  }

  revalidatePath("/members");
  revalidatePath(`/members/${memberId}/edit`);
  redirectMembers("형제/자매 정보가 수정되었습니다.");
}

export async function toggleMemberActiveAction(formData: FormData) {
  const memberId = cleanText(formData.get("id"));
  const isActive = toBoolean(formData.get("is_active"));

  if (!memberId) {
    redirectMembers("대상 형제/자매를 찾을 수 없습니다.", "error");
  }

  const { supabase } = await requireSession();
  const { error } = await supabase
    .from("members")
    .update({ is_active: !isActive })
    .eq("id", memberId);

  if (error) {
    redirectMembers(`상태 변경 실패: ${error.message}`, "error");
  }

  revalidatePath("/members");
  redirectMembers(`형제/자매 상태가 ${isActive ? "비활성" : "활성"}으로 변경되었습니다.`);
}

export async function deleteMemberAction(formData: FormData) {
  const memberId = cleanText(formData.get("id"));

  if (!memberId) {
    redirectMembers("삭제 대상 형제/자매를 찾을 수 없습니다.", "error");
  }

  const { supabase } = await requireSession();

  const { error: deleteAttendanceError } = await supabase
    .from("attendance_records")
    .delete()
    .eq("member_id", memberId);

  if (deleteAttendanceError) {
    redirectMembers(`삭제 실패(출석기록 정리): ${deleteAttendanceError.message}`, "error");
  }

  const { error: deleteMemberError } = await supabase
    .from("members")
    .delete()
    .eq("id", memberId);

  if (deleteMemberError) {
    redirectMembers(`삭제 실패: ${deleteMemberError.message}`, "error");
  }

  revalidatePath("/members");
  revalidatePath("/attendance/check");
  revalidatePath("/attendance/view");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirectMembers("형제/자매 명단이 완전히 삭제되었습니다.");
}
