"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canWrite, requireChairboardSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanText } from "@/lib/utils/format";

function redirectChairboard({
  message,
  level = "ok",
  noteId,
  draft,
}: {
  message: string;
  level?: "ok" | "error";
  noteId?: string;
  draft?: boolean;
}): never {
  const params = new URLSearchParams();
  params.set("level", level);
  params.set("message", message);
  if (noteId) {
    params.set("noteId", noteId);
  }
  if (draft) {
    params.set("new", "1");
  }
  redirect(`/chairboard?${params.toString()}`);
}

function normalizeHtml(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.slice(0, 200_000);
}

export async function saveChairboardNoteAction(formData: FormData) {
  const noteId = cleanText(formData.get("noteId"));
  const title = cleanText(formData.get("title")) || "회장단 임원모임 메모";
  const contentHtml = normalizeHtml(formData.get("contentHtml"));

  if (!contentHtml) {
    redirectChairboard({
      level: "error",
      message: "메모 내용을 입력해 주세요.",
    });
  }

  const { supabase, user, appUser } = await requireChairboardSession();
  const chairboardSupabase = canWrite(appUser) ? createSupabaseAdminClient() : supabase;

  if (noteId) {
    const { error } = await chairboardSupabase
      .from("chairboard_notes")
      .update({
        title,
        content_html: contentHtml,
        updated_by: user.id,
      })
      .eq("id", noteId);

    if (error) {
      redirectChairboard({
        level: "error",
        message: `메모 저장 실패: ${error.message}`,
      });
    }
    revalidatePath("/chairboard");
    redirectChairboard({
      message: "회장단 메모가 저장되었습니다.",
      noteId,
    });
  }

  const { data, error } = await chairboardSupabase
    .from("chairboard_notes")
    .insert({
      title,
      content_html: contentHtml,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirectChairboard({
      level: "error",
      message: `메모 생성 실패: ${error?.message ?? "알 수 없는 오류"}`,
    });
  }

  revalidatePath("/chairboard");
  redirectChairboard({
    message: "회장단 메모가 저장되었습니다.",
    noteId: data.id,
  });
}

export async function deleteChairboardNoteAction(formData: FormData) {
  const noteId = cleanText(formData.get("noteId"));

  if (!noteId) {
    redirectChairboard({
      level: "error",
      message: "삭제할 메모를 찾지 못했습니다.",
    });
  }

  const { supabase, appUser } = await requireChairboardSession();
  const chairboardSupabase = canWrite(appUser) ? createSupabaseAdminClient() : supabase;

  const { data: noteToDelete, error: readError } = await chairboardSupabase
    .from("chairboard_notes")
    .select("id")
    .eq("id", noteId)
    .maybeSingle();

  if (readError || !noteToDelete) {
    redirectChairboard({
      level: "error",
      message: "삭제할 메모를 찾지 못했습니다.",
    });
  }

  const { error: deleteError } = await chairboardSupabase
    .from("chairboard_notes")
    .delete()
    .eq("id", noteId);

  if (deleteError) {
    redirectChairboard({
      level: "error",
      message: `메모 삭제 실패: ${deleteError.message}`,
    });
  }

  const { data: latestNote, error: latestError } = await chairboardSupabase
    .from("chairboard_notes")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    redirectChairboard({
      level: "error",
      message: `다음 메모를 불러오지 못했습니다: ${latestError.message}`,
    });
  }

  revalidatePath("/chairboard");

  if (latestNote?.id) {
    redirectChairboard({
      message: "회장단 메모가 삭제되었습니다.",
      noteId: latestNote.id,
    });
  }

  redirectChairboard({
    message: "회장단 메모가 삭제되었습니다.",
    level: "ok",
    draft: true,
  });
}
