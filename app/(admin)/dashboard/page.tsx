import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { canWrite, createPageReadClient, requireSession } from "@/lib/auth/session";
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

type ActiveMemberRow = {
  id: string;
  name: string;
  gender: "형제" | "자매";
  departments: {
    name: string;
  } | null;
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
    <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</p>
          <p className={["mt-2 text-3xl font-bold tracking-tight sm:text-4xl", valueClassName].join(" ")}>{value}</p>
          <p className={["mt-2 text-xs font-semibold sm:text-sm", accentClassName].join(" ")}>{caption}</p>
        </div>
        <div className={["flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", iconClassName].join(" ")}>
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

export default async function DashboardPage() {
  const session = await requireSession();
  const { appUser } = session;
  const supabase = createPageReadClient(appUser, session.supabase);
  const canManage = canWrite(appUser);

  const [{ data: activeMembers }, { data: latestMeeting }, { data: recentNewcomers }] = await Promise.all([
    supabase.from("members").select("id, name, gender, departments(name)").eq("is_active", true),
    supabase
      .from("meetings")
      .select("id, meeting_date, title")
      .order("meeting_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("newcomer_profiles")
      .select("id, registered_at, members(id, name, departments(name))")
      .order("registered_at", { ascending: false })
      .limit(5),
  ]);

  const normalizedActiveMembers = (activeMembers as ActiveMemberRow[] | null) ?? [];
  const totalActiveMembers = normalizedActiveMembers.length;

  const latestRecordsResponse = latestMeeting?.id
    ? await supabase
        .from("attendance_records")
        .select("status")
        .eq("meeting_id", latestMeeting.id)
        .in("status", ["정상출석", "지각", "행사"])
    : { data: [] as Array<{ status: string }> };

  const latestAttendanceRate =
    latestMeeting?.id && totalActiveMembers > 0
      ? (((latestRecordsResponse.data?.length ?? 0) / totalActiveMembers) * 100)
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10">
      <section className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">대시보드</h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">운영 핵심 지표를 한눈에 확인합니다.</p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <StatCard
          title="전체 활성 형제/자매 수"
          value={`${totalActiveMembers}명`}
          caption="현재 활성 상태 기준"
          icon={<Icon name="members" className="h-8 w-8" />}
          iconClassName="bg-blue-50 text-[#2563eb]"
        />

        <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
          <div className="mb-6 flex items-center justify-between gap-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">최근 모임 출석률</p>
            <span className="text-xl font-bold tracking-tight text-[#2563eb] sm:text-2xl">{latestAttendanceRate.toFixed(1)}%</span>
          </div>
          <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#2563eb] transition-[width] duration-500"
              style={{ width: `${Math.min(latestAttendanceRate, 100)}%` }}
            />
          </div>
          <p className="text-sm leading-6 text-slate-500 sm:text-base">
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

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight text-slate-950">Quick Actions</h3>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
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
            <h3 className="text-lg font-medium tracking-tight text-slate-950 sm:text-xl">최근 등록된 새가족</h3>
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
                        <span className="text-sm font-medium text-slate-900 transition-colors group-hover:text-[#2563eb] sm:text-base">
                          {name}
                        </span>
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

      </section>
    </div>
  );
}
