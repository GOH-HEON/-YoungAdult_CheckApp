import { PageTitle } from "@/components/ui/page-title";
import { PrintTrigger } from "@/components/ui/print-trigger";
import { requireSession } from "@/lib/auth/session";
import { compareDepartmentName } from "@/lib/utils/department-order";
import { formatDateInputValue } from "@/lib/utils/format";

type AttendancePrintPageProps = {
  searchParams: Promise<{
    meetingTypeId?: string;
    meetingDate?: string;
    departmentId?: string;
  }>;
};

type MeetingTypeRow = {
  id: number;
  name: string;
};

type DepartmentRow = {
  id: number;
  name: string;
};

type MemberRow = {
  id: string;
  name: string;
  gender: "형제" | "자매";
  department_id: number | null;
  departments: {
    name: string;
  } | null;
};

type AttendanceRecordRow = {
  member_id: string;
  status: "정상출석" | "지각" | "결석" | "행사";
  note: string | null;
};

type SheetMember = {
  id: string;
  name: string;
  gender: "형제" | "자매";
  departmentId: number | null;
  departmentName: string;
};

type DepartmentSheetGroup = {
  departmentId: number | null;
  departmentName: string;
  brothers: SheetMember[];
  sisters: SheetMember[];
};

function toPrintableValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export default async function AttendancePrintPage({ searchParams }: AttendancePrintPageProps) {
  const params = await searchParams;
  const { supabase } = await requireSession();

  const [{ data: meetingTypes }, { data: departments }, { data: members }] = await Promise.all([
    supabase.from("meeting_types").select("id, name").eq("is_active", true).order("name"),
    supabase.from("departments").select("id, name"),
    supabase
      .from("members")
      .select("id, name, gender, department_id, departments(name)")
      .eq("is_active", true)
      .order("name"),
  ]);

  const preferredMeetingTypeId = ((meetingTypes as MeetingTypeRow[] | null) ?? []).find(
    (meetingType) => meetingType.name === "청년회 모임",
  )?.id;
  const selectedMeetingTypeId = Number(
    params.meetingTypeId ?? preferredMeetingTypeId ?? meetingTypes?.[0]?.id ?? 0,
  );
  const selectedMeetingDate = params.meetingDate ?? formatDateInputValue();
  const selectedDepartmentId = Number.parseInt(params.departmentId ?? "", 10);

  const normalizedMembers = ((members as MemberRow[] | null) ?? []).map<SheetMember>((member) => ({
    id: member.id,
    name: member.name,
    gender: member.gender,
    departmentId: member.department_id,
    departmentName: member.departments?.name ?? "미지정",
  }));

  const filteredMembers = normalizedMembers.filter((member) => {
    if (Number.isNaN(selectedDepartmentId)) {
      return true;
    }

    return member.departmentId === selectedDepartmentId;
  });

  const selectedMeetingType = ((meetingTypes as MeetingTypeRow[] | null) ?? []).find(
    (meetingType) => meetingType.id === selectedMeetingTypeId,
  );

  const attendanceMap = new Map<string, AttendanceRecordRow>();
  if (selectedMeetingTypeId && selectedMeetingDate) {
    const { data: meeting } = await supabase
      .from("meetings")
      .select("id")
      .eq("meeting_type_id", selectedMeetingTypeId)
      .eq("meeting_date", selectedMeetingDate)
      .maybeSingle();

    if (meeting) {
      const { data: records } = await supabase
        .from("attendance_records")
        .select("member_id, status, note")
        .eq("meeting_id", meeting.id);

      ((records as AttendanceRecordRow[] | null) ?? []).forEach((record) => {
        attendanceMap.set(record.member_id, record);
      });
    }
  }

  const groupsMap = new Map<string, DepartmentSheetGroup>();
  filteredMembers.forEach((member) => {
    const key = `${member.departmentId ?? "none"}::${member.departmentName}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        departmentId: member.departmentId,
        departmentName: member.departmentName,
        brothers: [],
        sisters: [],
      });
    }

    const group = groupsMap.get(key);
    if (!group) {
      return;
    }

    if (member.gender === "형제") {
      group.brothers.push(member);
    } else {
      group.sisters.push(member);
    }
  });

  groupsMap.forEach((group) => {
    group.brothers.sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
    group.sisters.sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
  });

  const departmentGroups = Array.from(groupsMap.values()).sort((a, b) =>
    compareDepartmentName(a.departmentName, b.departmentName),
  );

  const sortedDepartments = [...((departments as DepartmentRow[] | null) ?? [])].sort((a, b) =>
    compareDepartmentName(a.name, b.name),
  );
  const selectedDepartment = sortedDepartments.find((department) => department.id === selectedDepartmentId);

  if (
    departmentGroups.length === 0 &&
    !Number.isNaN(selectedDepartmentId) &&
    selectedDepartment
  ) {
    departmentGroups.push({
      departmentId: selectedDepartment.id,
      departmentName: selectedDepartment.name,
      brothers: [],
      sisters: [],
    });
  }

  return (
    <div className="attendance-print-root space-y-6">
      <div className="no-print">
        <PageTitle
          title="출석부 인쇄"
          description="부서별 형제/자매 출석부를 A4 세로 양식으로 인쇄합니다."
        />
      </div>

      <section className="no-print rounded-xl border border-slate-200 bg-slate-50 p-4">
        <form className="grid gap-3 md:grid-cols-5">
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
            <span className="font-medium text-slate-700">날짜</span>
            <input
              name="meetingDate"
              type="date"
              defaultValue={selectedMeetingDate}
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
              <option value="">전체 부서</option>
              {sortedDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            >
              양식 불러오기
            </button>
          </div>

          <div className="flex items-end">
            <PrintTrigger label="A4 인쇄" className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" />
          </div>
        </form>
      </section>

      {departmentGroups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          인쇄할 명단이 없습니다. 필터 조건을 확인해 주세요.
        </p>
      ) : (
        <div className="print-group-list space-y-4">
          {departmentGroups.map((group) => {
            const rowCount = Math.max(group.brothers.length, group.sisters.length, 1);
            const rows = Array.from({ length: rowCount }, (_, index) => {
              const brother = group.brothers[index];
              const sister = group.sisters[index];
              const brotherRecord = brother ? attendanceMap.get(brother.id) : null;
              const sisterRecord = sister ? attendanceMap.get(sister.id) : null;

              return {
                key: `${group.departmentName}-${index}`,
                brotherName: brother?.name ?? "",
                brotherStatus: toPrintableValue(brotherRecord?.status),
                brotherNote: toPrintableValue(brotherRecord?.note),
                sisterName: sister?.name ?? "",
                sisterStatus: toPrintableValue(sisterRecord?.status),
                sisterNote: toPrintableValue(sisterRecord?.note),
              };
            });

            return (
              <section
                key={`${group.departmentId ?? "none"}-${group.departmentName}`}
                className="print-sheet rounded-xl border border-slate-700 bg-white p-4"
              >
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <h3 className="print-sheet-title text-lg font-bold text-slate-900">{group.departmentName} 출석부</h3>
                  <p className="print-sheet-meta text-sm text-slate-700">
                    모임: {selectedMeetingType?.name ?? "미지정"} / 날짜: {selectedMeetingDate}
                  </p>
                </div>

                <table className="w-full border-collapse border border-slate-700 text-sm">
                  <colgroup>
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "25%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th colSpan={3} className="border border-slate-700 bg-slate-100 px-2 py-2 text-center font-semibold">
                        형제
                      </th>
                      <th colSpan={3} className="border border-slate-700 bg-slate-100 px-2 py-2 text-center font-semibold">
                        자매
                      </th>
                    </tr>
                    <tr>
                      <th className="border border-slate-700 px-2 py-2 text-center font-semibold">이름</th>
                      <th className="border border-slate-700 px-2 py-2 text-center font-semibold">출석</th>
                      <th className="border border-slate-700 px-2 py-2 text-center font-semibold">비고</th>
                      <th className="border border-slate-700 px-2 py-2 text-center font-semibold">이름</th>
                      <th className="border border-slate-700 px-2 py-2 text-center font-semibold">출석</th>
                      <th className="border border-slate-700 px-2 py-2 text-center font-semibold">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.key}>
                        <td className="h-8 border border-slate-700 px-2 py-1 text-center">{row.brotherName}</td>
                        <td className="h-8 border border-slate-700 px-2 py-1 text-center">{row.brotherStatus}</td>
                        <td className="h-8 border border-slate-700 px-2 py-1">{row.brotherNote}</td>
                        <td className="h-8 border border-slate-700 px-2 py-1 text-center">{row.sisterName}</td>
                        <td className="h-8 border border-slate-700 px-2 py-1 text-center">{row.sisterStatus}</td>
                        <td className="h-8 border border-slate-700 px-2 py-1">{row.sisterNote}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
      )}

      <style>{`
        @page {
          size: A4 portrait;
          margin: 6mm;
        }

        @media print {
          header,
          aside {
            display: none !important;
          }

          main {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .no-print {
            display: none !important;
          }

          .attendance-print-root {
            margin: 0 !important;
            padding: 0 !important;
            font-size: 10px !important;
            line-height: 1.15 !important;
          }

          .print-sheet {
            border-radius: 0 !important;
            break-after: page;
            page-break-after: always;
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none !important;
            padding: 2.5mm !important;
          }

          .print-sheet:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          .print-sheet-title {
            font-size: 11px !important;
            line-height: 1.2 !important;
          }

          .print-sheet-meta {
            font-size: 9px !important;
            line-height: 1.1 !important;
          }

          .print-sheet table {
            font-size: 9px !important;
          }

          .print-sheet th,
          .print-sheet td {
            padding: 1.2mm !important;
          }
        }
      `}</style>
    </div>
  );
}
