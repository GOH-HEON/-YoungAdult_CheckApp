import Link from "next/link";

import { PageTitle } from "@/components/ui/page-title";
import { AttendanceReportCharts } from "@/components/reports/attendance-report-charts";
import { requireSession } from "@/lib/auth/session";
import { compareDepartmentName } from "@/lib/utils/department-order";
import { normalizeDateRange } from "@/lib/utils/date-range";
import {
  buildAbsenceSummary,
  buildDateSeries,
  buildMeetingTypeSeries,
} from "@/lib/reports/attendance-stats";
import { formatDateInputValue } from "@/lib/utils/format";

type ReportsPageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    summaryFrom?: string;
    summaryTo?: string;
    summaryDepartmentId?: string;
    meetingTypeId?: string;
    recentN?: string;
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

type MeetingRow = {
  id: string;
  meeting_date: string;
  meeting_type_id: number;
  meeting_types: {
    name: string;
  } | null;
};

type AttendanceRecordRow = {
  meeting_id: string;
  member_id: string;
  status: "정상출석" | "지각" | "결석" | "행사";
};

type ActiveMemberRow = {
  id: string;
  gender: "형제" | "자매";
  department_id: number | null;
  departments: {
    name: string;
  } | null;
};

type AbsenceRecordRow = {
  member_id: string;
  members: {
    name: string;
  } | null;
};

type GroupSummary = {
  date?: string;
  groupName: string;
  memberCount: number;
  totalSlots: number;
  정상출석: number;
  지각: number;
  결석: number;
  행사: number;
  미기록: number;
  attendanceRate: number;
};

function subtractDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateInputValue(date);
}

function createEmptySummary(groupName: string, memberCount: number, meetingCount: number): GroupSummary {
  return {
    groupName,
    memberCount,
    totalSlots: memberCount * meetingCount,
    정상출석: 0,
    지각: 0,
    결석: 0,
    행사: 0,
    미기록: 0,
    attendanceRate: 0,
  };
}

function finalizeSummary(summary: GroupSummary) {
  const recordedCount = summary.정상출석 + summary.지각 + summary.결석 + summary.행사;
  const 미기록 = Math.max(summary.totalSlots - recordedCount, 0);
  const attendanceBase = summary.totalSlots || 1;
  const attendanceRate = Number(
    (((summary.정상출석 + summary.지각 + summary.행사) / attendanceBase) * 100).toFixed(2),
  );

  return {
    ...summary,
    미기록,
    attendanceRate,
  };
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const { from: fromDate, to: toDate } = normalizeDateRange({
    fromCandidate: params.from,
    toCandidate: params.to,
    defaultFrom: subtractDays(60),
    defaultTo: formatDateInputValue(),
  });
  const { from: summaryFromDate, to: summaryToDate } = normalizeDateRange({
    fromCandidate: params.summaryFrom,
    toCandidate: params.summaryTo,
    defaultFrom: fromDate,
    defaultTo: toDate,
  });
  const selectedSummaryDepartmentId = Number.parseInt(params.summaryDepartmentId ?? "", 10);
  const selectedMeetingTypeId = Number(params.meetingTypeId ?? 0);
  const recentN = Number.parseInt(params.recentN ?? "6", 10) || 6;

  const { supabase } = await requireSession();

  const [{ data: meetingTypes }, { count: totalMembersCount }, { data: activeMembers }, { data: departments }] = await Promise.all([
    supabase.from("meeting_types").select("id, name").eq("is_active", true).order("name"),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("members").select("id, gender, department_id, departments(name)").eq("is_active", true),
    supabase.from("departments").select("id, name").eq("is_active", true),
  ]);

  let meetingsQuery = supabase
    .from("meetings")
    .select("id, meeting_date, meeting_type_id, meeting_types(name)")
    .gte("meeting_date", fromDate)
    .lte("meeting_date", toDate)
    .order("meeting_date", { ascending: true });

  if (!Number.isNaN(selectedMeetingTypeId) && selectedMeetingTypeId > 0) {
    meetingsQuery = meetingsQuery.eq("meeting_type_id", selectedMeetingTypeId);
  }

  const { data: meetings } = await meetingsQuery;
  const meetingIds = (meetings ?? []).map((meeting) => meeting.id);
  const attendanceRecords: AttendanceRecordRow[] = [];
  const absenceRecords: AbsenceRecordRow[] = [];

  if (meetingIds.length > 0) {
    const [recordChunks, absenceChunks] = await Promise.all([
      Promise.all(
        meetingIds.map((meetingId) =>
          supabase
            .from("attendance_records")
            .select("meeting_id, member_id, status")
            .eq("meeting_id", meetingId),
        ),
      ),
      Promise.all(
        meetingIds.slice(-recentN).map((meetingId) =>
          supabase
            .from("attendance_records")
            .select("member_id, members(name)")
            .eq("meeting_id", meetingId)
            .eq("status", "결석"),
        ),
      ),
    ]);

    recordChunks.forEach((chunk) => {
      attendanceRecords.push(...((chunk.data as AttendanceRecordRow[] | null) ?? []));
    });
    absenceChunks.forEach((chunk) => {
      absenceRecords.push(...((chunk.data as AbsenceRecordRow[] | null) ?? []));
    });
  }

  const meetingData = ((meetings as MeetingRow[] | null) ?? []).map((meeting) => ({
    id: meeting.id,
    meeting_date: meeting.meeting_date,
    meeting_type_name: meeting.meeting_types?.name ?? "미분류",
  }));

  const recordData = attendanceRecords.map((record) => ({
    meeting_id: record.meeting_id,
    member_id: record.member_id,
    status: record.status,
  }));

  const dateSeries = buildDateSeries(meetingData, recordData, totalMembersCount ?? 0);
  const meetingTypeSeries = buildMeetingTypeSeries(meetingData, recordData, totalMembersCount ?? 0);
  const absenceSummary = buildAbsenceSummary(
    absenceRecords.map((record) => ({
      member_id: record.member_id,
      member_name: record.members?.name ?? "이름 없음",
    })),
    10,
  );

  let summaryMeetingsQuery = supabase
    .from("meetings")
    .select("id, meeting_date, meeting_type_id, meeting_types(name)")
    .gte("meeting_date", summaryFromDate)
    .lte("meeting_date", summaryToDate)
    .order("meeting_date", { ascending: true });

  if (!Number.isNaN(selectedMeetingTypeId) && selectedMeetingTypeId > 0) {
    summaryMeetingsQuery = summaryMeetingsQuery.eq("meeting_type_id", selectedMeetingTypeId);
  }

  const { data: summaryMeetings } = await summaryMeetingsQuery;
  const summaryMeetingIds = (summaryMeetings ?? []).map((meeting) => meeting.id);
  const summaryAttendanceRecords: AttendanceRecordRow[] = [];

  if (summaryMeetingIds.length > 0) {
    const summaryChunks = await Promise.all(
      summaryMeetingIds.map((meetingId) =>
        supabase
          .from("attendance_records")
          .select("meeting_id, member_id, status")
          .eq("meeting_id", meetingId),
      ),
    );

    summaryChunks.forEach((chunk) => {
      summaryAttendanceRecords.push(...((chunk.data as AttendanceRecordRow[] | null) ?? []));
    });
  }

  const summaryMeetingRows = (summaryMeetings as MeetingRow[] | null) ?? [];
  const memberList = (activeMembers as ActiveMemberRow[] | null) ?? [];
  const summaryMemberList = memberList.filter((member) => {
    if (Number.isNaN(selectedSummaryDepartmentId)) {
      return true;
    }

    return member.department_id === selectedSummaryDepartmentId;
  });
  const sortedDepartments = [...((departments as DepartmentRow[] | null) ?? [])].sort((a, b) =>
    compareDepartmentName(a.name, b.name),
  );

  const memberProfileById = new Map(
    summaryMemberList.map((member) => [
      member.id,
      {
        departmentName: member.departments?.name ?? "미지정",
        gender: member.gender,
      },
    ]),
  );

  const departmentMemberCount = new Map<string, number>();
  summaryMemberList.forEach((member) => {
    const departmentName = member.departments?.name ?? "미지정";
    departmentMemberCount.set(departmentName, (departmentMemberCount.get(departmentName) ?? 0) + 1);
  });

  const meetingCountByDate = new Map<string, number>();
  const meetingDateById = new Map<string, string>();

  summaryMeetingRows.forEach((meeting) => {
    meetingDateById.set(meeting.id, meeting.meeting_date);
    meetingCountByDate.set(meeting.meeting_date, (meetingCountByDate.get(meeting.meeting_date) ?? 0) + 1);
  });

  const summaryDates = Array.from(meetingCountByDate.keys()).sort((a, b) => (a === b ? 0 : a > b ? -1 : 1));
  const departmentNames = Array.from(departmentMemberCount.keys()).sort(compareDepartmentName);
  const brotherCount = summaryMemberList.filter((member) => member.gender === "형제").length;
  const sisterCount = summaryMemberList.filter((member) => member.gender === "자매").length;

  const departmentSummaryByDate = new Map<string, Map<string, GroupSummary>>();
  const genderSummaryByDate = new Map<string, Map<"형제" | "자매", GroupSummary>>();

  summaryDates.forEach((date) => {
    const meetingCount = meetingCountByDate.get(date) ?? 0;
    const departmentMap = new Map<string, GroupSummary>();
    departmentNames.forEach((departmentName) => {
      departmentMap.set(
        departmentName,
        createEmptySummary(departmentName, departmentMemberCount.get(departmentName) ?? 0, meetingCount),
      );
    });
    departmentSummaryByDate.set(date, departmentMap);

    genderSummaryByDate.set(
      date,
      new Map<"형제" | "자매", GroupSummary>([
        ["형제", createEmptySummary("형제", brotherCount, meetingCount)],
        ["자매", createEmptySummary("자매", sisterCount, meetingCount)],
      ]),
    );
  });

  summaryAttendanceRecords.forEach((record) => {
    const meetingDate = meetingDateById.get(record.meeting_id);
    if (!meetingDate) {
      return;
    }

    const profile = memberProfileById.get(record.member_id);
    if (!profile) {
      return;
    }

    const departmentSummary = departmentSummaryByDate.get(meetingDate)?.get(profile.departmentName);
    if (departmentSummary) {
      departmentSummary[record.status] += 1;
    }

    const genderSummary = genderSummaryByDate.get(meetingDate)?.get(profile.gender);
    if (genderSummary) {
      genderSummary[record.status] += 1;
    }
  });

  const departmentDailySummary = summaryDates.flatMap((date) => {
    const departmentMap = departmentSummaryByDate.get(date);
    if (!departmentMap) {
      return [];
    }

    return Array.from(departmentMap.values())
      .map((item) => finalizeSummary(item))
      .sort((a, b) => compareDepartmentName(a.groupName, b.groupName))
      .map((item) => ({ ...item, date }));
  });

  const genderDailySummary = summaryDates.flatMap((date) => {
    const genderMap = genderSummaryByDate.get(date);
    if (!genderMap) {
      return [];
    }

    return (["형제", "자매"] as const)
      .map((gender) => genderMap.get(gender))
      .filter((item): item is GroupSummary => Boolean(item))
      .map((item) => ({ ...finalizeSummary(item), date }));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageTitle
          title="통계/리포트"
          description="날짜별 출석률, 모임별 출석률, 결석 누적자를 시각화합니다."
        />
        <Link
          href="/reports/score"
          className="inline-flex items-center justify-center rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
        >
          출석 점수판 보기
        </Link>
      </div>

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
        <input type="hidden" name="summaryFrom" value={summaryFromDate} />
        <input type="hidden" name="summaryTo" value={summaryToDate} />
        <input type="hidden" name="summaryDepartmentId" value={!Number.isNaN(selectedSummaryDepartmentId) ? String(selectedSummaryDepartmentId) : ""} />
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">시작일</span>
          <input
            name="from"
            type="date"
            defaultValue={fromDate}
            max={toDate}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">종료일</span>
          <input
            name="to"
            type="date"
            defaultValue={toDate}
            min={fromDate}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">모임 종류</span>
          <select
            name="meetingTypeId"
            defaultValue={!Number.isNaN(selectedMeetingTypeId) ? String(selectedMeetingTypeId) : "0"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="0">전체</option>
            {(meetingTypes as MeetingTypeRow[] | null)?.map((meetingType) => (
              <option key={meetingType.id} value={meetingType.id}>
                {meetingType.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">결석 집계 최근 N회</span>
          <input
            name="recentN"
            type="number"
            min={1}
            max={20}
            defaultValue={recentN}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <div className="flex items-end">
          <button type="submit" className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            통계 갱신
          </button>
        </div>
      </form>

      <AttendanceReportCharts dateSeries={dateSeries} meetingTypeSeries={meetingTypeSeries} />

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-base font-semibold text-slate-900">부서/형제·자매 현황 기간 필터</h3>
        <form className="mt-3 grid gap-3 md:grid-cols-6">
          <input type="hidden" name="from" value={fromDate} />
          <input type="hidden" name="to" value={toDate} />
          <input type="hidden" name="meetingTypeId" value={String(selectedMeetingTypeId)} />
          <input type="hidden" name="recentN" value={String(recentN)} />
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">시작일</span>
            <input
              name="summaryFrom"
              type="date"
              defaultValue={summaryFromDate}
              max={summaryToDate}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">종료일</span>
            <input
              name="summaryTo"
              type="date"
              defaultValue={summaryToDate}
              min={summaryFromDate}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">소속부서</span>
            <select
              name="summaryDepartmentId"
              defaultValue={!Number.isNaN(selectedSummaryDepartmentId) ? String(selectedSummaryDepartmentId) : ""}
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
              현황 기간 적용
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">부서별 출석 현황 (날짜별)</h3>
          <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[980px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-left text-slate-700">
                <tr>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">날짜</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">부서</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">인원</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">정상출석</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">지각</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">결석</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">행사</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">미기록</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">출석률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departmentDailySummary.map((item) => (
                  <tr key={`${item.date}-${item.groupName}`}>
                    <td className="px-3 py-2 font-medium text-slate-700">{item.date}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{item.groupName}</td>
                    <td className="px-3 py-2">{item.memberCount}</td>
                    <td className="px-3 py-2">{item.정상출석}</td>
                    <td className="px-3 py-2">{item.지각}</td>
                    <td className="px-3 py-2">{item.결석}</td>
                    <td className="px-3 py-2">{item.행사}</td>
                    <td className="px-3 py-2">{item.미기록}</td>
                    <td className="px-3 py-2">{item.attendanceRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {departmentDailySummary.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              조회 기간에 해당하는 출석 데이터가 없습니다.
            </p>
          ) : null}
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">형제/자매별 출석 현황 (날짜별)</h3>
          <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[980px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-left text-slate-700">
                <tr>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">날짜</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">구분</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">인원</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">정상출석</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">지각</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">결석</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">행사</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">미기록</th>
                  <th className="sticky top-0 bg-slate-100 px-3 py-2">출석률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {genderDailySummary.map((item) => (
                  <tr key={`${item.date}-${item.groupName}`}>
                    <td className="px-3 py-2 font-medium text-slate-700">{item.date}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{item.groupName}</td>
                    <td className="px-3 py-2">{item.memberCount}</td>
                    <td className="px-3 py-2">{item.정상출석}</td>
                    <td className="px-3 py-2">{item.지각}</td>
                    <td className="px-3 py-2">{item.결석}</td>
                    <td className="px-3 py-2">{item.행사}</td>
                    <td className="px-3 py-2">{item.미기록}</td>
                    <td className="px-3 py-2">{item.attendanceRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {genderDailySummary.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              조회 기간에 해당하는 출석 데이터가 없습니다.
            </p>
          ) : null}
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">결석 누적자 목록</h3>
        <p className="mt-1 text-sm text-slate-600">최근 {recentN}회 모임 기준 결석 횟수 집계</p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">결석 횟수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {absenceSummary.map((item) => (
                <tr key={item.memberId}>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.memberName}</td>
                  <td className="px-3 py-2">{item.absenceCount}회</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {absenceSummary.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            결석 누적 데이터가 없습니다.
          </p>
        ) : null}
      </section>
    </div>
  );
}
