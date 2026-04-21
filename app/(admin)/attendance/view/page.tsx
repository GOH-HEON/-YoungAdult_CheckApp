import Link from "next/link";
import { PageTitle } from "@/components/ui/page-title";
import { requireSession } from "@/lib/auth/session";
import { compareDepartmentName } from "@/lib/utils/department-order";
import { formatDateInputValue } from "@/lib/utils/format";

type AttendanceViewPageProps = {
  searchParams: Promise<{
    meetingTypeId?: string;
    from?: string;
    to?: string;
    departmentId?: string;
  }>;
};

type MeetingTypeRow = {
  id: number;
  name: string;
};

type MeetingRow = {
  id: string;
  meeting_date: string;
};

type DepartmentRow = {
  id: number;
  name: string;
};

type MemberRow = {
  id: string;
  name: string;
  gender: "형제" | "자매";
  departments: {
    name: string;
  } | null;
};

type AttendanceRecordRow = {
  meeting_id: string;
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

function subtractDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateInputValue(date);
}

function statusClass(status: string | null) {
  if (status === "정상출석") return "bg-emerald-100 text-emerald-700";
  if (status === "지각") return "bg-amber-100 text-amber-700";
  if (status === "행사") return "bg-blue-100 text-blue-700";
  if (status === "결석") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

export default async function AttendanceViewPage({ searchParams }: AttendanceViewPageProps) {
  const params = await searchParams;
  const { supabase } = await requireSession();

  const [{ data: meetingTypes }, { data: departments }] = await Promise.all([
    supabase
      .from("meeting_types")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase.from("departments").select("id, name"),
  ]);

  const preferredMeetingTypeId = ((meetingTypes as MeetingTypeRow[] | null) ?? []).find(
    (meetingType) => meetingType.name === "청년회 모임",
  )?.id;
  const selectedMeetingTypeId = Number(
    params.meetingTypeId ?? preferredMeetingTypeId ?? meetingTypes?.[0]?.id ?? 0,
  );
  const selectedDepartmentId = Number.parseInt(params.departmentId ?? "", 10);
  const fromDate = params.from ?? subtractDays(28);
  const toDate = params.to ?? formatDateInputValue();

  let meetings: MeetingRow[] = [];
  let members: MemberRow[] = [];
  let records: AttendanceRecordRow[] = [];

  if (selectedMeetingTypeId && fromDate && toDate) {
    const [{ data: meetingData }, { data: memberData }] = await Promise.all([
      supabase
        .from("meetings")
        .select("id, meeting_date")
        .eq("meeting_type_id", selectedMeetingTypeId)
        .gte("meeting_date", fromDate)
        .lte("meeting_date", toDate)
        .order("meeting_date", { ascending: true }),
      supabase
        .from("members")
        .select("id, name, gender, departments(name)")
        .eq("is_active", true)
        .order("name"),
    ]);

    meetings = (meetingData as MeetingRow[] | null) ?? [];
    members = (memberData as MemberRow[] | null) ?? [];

    if (meetings.length > 0) {
      const recordChunks = await Promise.all(
        meetings.map((meeting) =>
          supabase
            .from("attendance_records")
            .select("meeting_id, member_id, status, note")
            .eq("meeting_id", meeting.id),
        ),
      );

      records = recordChunks.flatMap((chunk) => (chunk.data as AttendanceRecordRow[] | null) ?? []);
    }
  }

  const statusMap = new Map<string, { status: string; note: string | null }>();
  records.forEach((record) => {
    statusMap.set(`${record.member_id}||${record.meeting_id}`, {
      status: record.status,
      note: record.note,
    });
  });

  const sortedDepartments = [...((departments as DepartmentRow[] | null) ?? [])].sort((a, b) =>
    compareDepartmentName(a.name, b.name),
  );
  const departmentIdByName = new Map(sortedDepartments.map((department) => [department.name, department.id]));

  const filteredSortedMembers = [...members]
    .filter((member) => {
      if (Number.isNaN(selectedDepartmentId)) {
        return true;
      }

      const memberDepartmentId = member.departments?.name
        ? departmentIdByName.get(member.departments.name)
        : null;
      return memberDepartmentId === selectedDepartmentId;
    })
    .sort((a, b) => {
      const depDiff = compareDepartmentName(a.departments?.name ?? null, b.departments?.name ?? null);
      if (depDiff !== 0) {
        return depDiff;
      }

      const genderDiff = compareGenderOrder(a.gender, b.gender);
      if (genderDiff !== 0) {
        return genderDiff;
      }

      return a.name.localeCompare(b.name, "ko");
    });

  return (
    <div className="space-y-6">
      <PageTitle
        title="출석 조회"
        description="시작일~종료일 범위에서 날짜별 출석 상태를 한 번에 조회합니다."
      />

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">모임 종류</span>
          <select
            name="meetingTypeId"
            defaultValue={selectedMeetingTypeId ? String(selectedMeetingTypeId) : ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            {(meetingTypes as MeetingTypeRow[] | null)?.map((meetingType) => (
              <option key={meetingType.id} value={meetingType.id}>
                {meetingType.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">시작일</span>
          <input
            name="from"
            type="date"
            defaultValue={fromDate}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">종료일</span>
          <input
            name="to"
            type="date"
            defaultValue={toDate}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">소속부서</span>
          <select
            name="departmentId"
            defaultValue={!Number.isNaN(selectedDepartmentId) ? String(selectedDepartmentId) : ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">전체</option>
            {sortedDepartments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button type="submit" className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            조회
          </button>
        </div>
      </form>

      {meetings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          해당 기간/모임 종류의 모임 데이터가 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">성별</th>
                <th className="px-3 py-2">소속부서</th>
                {meetings.map((meeting) => (
                  <th key={meeting.id} className="px-3 py-2 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span>{meeting.meeting_date}</span>
                      <Link
                        href={`/attendance/check?meetingTypeId=${selectedMeetingTypeId}&meetingDate=${meeting.meeting_date}`}
                        className="text-xs font-medium text-blue-700 underline"
                      >
                        수정/삭제
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredSortedMembers.map((member) => (
                <tr key={member.id}>
                  <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">{member.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{member.gender}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{member.departments?.name ?? "-"}</td>
                  {meetings.map((meeting) => {
                    const item = statusMap.get(`${member.id}||${meeting.id}`);
                    const status = item?.status ?? null;
                    return (
                      <td key={`${member.id}-${meeting.id}`} className="px-3 py-2 whitespace-nowrap">
                        <span
                          title={item?.note ?? undefined}
                          className={["inline-flex rounded-full px-2 py-1 text-xs font-semibold", statusClass(status)].join(" ")}
                        >
                          {status ?? "미기록"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredSortedMembers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          조건에 맞는 형제/자매 명단이 없습니다.
        </p>
      ) : null}
    </div>
  );
}
