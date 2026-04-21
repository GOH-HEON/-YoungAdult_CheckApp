import Link from "next/link";
import { PageTitle } from "@/components/ui/page-title";
import { AttendanceCheckForm } from "@/components/attendance/attendance-check-form";
import { deleteAttendanceByDateAction } from "@/app/(admin)/attendance/actions";
import { requireSession } from "@/lib/auth/session";
import { compareDepartmentName } from "@/lib/utils/department-order";
import { formatDateInputValue } from "@/lib/utils/format";

type AttendanceCheckPageProps = {
  searchParams: Promise<{
    meetingTypeId?: string;
    meetingTypeName?: string;
    meetingDate?: string;
    level?: "ok" | "error";
    message?: string;
  }>;
};

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

export default async function AttendanceCheckPage({ searchParams }: AttendanceCheckPageProps) {
  const params = await searchParams;
  const { supabase } = await requireSession();

  const [{ data: meetingTypes }, { data: members }] = await Promise.all([
    supabase.from("meeting_types").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("members")
      .select("id, name, gender, departments(name)")
      .eq("is_active", true)
      .order("name"),
  ]);

  const preferredMeetingTypeId = ((meetingTypes as MeetingTypeRow[] | null) ?? []).find(
    (meetingType) => meetingType.name === "청년회 모임",
  )?.id;

  const selectedMeetingTypeName = params.meetingTypeName?.trim() ?? "";
  const selectedMeetingTypeId = Number(
    params.meetingTypeId ?? preferredMeetingTypeId ?? meetingTypes?.[0]?.id ?? 0,
  );
  const selectedMeetingDate = params.meetingDate ?? formatDateInputValue();
  const resolvedMeetingTypeId = selectedMeetingTypeName
    ? ((meetingTypes as MeetingTypeRow[] | null) ?? []).find(
        (meetingType) => meetingType.name === selectedMeetingTypeName,
      )?.id ?? 0
    : selectedMeetingTypeId;

  let existingRecords: AttendanceRecordRow[] = [];
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

  if (resolvedMeetingTypeId && selectedMeetingDate) {
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id")
      .eq("meeting_type_id", resolvedMeetingTypeId)
      .eq("meeting_date", selectedMeetingDate)
      .maybeSingle();

    if (meeting) {
      const { data: records } = await supabase
        .from("attendance_records")
        .select("member_id, status, note")
        .eq("meeting_id", meeting.id);
      existingRecords = (records as AttendanceRecordRow[] | null) ?? [];
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="출석 체크"
        description="모임 종류 + 날짜 기준으로 출석을 빠르게 선택하고 저장합니다. 상태를 바꾼 뒤 저장하면 수정됩니다."
      />

      {params.message ? (
        <div
          className={[
            "rounded-xl border px-4 py-3 text-sm",
            params.level === "error"
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-emerald-300 bg-emerald-50 text-emerald-700",
          ].join(" ")}
        >
          {params.message}
        </div>
      ) : null}

      {(meetingTypes?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          등록된 모임 종류가 없습니다. 아래 입력란에서 모임 종류를 직접 입력하면 저장 시 자동 생성됩니다.
          <span className="ml-1">
            (<Link href="/settings" className="font-semibold underline">설정</Link>에서도 관리 가능)
          </span>
        </div>
      ) : null}

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">모임 종류 선택</span>
          <select
            name="meetingTypeId"
            defaultValue={selectedMeetingTypeId ? String(selectedMeetingTypeId) : ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">선택 안함</option>
            {(meetingTypes as MeetingTypeRow[] | null)?.map((meetingType) => (
              <option key={meetingType.id} value={meetingType.id}>
                {meetingType.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">모임 종류 직접 입력</span>
          <input
            name="meetingTypeName"
            defaultValue={selectedMeetingTypeName}
            placeholder="예: 청년회 모임"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">날짜</span>
          <input
            name="meetingDate"
            type="date"
            defaultValue={selectedMeetingDate}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <div className="flex items-end">
          <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            불러오기
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-base font-semibold text-slate-900">출석 데이터 관리</h3>
        <p className="mt-1 text-sm text-slate-600">
          수정: 아래 상태 변경 후 저장 버튼 클릭 / 삭제: 해당 날짜 전체 출석 삭제
        </p>
        <form action={deleteAttendanceByDateAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="meetingTypeId" value={resolvedMeetingTypeId || selectedMeetingTypeId || ""} />
          <input type="hidden" name="meetingTypeName" value={selectedMeetingTypeName} />
          <input type="hidden" name="meetingDate" value={selectedMeetingDate} />
          <button
            type="submit"
            className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
          >
            {selectedMeetingDate} 전체 출석 삭제
          </button>
        </form>
      </div>

      {(members?.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          활성 형제/자매 명단이 없습니다. 명단을 먼저 등록해 주세요.
        </p>
      ) : resolvedMeetingTypeId || selectedMeetingTypeName ? (
        <AttendanceCheckForm
          meetingTypeId={resolvedMeetingTypeId || undefined}
          meetingTypeName={selectedMeetingTypeName || undefined}
          meetingDate={selectedMeetingDate}
          members={sortedMembers}
          existingRecords={existingRecords}
        />
      ) : (
        <p className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          모임 종류를 선택하거나 직접 입력한 뒤 불러오기를 눌러 주세요.
        </p>
      )}
    </div>
  );
}
