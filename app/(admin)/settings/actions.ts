"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import { cleanText, toBoolean, toInteger } from "@/lib/utils/format";

function redirectWithMessage(message: string, level: "ok" | "error" = "ok"): never {
  redirect(`/settings?level=${level}&message=${encodeURIComponent(message)}`);
}

export async function createDepartmentAction(formData: FormData) {
  const name = cleanText(formData.get("name"));

  if (!name) {
    redirectWithMessage("소속부서 이름을 입력해 주세요.", "error");
  }

  const { supabase } = await requireAdminSession();
  const { error } = await supabase.from("departments").insert({
    name,
    is_active: true,
  });

  if (error) {
    redirectWithMessage(`소속부서 등록 실패: ${error.message}`, "error");
  }

  revalidatePath("/settings");
  redirectWithMessage("소속부서가 등록되었습니다.");
}

export async function updateDepartmentAction(formData: FormData) {
  const id = toInteger(formData.get("id"));
  const name = cleanText(formData.get("name"));
  const isActive = toBoolean(formData.get("is_active"));

  if (!id || !name) {
    redirectWithMessage("소속부서 수정 값이 올바르지 않습니다.", "error");
  }

  const { supabase } = await requireAdminSession();
  const { error } = await supabase
    .from("departments")
    .update({
      name,
      is_active: isActive,
    })
    .eq("id", id);

  if (error) {
    redirectWithMessage(`소속부서 수정 실패: ${error.message}`, "error");
  }

  revalidatePath("/settings");
  redirectWithMessage("소속부서가 수정되었습니다.");
}

export async function createMeetingTypeAction(formData: FormData) {
  const name = cleanText(formData.get("name"));

  if (!name) {
    redirectWithMessage("모임 종류 이름을 입력해 주세요.", "error");
  }

  const { supabase } = await requireAdminSession();
  const { error } = await supabase.from("meeting_types").insert({
    name,
    is_active: true,
  });

  if (error) {
    redirectWithMessage(`모임 종류 등록 실패: ${error.message}`, "error");
  }

  revalidatePath("/settings");
  redirectWithMessage("모임 종류가 등록되었습니다.");
}

export async function updateMeetingTypeAction(formData: FormData) {
  const id = toInteger(formData.get("id"));
  const name = cleanText(formData.get("name"));
  const isActive = toBoolean(formData.get("is_active"));

  if (!id || !name) {
    redirectWithMessage("모임 종류 수정 값이 올바르지 않습니다.", "error");
  }

  const { supabase } = await requireAdminSession();
  const { error } = await supabase
    .from("meeting_types")
    .update({
      name,
      is_active: isActive,
    })
    .eq("id", id);

  if (error) {
    redirectWithMessage(`모임 종류 수정 실패: ${error.message}`, "error");
  }

  revalidatePath("/settings");
  redirectWithMessage("모임 종류가 수정되었습니다.");
}
