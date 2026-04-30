import Link from "next/link";

import { PageTitle } from "@/components/ui/page-title";
import { Icon } from "@/components/ui/icon";
import { canWrite, requireSession } from "@/lib/auth/session";
import {
  buildMemberScoreTable,
  buildScoreOverview,
  sortMemberScoreTable,
  type MemberScorePoint,
} from "@/lib/reports/attendance-stats";
import { formatDate } from "@/lib/utils/format";

type RecentNewcomer = {
  id: string;
  registered_at: string;
  members: {
    id: string;
    name: string;
    departments: {
      name: string;
    } | null;
  } | null;
};

type AbsenceRecord = {
  member_id: string;
  members: {
    name: string;
  } | null;
};

type ActiveMemberRow = {
  id: string;
  name: string;
  gender: "형제" | "자매";
  departments: {
    name: string;
  } | null;
};

type MeetingRow = {
  id: string;
  meeting_date: string;
  title: string;
  meeting_types: {
    name: string;
  } | null;
};

type AttendanceRecordRow = {
  meeting_id: string;
  member_id: string;
  status: "정상출석" | "지각" | "결석" | "행사";
};

type StatCardProps = {
  title: string;
  value: string;
  caption: string;
  icon: React.ReactNode;
  iconClassName?: string;
  valueClassName?: string;
  accentClassName?: string;
};

function getInitials(name: string) {
  const compact = name.trim().replace(/\s+/g, " ");
  if (!compact) return "U";

  const parts = compact.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return compact.slice(0, 2).toUpperCase();
}

function Avatar({ name, tone = "neutral" }: { name: string; tone?: "neutral" | "rose" | "blue" | "amber" }) {
  const initials = getInitials(name);

  const toneClasses = {
    neutral: "bg-slate-100 text-slate-500",
    rose: "bg-rose-50 text-rose-600 ring-1 ring-rose-100",
    blue: "bg-blue-50 text-blue-600 ring-1 ring-blue-100",
    amber: "bg-amber-50 text-amber-600 ring-1 ring-amber-100",
  } as const;

  return (
    <div
      className={[
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        toneClasses[tone],
      ].join(" ")}
    >
      {initials}
    </div>
  );
}

function StatCard({
  title,
  value,
  caption,
  icon,
  iconClassName = "bg-blue-50 text-[#2563eb]",
  valueClassName = "text-slate-950",
  accentClassName = "text-slate-500",
}: StatCardProps) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-8 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</p>
          <p className={["mt-3 text-5xl font-bold tracking-tight", valueClassName].join(" ")}>{value}</p>
          <p className={["mt-3 text-sm font-semibold", accentClassName].join(" ")}>{caption}</p>
        </div>
        <div className={["flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl", iconClassName].join(" ")}>
          {icon}
        </div>
      </div>
    </article>
  );
}

function ActionCard({
  href,
  title,
  description,
  icon,
  highlighted = false,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "group rounded-2xl border p-6 text-left shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08)]",
        highlighted
          ? "border-blue-100 bg-blue-50 hover:border-blue-200"
          : "border-slate-100 bg-white hover:border-blue-200",
      ].join(" ")}
    >
      <div
        className={[
          "mb-6 flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
          highlighted ? "bg-[#2563eb] text-white" : "border border-slate-200 bg-white text-slate-600",
        ].join(" ")}
      >
        {icon}
      </div>
      <p className={["mb-2 text-xl font-semibold tracking-tight", highlighted ? "text-[#1e3a8a]" : "text-slate-950"].join(" ")}>
        {title}
      </p>
      <p className={["text-sm leading-6", highlighted ? "text-blue-700/70" : "text-slate-500"].join(" ")}>{description}</p>
    </Link>
  );
}

function ScoreListCard({
  title,
  description,
  rows,
  emptyMessage,
  href,
  tone,
}: {
  title: string;
  description: string;
  rows: MemberScorePoint[];
  emptyMessage: string;
  href: string;
  tone: "blue" | "rose";
}) {
  const toneClasses =
    tone === "blue"
      ? {
          badge: "bg-blue-100 text-blue-700",
          subtle: "text-blue-600",
          avatar: "blue" as const,
        }
      : {
          badge: "bg-rose-100 text-rose-700",
          subtle: "text-rose-600",
          avatar: "rose" as const,
        };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div className="min-w-0">
          <h3 className="text-[1.8rem] font-semibold tracking-tight text-slate-950">{title}</h3>
          <p className="mt-1.5 max-w-[24rem] text-sm leading-5 text-slate-500">{description}</p>
        </div>
        <Link
          href={href}
          className="shrink-0 pt-1 text-sm font-semibold text-slate-900 transition hover:text-[#1d4ed8]"
        >
          자세히 보기
        </Link>
      </div>

      <div className="space-y-3 p-5">
        {rows.map((item, index) => (
          <div
            key={item.memberId}
            className={[
              "grid grid-cols-[minmax(0,1fr)_108px] items-center gap-4 rounded-2xl border px-4 py-3",
              index === 0 ? "border-blue-100 bg-slate-50" : "border-slate-100 bg-white",
            ].join(" ")}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <Avatar name={item.memberName} tone={toneClasses.avatar} />
                  <p className="truncate text-[1.05rem] font-semibold tracking-tight text-slate-950">{item.memberName}</p>
                </div>
                <p className="mt-1 truncate text-[13px] font-medium text-slate-500">{item.departmentName}</p>
                <p className="mt-1 truncate text-[13px] leading-5 text-slate-500">
                  정 {item.정상출석} · 지 {item.지각} · 행 {item.행사} · 미 {item.미기록}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span
                className={[
                  "inline-flex min-w-[84px] justify-center rounded-xl px-3 py-1.5 text-base font-bold tracking-tight tabular-nums",
                  toneClasses.badge,
                ].join(" ")}
              >
                {item.scoreRate.toFixed(1)}점
              </span>
              <p className={["mt-2 text-xs font-bold tracking-[0.16em]", toneClasses.subtle].join(" ")}>
                총점 {item.totalScore.toFixed(1)}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">/ {item.totalMeetings.toFixed(0)}</p>
            </div>
          </div>
        ))}

        {rows.length === 0 ? <p className="text-sm text-slate-500">{emptyMessage}</p> : null}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const { supabase, appUser } = await requireSession();
  const canManage = canWrite(appUser);

  const [{ data: activeMembers }, { data: latestMeeting }, { data: recentNewcomers }, { data: recentAbsenceMeetings }, { data: recentScoreMeetings }] =
    await Promise.all([
      supabase.from("members").select("id, name, gender, departments(name)").eq("is_active", true),
      supabase
        .from("meetings")
        .select("id, meeting_date, title, meeting_types(name)")
        .order("meeting_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("newcomer_profiles")
        .select("id, registered_at, members(id, name, departments(name))")
        .order("registered_at", { ascending: false })
        .limit(5),
      supabase.from("meetings").select("id, meeting_date").order("meeting_date", { ascending: false }).limit(4),
      supabase.from("meetings").select("id, meeting_date").order("meeting_date", { ascending: false }).limit(8),
    ]);

  const normalizedActiveMembers = (activeMembers as ActiveMemberRow[] | null) ?? [];
  const totalActiveMembers = normalizedActiveMembers.length;
  const absenceMeetingIds = (recentAbsenceMeetings as Pick<MeetingRow, "id">[] | null)?.map((meeting) => meeting.id) ?? [];
  const scoreMeetings = ((recentScoreMeetings as Pick<MeetingRow, "id" | "meeting_date">[] | null) ?? []).map((meeting) => ({
    id: meeting.id,
    meeting_date: meeting.meeting_date,
  }));

  const [latestRecordsResponse, absenceRowsResponse, scoreRowsResponse] = await Promise.all([
    latestMeeting?.id
      ? supabase
          .from("attendance_records")
          .select("status")
          .eq("meeting_id", latestMeeting.id)
          .in("status", ["정상출석", "지각", "행사"])
      : Promise.resolve({ data: [] as Array<{ status: string }> }),
    absenceMeetingIds.length > 0
      ? supabase
          .from("attendance_records")
          .select("member_id, members(name)")
          .in("meeting_id", absenceMeetingIds)
          .eq("status", "결석")
      : Promise.resolve({ data: [] as AbsenceRecord[] }),
    scoreMeetings.length > 0
      ? supabase
          .from("attendance_records")
          .select("meeting_id, member_id, status")
          .in(
            "meeting_id",
            scoreMeetings.map((meeting) => meeting.id),
          )
      : Promise.resolve({ data: [] as AttendanceRecordRow[] }),
  ]);

  const latestAttendanceRate =
    latestMeeting?.id && totalActiveMembers > 0
      ? (((latestRecordsResponse.data?.length ?? 0) / totalActiveMembers) * 100)
      : 0;

  const absentees = Array.from(
    (((absenceRowsResponse.data as AbsenceRecord[] | null) ?? []).reduce((grouped, row) => {
      const prev = grouped.get(row.member_id);
      grouped.set(row.member_id, {
        memberId: row.member_id,
        name: row.members?.name ?? "이름 없음",
        absenceCount: (prev?.absenceCount ?? 0) + 1,
      });
      return grouped;
    }, new Map<string, { memberId: string; name: string; absenceCount: number }>())).values(),
  )
    .sort((a, b) => b.absenceCount - a.absenceCount)
    .slice(0, 5);

  const scoreTable = buildMemberScoreTable(
    normalizedActiveMembers.map((member) => ({
      id: member.id,
      name: member.name,
      gender: member.gender,
      departmentName: member.departments?.name ?? "미지정",
    })),
    scoreMeetings,
    (scoreRowsResponse.data as AttendanceRecordRow[] | null) ?? [],
  );

  const scoreOverview = buildScoreOverview(scoreTable);
  const topScoreRows = sortMemberScoreTable(scoreTable, "scoreRateDesc").slice(0, 5);
  const lowScoreRows = sortMemberScoreTable(scoreTable, "scoreRateAsc").slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10">
      <PageTitle title="대시보드" description="운영 핵심 지표를 한눈에 확인합니다." />

      <section className="grid gap-6 md:grid-cols-3">
        <StatCard
          title="전체 활성 형제/자매 수"
          value={`${totalActiveMembers}명`}
          caption="현재 활성 상태 기준"
          icon={<Icon name="members" className="h-8 w-8" />}
          iconClassName="bg-blue-50 text-[#2563eb]"
        />

        <article className="rounded-2xl border border-slate-100 bg-white p-8 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">최근 모임 출석률</p>
            <span className="text-2xl font-bold tracking-tight text-[#2563eb]">{latestAttendanceRate.toFixed(1)}%</span>
          </div>
          <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#2563eb] transition-[width] duration-500"
              style={{ width: `${Math.min(latestAttendanceRate, 100)}%` }}
            />
          </div>
          <p className="text-lg leading-7 text-slate-500">
            {latestMeeting ? `${latestMeeting.title} · ${formatDate(latestMeeting.meeting_date)}` : "최근 모임 없음"}
          </p>
        </article>

        <StatCard
          title="최근 등록 새가족"
          value={`${recentNewcomers?.length ?? 0}명`}
          caption="최근 5건 기준"
          icon={<Icon name="plus-user" className="h-8 w-8" />}
          iconClassName="bg-amber-50 text-[#f59e0b]"
          accentClassName="text-blue-600"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_1fr_1fr]">
        <article className="rounded-2xl border border-slate-100 bg-white p-8 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">최근 출석 점수</p>
              <p className="mt-4 text-6xl font-bold tracking-tight text-slate-950 tabular-nums">
                {scoreOverview.averageScoreRate.toFixed(1)}점
              </p>
              <p className="mt-4 max-w-[28rem] text-[15px] leading-7 text-slate-500">
                최근 {scoreOverview.meetingCount}회 평균 기준 · 정상출석 1점 / 지각 0.5점 / 행사 0.2점
              </p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#2563eb] shadow-inner shadow-blue-100/70">
              <Icon name="reports" className="h-9 w-9" />
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">평균 원점수</p>
              <p className="mt-3 text-[2rem] font-bold tracking-tight text-slate-950 tabular-nums">{scoreOverview.averageScore.toFixed(3)}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">최고 누적 점수</p>
              <p className="mt-3 text-[2rem] font-bold tracking-tight text-slate-950 tabular-nums">{scoreOverview.highestScore.toFixed(1)}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">집계 인원</p>
              <p className="mt-3 text-[2rem] font-bold tracking-tight text-slate-950 tabular-nums">{scoreOverview.memberCount}명</p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-5">
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight text-[#1e3a8a]">인원별 출석 점수판으로 이동</p>
              <p className="mt-2 max-w-[26rem] text-[15px] leading-6 text-blue-700/80">
                기간, 부서, 정렬 조건으로 전체 명단을 자세히 볼 수 있습니다.
              </p>
            </div>
            <Link
              href="/reports/score"
              className="shrink-0 rounded-2xl bg-[#2563eb] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              점수판 보기
            </Link>
          </div>
        </article>

        <ScoreListCard
          title="출석 점수 상위 5명"
          description="최근 집계 범위에서 평균 점수가 높은 순서입니다."
          rows={topScoreRows}
          emptyMessage="점수 집계 데이터가 없습니다."
          href="/reports/score?sortBy=scoreRateDesc"
          tone="blue"
        />

        <ScoreListCard
          title="관리 필요 5명"
          description="평균 점수 오름차순이며, 같은 점수에서는 미기록이 많은 순서입니다."
          rows={lowScoreRows}
          emptyMessage="점수 집계 데이터가 없습니다."
          href="/reports/score?sortBy=scoreRateAsc"
          tone="rose"
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold tracking-tight text-slate-950">Quick Actions</h3>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
          <ActionCard
            href={canManage ? "/attendance/check" : "/attendance/view"}
            title={canManage ? "출석 체크" : "출석 현황"}
            description={canManage ? "오늘 출석을 빠르게 기록합니다." : "날짜별 출석 상태를 확인합니다."}
            icon={<Icon name="attendance" className="h-5 w-5" filled />}
          />
          <ActionCard
            href="/attendance/view"
            title="출석 조회"
            description="이전 출석 기록과 비율을 확인합니다."
            icon={<Icon name="view-attendance" className="h-5 w-5" />}
          />
          <ActionCard
            href="/reports"
            title="리포트"
            description="월별 성장과 유지율 흐름을 살펴봅니다."
            icon={<Icon name="reports" className="h-5 w-5" />}
          />
          <ActionCard
            href="/reports/score"
            title="출석 점수"
            description="인원별 점수와 관리 대상을 한눈에 봅니다."
            icon={<Icon name="reports" className="h-5 w-5" />}
          />
          <ActionCard
            href="/newcomers"
            title={canManage ? "새가족 등록" : "새가족 조회"}
            description={canManage ? "첫 방문자를 빠르게 등록합니다." : "최근 새가족 현황을 확인합니다."}
            icon={<Icon name="plus-user" className="h-5 w-5" filled />}
            highlighted
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-2xl font-medium tracking-tight text-slate-950">최근 등록된 새가족</h3>
            <Link href="/newcomers" className="text-sm font-semibold text-[#2563eb] transition hover:text-[#1d4ed8]">
              View All
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                <tr>
                  <th className="px-6 py-4">Member Name</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4 text-right">Date Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {((recentNewcomers as RecentNewcomer[] | null) ?? []).map((profile) => {
                  const name = profile.members?.name ?? "-";
                  const department = profile.members?.departments?.name ?? "미지정";

                  return (
                    <tr key={profile.id} className="group transition-colors hover:bg-slate-50/70">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <Avatar name={name} />
                          <span className="text-base font-medium text-slate-900 transition-colors group-hover:text-[#2563eb]">
                            {name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">{department}</td>
                      <td className="px-6 py-5 text-right text-sm text-slate-500">{formatDate(profile.registered_at)}</td>
                    </tr>
                  );
                })}
                {(recentNewcomers?.length ?? 0) === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-slate-500" colSpan={3}>
                      데이터가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-medium tracking-tight text-slate-950">결석 누적 요약</h3>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-rose-600">
                Action Required
              </span>
            </div>
            <Link href="/reports" className="text-sm font-semibold text-[#2563eb] transition hover:text-[#1d4ed8]">
              상세 보기
            </Link>
          </div>

          <div className="space-y-4 p-6">
            {absentees.map((item, index) => {
              const isPrimary = index === 0;
              const badgeTone =
                item.absenceCount >= 3
                  ? "bg-rose-100 text-rose-700"
                  : item.absenceCount === 2
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-600";

              return (
                <div
                  key={item.memberId}
                  className={[
                    "flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
                    isPrimary ? "border-rose-100 bg-rose-50/50" : "border-slate-100 bg-white",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-4">
                    <Avatar name={item.name} tone={isPrimary ? "rose" : item.absenceCount === 2 ? "amber" : "neutral"} />
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{item.name}</p>
                      <p className="text-sm text-slate-500">최근 4회 중 결석 {item.absenceCount}회</p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className={["inline-flex rounded-lg px-3 py-1 text-sm font-bold", badgeTone].join(" ")}>
                      {item.absenceCount} Absences
                    </span>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#2563eb]">
                      {item.absenceCount >= 3 ? "Reach Out" : "Follow Up"}
                    </p>
                  </div>
                </div>
              );
            })}

            {absentees.length === 0 ? <p className="text-sm text-slate-500">결석 누적 데이터가 없습니다.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
