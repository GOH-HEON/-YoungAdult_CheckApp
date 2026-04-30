import { NextResponse } from "next/server";
import { canWrite, getRouteHandlerSession } from "@/lib/auth/session";
import { compareDepartmentName } from "@/lib/utils/department-order";
import { buildAttendanceWorkbook } from "@/lib/attendance/workbook";

type MeetingTypeRow = {
  id: number;
  name: string;
};

type MemberRow = {
  id: string;
  name: string;
  gender: "형제" | "자매";
  departments: { name: string } | null;
};

type AttendanceRecordRow = {
  member_id: string;
  status: "정상출석" | "지각" | "결석" | "행사";
  note: string | null;
};

function compareGenderOrder(a: "형제" | "자매", b: "형제" | "자매") {
  if (a === b) {
    return 0;
  }
  return a === "형제" ? -1 : 1;
}

export async function GET(request: Request) {
  const { supabase, user, appUser } = await getRouteHandlerSession();

  if (!user) {
    return new NextResponse("인증이 필요합니다.", { status: 401 });
  }
  if (!canWrite(appUser)) {
    return new NextResponse("읽기 전용 계정은 엑셀 다운로드를 사용할 수 없습니다.", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const meetingDate = searchParams.get("meetingDate")?.trim() ?? "";
  const meetingTypeName = searchParams.get("meetingTypeName")?.trim() ?? "";
  const meetingTypeId = Number.parseInt(searchParams.get("meetingTypeId") ?? "", 10);

  if (!meetingDate || (!meetingTypeName && Number.isNaN(meetingTypeId))) {
    return new NextResponse("모임 종류와 날짜가 필요합니다.", { status: 400 });
  }

  const [{ data: members }, meetingTypeResult] = await Promise.all([
    supabase
      .from("members")
      .select("id, name, gender, departments(name)")
      .eq("is_active", true)
      .order("name"),
    Number.isNaN(meetingTypeId)
      ? supabase.from("meeting_types").select("id, name").eq("name", meetingTypeName).maybeSingle()
      : supabase.from("meeting_types").select("id, name").eq("id", meetingTypeId).maybeSingle(),
  ]);

  const meetingType = (meetingTypeResult.data as MeetingTypeRow | null) ?? null;
  const resolvedMeetingTypeId = meetingType?.id;
  const resolvedMeetingTypeName = meetingType?.name ?? meetingTypeName;

  let existingRecords: AttendanceRecordRow[] = [];
  if (resolvedMeetingTypeId) {
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id")
      .eq("meeting_type_id", resolvedMeetingTypeId)
      .eq("meeting_date", meetingDate)
      .maybeSingle();

    if (meeting) {
      const { data: records } = await supabase
        .from("attendance_records")
        .select("member_id, status, note")
        .eq("meeting_id", meeting.id);
      existingRecords = (records as AttendanceRecordRow[] | null) ?? [];
    }
  }

  const sortedMembers = ((members as MemberRow[] | null) ?? [])
    .map((member) => ({
      id: member.id,
      name: member.name,
      gender: member.gender,
      departmentName: member.departments?.name ?? "미지정",
    }))
    .sort((a, b) => {
      const byDepartment = compareDepartmentName(a.departmentName, b.departmentName);
      if (byDepartment !== 0) {
        return byDepartment;
      }
      const byGender = compareGenderOrder(a.gender, b.gender);
      if (byGender !== 0) {
        return byGender;
      }
      return a.name.localeCompare(b.name, "ko-KR");
    });

  const workbook = buildAttendanceWorkbook({
    meta: {
      meetingTypeId: resolvedMeetingTypeId,
      meetingTypeName: resolvedMeetingTypeName || undefined,
      meetingDate,
    },
    members: sortedMembers,
    existingRecords,
  });

  const XLSX = await import("xlsx");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const safeMeetingType = (resolvedMeetingTypeName || "attendance").replace(/[^\w\-가-힣]+/g, "_");
  const filename = `${safeMeetingType}_${meetingDate}_명단.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
