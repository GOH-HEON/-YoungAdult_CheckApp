"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePersonalNotesSession } from "@/lib/auth/session";
import {
  PERSONAL_NOTE_DEFAULT_TITLE,
  PERSONAL_NOTE_TITLE_PREFIX,
  withPersonalNotePrefix,
} from "@/lib/notes/personal-notes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanText } from "@/lib/utils/format";

function redirectPersonalNotes({
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
  redirect(`/personal-notes?${params.toString()}`);
}

function normalizeHtml(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.slice(0, 200_000);
}

export async function savePersonalNoteAction(formData: FormData) {
  const noteId = cleanText(formData.get("noteId"));
  const title = withPersonalNotePrefix(cleanText(formData.get("title")) || PERSONAL_NOTE_DEFAULT_TITLE);
  const contentHtml = normalizeHtml(formData.get("contentHtml"));

  if (!contentHtml) {
    redirectPersonalNotes({
      level: "error",
      message: "메모 내용을 입력해 주세요.",
    });
  }

  const { user } = await requirePersonalNotesSession();
  const supabase = createSupabaseAdminClient();

  if (noteId) {
    const { error } = await supabase
      .from("chairboard_notes")
      .update({
        title,
        content_html: contentHtml,
        updated_by: user.id,
      })
      .eq("id", noteId)
      .eq("created_by", user.id)
      .like("title", `${PERSONAL_NOTE_TITLE_PREFIX}%`);

    if (error) {
      redirectPersonalNotes({
        level: "error",
        message: `메모 저장 실패: ${error.message}`,
      });
    }

    revalidatePath("/personal-notes");
    redirectPersonalNotes({
      message: "기타 메모가 저장되었습니다.",
      noteId,
    });
  }

  const { data, error } = await supabase
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
    redirectPersonalNotes({
      level: "error",
      message: `메모 생성 실패: ${error?.message ?? "알 수 없는 오류"}`,
    });
  }

  revalidatePath("/personal-notes");
  redirectPersonalNotes({
    message: "기타 메모가 저장되었습니다.",
    noteId: data.id,
  });
}

export async function deletePersonalNoteAction(formData: FormData) {
  const noteId = cleanText(formData.get("noteId"));

  if (!noteId) {
    redirectPersonalNotes({
      level: "error",
      message: "삭제할 메모를 찾지 못했습니다.",
    });
  }

  const { user } = await requirePersonalNotesSession();
  const supabase = createSupabaseAdminClient();

  const { data: noteToDelete, error: readError } = await supabase
    .from("chairboard_notes")
    .select("id")
    .eq("id", noteId)
    .eq("created_by", user.id)
    .like("title", `${PERSONAL_NOTE_TITLE_PREFIX}%`)
    .maybeSingle();

  if (readError || !noteToDelete) {
    redirectPersonalNotes({
      level: "error",
      message: "삭제할 메모를 찾지 못했습니다.",
    });
  }

  const { error: deleteError } = await supabase
    .from("chairboard_notes")
    .delete()
    .eq("id", noteId)
    .eq("created_by", user.id)
    .like("title", `${PERSONAL_NOTE_TITLE_PREFIX}%`);

  if (deleteError) {
    redirectPersonalNotes({
      level: "error",
      message: `메모 삭제 실패: ${deleteError.message}`,
    });
  }

  const { data: latestNote, error: latestError } = await supabase
    .from("chairboard_notes")
    .select("id")
    .eq("created_by", user.id)
    .like("title", `${PERSONAL_NOTE_TITLE_PREFIX}%`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    redirectPersonalNotes({
      level: "error",
      message: `다음 메모를 불러오지 못했습니다: ${latestError.message}`,
    });
  }

  revalidatePath("/personal-notes");

  if (latestNote?.id) {
    redirectPersonalNotes({
      message: "기타 메모가 삭제되었습니다.",
      noteId: latestNote.id,
    });
  }

  redirectPersonalNotes({
    message: "기타 메모가 삭제되었습니다.",
    draft: true,
  });
}
