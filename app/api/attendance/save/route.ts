import { NextResponse } from "next/server";
import { canWrite, getRouteHandlerSession } from "@/lib/auth/session";
import { AttendanceSaveError, saveAttendanceRecords } from "@/lib/attendance/save";
import type { AttendanceStatus } from "@/lib/constants/domain";

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

export async function POST(request: Request) {
  const { supabase, user, appUser } = await getRouteHandlerSession();

  if (!user) {
    return NextResponse.json({ ok: false, message: "인증이 필요합니다." }, { status: 401 });
  }
  if (!canWrite(appUser)) {
    return NextResponse.json({ ok: false, message: "읽기 전용 계정은 저장할 수 없습니다." }, { status: 403 });
  }

  const body = (await request.json()) as SaveAttendancePayload;
  try {
    const result = await saveAttendanceRecords({
      supabase,
      userId: user.id,
      input: body,
    });

    return NextResponse.json({
      ok: true,
      missingMemberIds: result.missingMemberIds,
      savedCount: result.savedCount,
    });
  } catch (error) {
    const message = error instanceof AttendanceSaveError ? error.message : "출석 저장 중 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
