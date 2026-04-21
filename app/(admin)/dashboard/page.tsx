import Link from "next/link";
import { PageTitle } from "@/components/ui/page-title";
import { requireSession } from "@/lib/auth/session";
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

export default async function DashboardPage() {
  const { supabase } = await requireSession();

  const [
    { count: totalActiveMembers },
    { data: latestMeeting },
    { data: recentNewcomers },
    { data: recentMeetings },
  ] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }).eq("is_active", true),
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
    supabase.from("meetings").select("id").order("meeting_date", { ascending: false }).limit(4),
  ]);

  let latestAttendanceRate = 0;

  if (latestMeeting?.id && (totalActiveMembers ?? 0) > 0) {
    const { data: records } = await supabase
      .from("attendance_records")
      .select("status")
      .eq("meeting_id", latestMeeting.id)
      .in("status", ["정상출석", "지각", "행사"]);

    latestAttendanceRate = ((records?.length ?? 0) / (totalActiveMembers ?? 1)) * 100;
  }

  let absentees: Array<{ memberId: string; name: string; absenceCount: number }> = [];

  if ((recentMeetings?.length ?? 0) > 0) {
    const { data: absenceRows } = await supabase
      .from("attendance_records")
      .select("member_id, members(name)")
      .in(
        "meeting_id",
        recentMeetings?.map((meeting) => meeting.id) ?? [],
      )
      .eq("status", "결석");

    const grouped = new Map<string, { memberId: string; name: string; absenceCount: number }>();

    ((absenceRows as AbsenceRecord[] | null) ?? []).forEach((row) => {
      const prev = grouped.get(row.member_id);
      grouped.set(row.member_id, {
        memberId: row.member_id,
        name: row.members?.name ?? "이름 없음",
        absenceCount: (prev?.absenceCount ?? 0) + 1,
      });
    });

    absentees = Array.from(grouped.values())
      .sort((a, b) => b.absenceCount - a.absenceCount)
      .slice(0, 5);
  }

  return (
    <div className="space-y-6">
      <PageTitle title="대시보드" description="운영 핵심 지표를 한눈에 확인합니다." />

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">전체 활성 형제/자매 수</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{totalActiveMembers ?? 0}명</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">최근 모임 출석률</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{latestAttendanceRate.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-slate-600">
            {latestMeeting ? `${latestMeeting.title} (${formatDate(latestMeeting.meeting_date)})` : "최근 모임 없음"}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">최근 등록 새가족</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{recentNewcomers?.length ?? 0}명</p>
          <p className="mt-1 text-xs text-slate-600">최근 5건 기준</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">빠른 액션</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/attendance/check" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">
            출석 체크
          </Link>
          <Link href="/attendance/view" className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white">
            출석 조회
          </Link>
          <Link href="/reports" className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white">
            통계/리포트
          </Link>
          <Link href="/newcomers" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            새가족 등록
          </Link>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">최근 등록된 새가족</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {((recentNewcomers as RecentNewcomer[] | null) ?? []).map((profile) => (
              <li key={profile.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-900">{profile.members?.name ?? "-"}</span>
                <span className="ml-2 text-slate-600">{profile.members?.departments?.name ?? "미지정"}</span>
                <span className="ml-2 text-xs text-slate-500">{formatDate(profile.registered_at)}</span>
              </li>
            ))}
            {(recentNewcomers?.length ?? 0) === 0 ? <li className="text-slate-600">데이터가 없습니다.</li> : null}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-semibold text-slate-900">결석 누적자 요약 (최근 4회)</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {absentees.map((item) => (
              <li key={item.memberId} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-900">{item.name}</span>
                <span className="ml-2 text-rose-700">결석 {item.absenceCount}회</span>
              </li>
            ))}
            {absentees.length === 0 ? <li className="text-slate-600">결석 누적 데이터가 없습니다.</li> : null}
          </ul>
        </article>
      </section>
    </div>
  );
}
