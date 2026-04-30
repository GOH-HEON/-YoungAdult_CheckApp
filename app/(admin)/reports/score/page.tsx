import Link from "next/link";

import { PageTitle } from "@/components/ui/page-title";
import {
  buildMemberScoreTable,
  buildScoreOverview,
  sortMemberScoreTable,
  type MemberScorePoint,
} from "@/lib/reports/attendance-stats";
import { createPageReadClient, requireSession } from "@/lib/auth/session";
import { compareDepartmentName } from "@/lib/utils/department-order";
import { normalizeDateRange } from "@/lib/utils/date-range";
import { formatDateInputValue } from "@/lib/utils/format";

type ScorePageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    meetingTypeId?: string;
    departmentId?: string;
    recentN?: string;
    sortBy?: string;
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

type ActiveMemberRow = {
  id: string;
  name: string;
  gender: "형제" | "자매";
  department_id: number | null;
  departments: {
    name: string;
  } | null;
};

type AttendanceRecordRow = {
  meeting_id: string;
  member_id: string;
  status: "정상출석" | "지각" | "결석" | "행사";
};

type ScoreSortOption =
  | "scoreRateDesc"
  | "scoreRateAsc"
  | "totalScoreDesc"
  | "nameAsc"
  | "absenceDesc"
  | "missingDesc";

const sortOptions: Array<{ value: ScoreSortOption; label: string }> = [
  { value: "scoreRateDesc", label: "평균 점수 높은 순" },
  { value: "scoreRateAsc", label: "평균 점수 낮은 순" },
  { value: "totalScoreDesc", label: "총점 높은 순" },
  { value: "absenceDesc", label: "결석 많은 순" },
  { value: "missingDesc", label: "미기록 많은 순" },
  { value: "nameAsc", label: "이름순" },
];

function subtractDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDateInputValue(date);
}

function clampRecentN(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) {
    return 8;
  }

  return Math.max(0, Math.min(parsed, 100));
}

function parseOptionalNumber(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveSortBy(value: string | undefined): ScoreSortOption {
  return sortOptions.some((option) => option.value === value) ? (value as ScoreSortOption) : "scoreRateDesc";
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-3 text-sm font-medium text-slate-500">{description}</p>
    </article>
  );
}

function ScoreBadge({ row }: { row: MemberScorePoint }) {
  const classes =
    row.scoreRate >= 80
      ? "bg-blue-100 text-blue-700"
      : row.scoreRate >= 50
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-100 text-rose-700";

  return <span className={["inline-flex rounded-lg px-3 py-1 text-sm font-bold", classes].join(" ")}>{row.scoreRate.toFixed(1)}점</span>;
}

function MiniList({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: MemberScorePoint[];
}) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
      <h3 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row.memberId} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <p className="font-semibold text-slate-950">{row.memberName}</p>
              <p className="text-sm text-slate-500">
                {row.departmentName} · 정상 {row.정상출석} · 지각 {row.지각} · 행사 {row.행사} · 미기록 {row.미기록}
              </p>
            </div>
            <ScoreBadge row={row} />
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-slate-500">집계할 데이터가 없습니다.</p> : null}
      </div>
    </article>
  );
}

export default async function ScorePage({ searchParams }: ScorePageProps) {
  const params = await searchParams;
  const { from, to } = normalizeDateRange({
    fromCandidate: params.from,
    toCandidate: params.to,
    defaultFrom: subtractDays(120),
    defaultTo: formatDateInputValue(),
  });
  const selectedMeetingTypeId = parseOptionalNumber(params.meetingTypeId);
  const selectedDepartmentId = parseOptionalNumber(params.departmentId);
  const recentN = clampRecentN(params.recentN);
  const sortBy = resolveSortBy(params.sortBy);

  const session = await requireSession();
  const supabase = createPageReadClient(session.appUser, session.supabase);

  const [{ data: meetingTypes }, { data: departments }, { data: activeMembers }] = await Promise.all([
    supabase.from("meeting_types").select("id, name").eq("is_active", true).order("name"),
    supabase.from("departments").select("id, name").eq("is_active", true),
    supabase.from("members").select("id, name, gender, department_id, departments(name)").eq("is_active", true),
  ]);

  let meetingsQuery = supabase
    .from("meetings")
    .select("id, meeting_date, meeting_type_id, meeting_types(name)")
    .gte("meeting_date", from)
    .lte("meeting_date", to)
    .order("meeting_date", { ascending: false });

  if ((selectedMeetingTypeId ?? 0) > 0) {
    meetingsQuery = meetingsQuery.eq("meeting_type_id", selectedMeetingTypeId ?? 0);
  }

  const meetingRowsDesc = ((await meetingsQuery).data as MeetingRow[] | null) ?? [];
  const selectedMeetingRowsDesc = recentN > 0 ? meetingRowsDesc.slice(0, recentN) : meetingRowsDesc;
  const selectedMeetingRows = [...selectedMeetingRowsDesc].sort((a, b) => a.meeting_date.localeCompare(b.meeting_date, "ko"));
  const meetingIds = selectedMeetingRows.map((meeting) => meeting.id);

  const memberRows = ((activeMembers as ActiveMemberRow[] | null) ?? []).filter((member) => {
    if ((selectedDepartmentId ?? 0) <= 0) {
      return true;
    }

    return member.department_id === selectedDepartmentId;
  });

  const attendanceRows =
    meetingIds.length > 0
      ? (((await supabase.from("attendance_records").select("meeting_id, member_id, status").in("meeting_id", meetingIds))
          .data as AttendanceRecordRow[] | null) ?? [])
      : [];

  const scoreRows = buildMemberScoreTable(
    memberRows.map((member) => ({
      id: member.id,
      name: member.name,
      gender: member.gender,
      departmentName: member.departments?.name ?? "미지정",
    })),
    selectedMeetingRows.map((meeting) => ({
      id: meeting.id,
      meeting_date: meeting.meeting_date,
    })),
    attendanceRows,
  );

  const sortedScoreRows = sortMemberScoreTable(scoreRows, sortBy);
  const scoreOverview = buildScoreOverview(scoreRows);
  const topScoreRows = sortMemberScoreTable(scoreRows, "scoreRateDesc").slice(0, 5);
  const lowScoreRows = sortMemberScoreTable(scoreRows, "scoreRateAsc").slice(0, 5);
  const sortedDepartments = [...((departments as DepartmentRow[] | null) ?? [])].sort((a, b) =>
    compareDepartmentName(a.name, b.name),
  );
  const meetingRangeLabel =
    selectedMeetingRows.length > 0
      ? `${selectedMeetingRows[0]?.meeting_date ?? "-"} ~ ${selectedMeetingRows[selectedMeetingRows.length - 1]?.meeting_date ?? "-"}`
      : "집계된 모임 없음";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageTitle
          title="출석 점수"
          description="인원별 출석 점수를 기간과 조건별로 확인하고, 관리가 필요한 대상을 빠르게 찾습니다."
        />
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            대시보드
          </Link>
          <Link
            href="/reports"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            리포트
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <form className="grid gap-3 md:grid-cols-6 xl:grid-cols-7">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">시작일</span>
            <input
              name="from"
              type="date"
              defaultValue={from}
              max={to}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">종료일</span>
            <input
              name="to"
              type="date"
              defaultValue={to}
              min={from}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">모임 종류</span>
            <select
              name="meetingTypeId"
              defaultValue={String(selectedMeetingTypeId ?? 0)}
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
            <span className="font-medium text-slate-700">소속부서</span>
            <select
              name="departmentId"
              defaultValue={String(selectedDepartmentId ?? 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="0">전체</option>
              {sortedDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">최근 N회</span>
            <input
              name="recentN"
              type="number"
              min={0}
              max={100}
              defaultValue={recentN}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <p className="text-xs text-slate-500">0이면 기간 전체</p>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">정렬</span>
            <select name="sortBy" defaultValue={sortBy} className="w-full rounded-lg border border-slate-300 px-3 py-2">
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              점수판 갱신
            </button>
          </div>
        </form>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          집계 기간: <span className="font-semibold text-slate-900">{meetingRangeLabel}</span>
          <span className="mx-2 text-slate-300">|</span>
          기본 정렬 추천: <span className="font-semibold text-slate-900">평균 점수 높은 순</span>
          <span className="mx-2 text-slate-300">|</span>
          미기록은 점수와 별도로 관리 대상으로 확인하세요.
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="집계 모임 수"
          value={`${scoreOverview.meetingCount}회`}
          description={recentN > 0 ? `최근 ${recentN}회 우선 적용` : "선택 기간 전체 기준"}
        />
        <SummaryCard
          title="집계 인원"
          value={`${scoreOverview.memberCount}명`}
          description="선택한 부서/활성 인원 기준"
        />
        <SummaryCard
          title="평균 출석 점수"
          value={`${scoreOverview.averageScoreRate.toFixed(1)}점`}
          description={`원점수 평균 ${scoreOverview.averageScore.toFixed(3)}`}
        />
        <SummaryCard
          title="최고 누적 점수"
          value={scoreOverview.highestScore.toFixed(1)}
          description="현재 집계 범위 기준"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <MiniList title="출석 점수 상위 5명" description="평균 점수가 높은 순서입니다." rows={topScoreRows} />
        <MiniList
          title="관리 필요 5명"
          description="평균 점수 오름차순, 같은 점수에서는 미기록이 많은 순서입니다."
          rows={lowScoreRows}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-2xl font-medium tracking-tight text-slate-950">인원별 점수표</h3>
          <p className="mt-1 text-sm text-slate-500">
            정상출석 1점 · 지각 0.5점 · 행사 0.2점 · 결석 0점. 미기록은 별도 관리용으로 분리해 표시합니다.
          </p>
        </div>

        <div className="max-h-[720px] overflow-auto">
          <table className="w-full min-w-[1280px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-700">
              <tr>
                <th className="sticky top-0 bg-slate-50 px-4 py-3">이름</th>
                <th className="sticky top-0 bg-slate-50 px-4 py-3">부서</th>
                <th className="sticky top-0 bg-slate-50 px-4 py-3">집계 모임</th>
                <th className="sticky top-0 bg-slate-50 px-4 py-3">정상출석</th>
                <th className="sticky top-0 bg-slate-50 px-4 py-3">지각</th>
                <th className="sticky top-0 bg-slate-50 px-4 py-3">행사</th>
                <th className="sticky top-0 bg-slate-50 px-4 py-3">결석</th>
                <th className="sticky top-0 bg-slate-50 px-4 py-3">미기록</th>
                <th className="sticky top-0 bg-slate-50 px-4 py-3">총점</th>
                <th className="sticky top-0 bg-slate-50 px-4 py-3">평균 점수</th>
                <th className="sticky top-0 bg-slate-50 px-4 py-3">점수율</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedScoreRows.map((row) => (
                <tr key={row.memberId} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-semibold text-slate-950">{row.memberName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.departmentName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.totalMeetings}</td>
                  <td className="px-4 py-3 text-slate-600">{row.정상출석}</td>
                  <td className="px-4 py-3 text-slate-600">{row.지각}</td>
                  <td className="px-4 py-3 text-slate-600">{row.행사}</td>
                  <td className="px-4 py-3 text-slate-600">{row.결석}</td>
                  <td className="px-4 py-3 text-slate-600">{row.미기록}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.totalScore.toFixed(1)}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{row.averageScore.toFixed(3)}</td>
                  <td className="px-4 py-3">
                    <ScoreBadge row={row} />
                  </td>
                </tr>
              ))}
              {sortedScoreRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-slate-500" colSpan={11}>
                    선택한 조건에 해당하는 점수 데이터가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
