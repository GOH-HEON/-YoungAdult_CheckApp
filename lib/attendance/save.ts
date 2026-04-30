import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTENDANCE_STATUS_OPTIONS, type AttendanceStatus } from "@/lib/constants/domain";

type AttendanceSaveRow = {
  memberId: string;
  status: AttendanceStatus | "";
  note?: string;
};

export type AttendanceSaveInput = {
  meetingTypeId?: number;
  meetingTypeName?: string;
  meetingDate: string;
  rows: AttendanceSaveRow[];
  clearMissingRows?: boolean;
};

type AttendanceSaveResult = {
  meetingId: string;
  meetingTypeId: number;
  meetingTypeName: string;
  missingMemberIds: string[];
  savedCount: number;
};

export class AttendanceSaveError extends Error {}

function isValidStatus(status: string): status is AttendanceStatus {
  return ATTENDANCE_STATUS_OPTIONS.includes(status as AttendanceStatus);
}

export async function saveAttendanceRecords({
  supabase,
  userId,
  input,
}: {
  supabase: SupabaseClient;
  userId: string;
  input: AttendanceSaveInput;
}): Promise<AttendanceSaveResult> {
  const meetingTypeId = Number(input.meetingTypeId ?? 0);
  const typedMeetingTypeName = input.meetingTypeName?.trim() ?? "";
  const meetingDate = input.meetingDate;

  if ((!meetingTypeId && !typedMeetingTypeName) || !meetingDate || !Array.isArray(input.rows)) {
    throw new AttendanceSaveError("요청 형식이 올바르지 않습니다.");
  }

  let resolvedMeetingTypeId = meetingTypeId;
  let meetingTypeName = "";

  if (typedMeetingTypeName) {
    const { data: createdMeetingType, error: createMeetingTypeError } = await supabase
      .from("meeting_types")
      .upsert(
        {
          name: typedMeetingTypeName,
          is_active: true,
        },
        { onConflict: "name" },
      )
      .select("id, name")
      .maybeSingle();

    if (createMeetingTypeError || !createdMeetingType) {
      throw new AttendanceSaveError(`모임 종류 저장 실패: ${createMeetingTypeError?.message}`);
    }

    resolvedMeetingTypeId = createdMeetingType.id;
    meetingTypeName = createdMeetingType.name;
  } else {
    const { data: meetingType } = await supabase
      .from("meeting_types")
      .select("id, name")
      .eq("id", meetingTypeId)
      .maybeSingle();

    if (!meetingType) {
      throw new AttendanceSaveError("모임 종류를 찾을 수 없습니다.");
    }

    resolvedMeetingTypeId = meetingType.id;
    meetingTypeName = meetingType.name;
  }

  let meetingId = "";
  const { data: existingMeeting } = await supabase
    .from("meetings")
    .select("id")
    .eq("meeting_type_id", resolvedMeetingTypeId)
    .eq("meeting_date", meetingDate)
    .maybeSingle();

  if (existingMeeting) {
    meetingId = existingMeeting.id;
  } else {
    const { data: createdMeeting, error: createMeetingError } = await supabase
      .from("meetings")
      .insert({
        meeting_type_id: resolvedMeetingTypeId,
        meeting_date: meetingDate,
        title: `${meetingTypeName} (${meetingDate})`,
        created_by: userId,
      })
      .select("id")
      .single();

    if (createMeetingError || !createdMeeting) {
      throw new AttendanceSaveError(`모임 생성 실패: ${createMeetingError?.message}`);
    }

    meetingId = createdMeeting.id;
  }

  const missingMemberIds = input.rows
    .filter((row) => !isValidStatus(String(row.status)))
    .map((row) => row.memberId);

  if (input.clearMissingRows && missingMemberIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("attendance_records")
      .delete()
      .eq("meeting_id", meetingId)
      .in("member_id", missingMemberIds);

    if (deleteError) {
      throw new AttendanceSaveError(`기존 출석 비우기 실패: ${deleteError.message}`);
    }
  }

  const upsertRows = input.rows
    .filter((row) => isValidStatus(String(row.status)))
    .map((row) => ({
      meeting_id: meetingId,
      member_id: row.memberId,
      status: row.status,
      note: row.note?.trim() ? row.note.trim() : null,
      checked_by: userId,
      checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase
      .from("attendance_records")
      .upsert(upsertRows, { onConflict: "meeting_id,member_id" });

    if (upsertError) {
      throw new AttendanceSaveError(`출석 저장 실패: ${upsertError.message}`);
    }
  }

  return {
    meetingId,
    meetingTypeId: resolvedMeetingTypeId,
    meetingTypeName,
    missingMemberIds,
    savedCount: upsertRows.length,
  };
}
