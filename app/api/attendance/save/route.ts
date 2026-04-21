import { NextResponse } from "next/server";
import { ATTENDANCE_STATUS_OPTIONS, type AttendanceStatus } from "@/lib/constants/domain";
import { getRouteHandlerSession } from "@/lib/auth/session";

type SaveAttendancePayload = {
  meetingTypeId?: number;
  meetingTypeName?: string;
  meetingDate: string;
  rows: Array<{
    memberId: string;
    status: AttendanceStatus | "";
    note?: string;
  }>;
};

function isValidStatus(status: string): status is AttendanceStatus {
  return ATTENDANCE_STATUS_OPTIONS.includes(status as AttendanceStatus);
}

export async function POST(request: Request) {
  const { supabase, user } = await getRouteHandlerSession();

  if (!user) {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as SaveAttendancePayload;
  const meetingTypeId = Number(body.meetingTypeId ?? 0);
  const typedMeetingTypeName = body.meetingTypeName?.trim() ?? "";
  const meetingDate = body.meetingDate;

  if ((!meetingTypeId && !typedMeetingTypeName) || !meetingDate || !Array.isArray(body.rows)) {
    return NextResponse.json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
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
      return NextResponse.json(
        { ok: false, message: `모임 종류 저장 실패: ${createMeetingTypeError?.message}` },
        { status: 500 },
      );
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
      return NextResponse.json({ ok: false, message: "모임 종류를 찾을 수 없습니다." }, { status: 400 });
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
        created_by: user.id,
      })
      .select("id")
      .single();

    if (createMeetingError || !createdMeeting) {
      return NextResponse.json(
        { ok: false, message: `모임 생성 실패: ${createMeetingError?.message}` },
        { status: 500 },
      );
    }

    meetingId = createdMeeting.id;
  }

  const missingMemberIds = body.rows
    .filter((row) => !isValidStatus(String(row.status)))
    .map((row) => row.memberId);

  const upsertRows = body.rows
    .filter((row) => isValidStatus(String(row.status)))
    .map((row) => ({
      meeting_id: meetingId,
      member_id: row.memberId,
      status: row.status,
      note: row.note?.trim() ? row.note.trim() : null,
      checked_by: user.id,
      checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase
      .from("attendance_records")
      .upsert(upsertRows, { onConflict: "meeting_id,member_id" });

    if (upsertError) {
      return NextResponse.json({ ok: false, message: `출석 저장 실패: ${upsertError.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    missingMemberIds,
    savedCount: upsertRows.length,
  });
}
