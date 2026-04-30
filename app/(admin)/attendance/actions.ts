"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/session";
import { AttendanceSaveError, saveAttendanceRecords } from "@/lib/attendance/save";
import { parseAttendanceWorkbook } from "@/lib/attendance/workbook";

function redirectCheckWithContext({
  message,
  level = "ok",
  meetingDate,
  meetingTypeId,
  meetingTypeName,
}: {
  message: string;
  level?: "ok" | "error";
  meetingDate?: string;
  meetingTypeId?: number;
  meetingTypeName?: string;
}): never {
  const params = new URLSearchParams();
  params.set("level", level);
  params.set("message", message);
  if (meetingDate) params.set("meetingDate", meetingDate);
  if (meetingTypeId) params.set("meetingTypeId", String(meetingTypeId));
  if (meetingTypeName) params.set("meetingTypeName", meetingTypeName);
  redirect(`/attendance/check?${params.toString()}`);
}

export async function deleteAttendanceByDateAction(formData: FormData) {
  const meetingDate = String(formData.get("meetingDate") ?? "").trim();
  const meetingTypeName = String(formData.get("meetingTypeName") ?? "").trim();
  const meetingTypeIdValue = Number.parseInt(String(formData.get("meetingTypeId") ?? ""), 10);
  let meetingTypeId = Number.isNaN(meetingTypeIdValue) ? 0 : meetingTypeIdValue;

  if (!meetingDate) {
    redirectCheckWithContext({
      message: "삭제할 날짜가 필요합니다.",
      level: "error",
      meetingDate,
      meetingTypeId,
      meetingTypeName,
    });
  }

  const { supabase } = await requireAdminSession();

  if (!meetingTypeId && meetingTypeName) {
    const { data: meetingType } = await supabase
      .from("meeting_types")
      .select("id")
      .eq("name", meetingTypeName)
      .maybeSingle();

    if (!meetingType) {
      redirectCheckWithContext({
        message: "해당 모임 종류를 찾지 못했습니다.",
        level: "error",
        meetingDate,
        meetingTypeId,
        meetingTypeName,
      });
    }

    meetingTypeId = meetingType.id;
  }

  if (!meetingTypeId) {
    redirectCheckWithContext({
      message: "삭제할 모임 종류를 선택하거나 입력해 주세요.",
      level: "error",
      meetingDate,
      meetingTypeId,
      meetingTypeName,
    });
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id")
    .eq("meeting_type_id", meetingTypeId)
    .eq("meeting_date", meetingDate)
    .maybeSingle();

  if (!meeting) {
    redirectCheckWithContext({
      message: "해당 날짜의 출석 데이터가 없습니다.",
      level: "error",
      meetingDate,
      meetingTypeId,
      meetingTypeName,
    });
  }

  const { error: deleteMeetingError } = await supabase
    .from("meetings")
    .delete()
    .eq("id", meeting.id);

  if (deleteMeetingError) {
    redirectCheckWithContext({
      message: `출석 삭제 실패: ${deleteMeetingError.message}`,
      level: "error",
      meetingDate,
      meetingTypeId,
      meetingTypeName,
    });
  }

  revalidatePath("/attendance/check");
  revalidatePath("/attendance/view");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirectCheckWithContext({
    message: "해당 날짜 출석이 전체 삭제되었습니다.",
    meetingDate,
    meetingTypeId,
    meetingTypeName,
  });
}

export async function importAttendanceWorkbookAction(formData: FormData) {
  const fallbackMeetingDate = String(formData.get("meetingDate") ?? "").trim();
  const fallbackMeetingTypeName = String(formData.get("meetingTypeName") ?? "").trim();
  const fallbackMeetingTypeIdValue = Number.parseInt(String(formData.get("meetingTypeId") ?? ""), 10);
  const fallbackMeetingTypeId = Number.isNaN(fallbackMeetingTypeIdValue) ? 0 : fallbackMeetingTypeIdValue;
  const workbook = formData.get("workbook");

  if (!(workbook instanceof File) || workbook.size === 0) {
    redirectCheckWithContext({
      message: "업로드할 엑셀 파일을 선택해 주세요.",
      level: "error",
      meetingDate: fallbackMeetingDate,
      meetingTypeId: fallbackMeetingTypeId,
      meetingTypeName: fallbackMeetingTypeName,
    });
  }

  const { supabase, user } = await requireAdminSession();

  try {
    const parsed = parseAttendanceWorkbook(await workbook.arrayBuffer());
    const result = await saveAttendanceRecords({
      supabase,
      userId: user.id,
      input: {
        meetingTypeId: parsed.meta.meetingTypeId,
        meetingTypeName: parsed.meta.meetingTypeName,
        meetingDate: parsed.meta.meetingDate,
        rows: parsed.rows,
        clearMissingRows: true,
      },
    });

    revalidatePath("/attendance/check");
    revalidatePath("/attendance/view");
    revalidatePath("/attendance/print");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath("/reports/score");

    redirectCheckWithContext({
      message: `엑셀 Import 완료: ${result.savedCount}명 저장, 미기록 ${result.missingMemberIds.length}명`,
      meetingDate: result.meetingId ? parsed.meta.meetingDate : fallbackMeetingDate,
      meetingTypeId: result.meetingTypeId,
      meetingTypeName: result.meetingTypeName,
    });
  } catch (error) {
    redirectCheckWithContext({
      message: error instanceof AttendanceSaveError || error instanceof Error ? error.message : "엑셀 Import 중 오류가 발생했습니다.",
      level: "error",
      meetingDate: fallbackMeetingDate,
      meetingTypeId: fallbackMeetingTypeId,
      meetingTypeName: fallbackMeetingTypeName,
    });
  }
}
