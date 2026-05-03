import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { canWrite, createPageReadClient, requireSession } from "@/lib/auth/session";
import { loadGoogleCalendarEvents, type GoogleCalendarEvent } from "@/lib/google/calendar";
import { compareDepartmentName } from "@/lib/utils/department-order";
import { formatDate } from "@/lib/utils/format";

type MeetingRow = {
  id: string;
  meeting_date: string;
  title: string;
  meeting_types: {
    name: string;
  } | null;
};

type ActiveMemberRow = {
  id: string;
  gender: "형제" | "자매";
  departments: {
    name: string;
  } | null;
};

type AttendanceRecordRow = {
  member_id: string;
  status: "정상출석" | "지각" | "결석" | "행사";
};

type AttendanceSummary = {
  groupName: string;
  memberCount: number;
  정상출석: number;
  지각: number;
  행사: number;
  결석: number;
  출석총합: number;
};

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

function getEventStart(event: GoogleCalendarEvent) {
  return new Date(event.start.dateTime ?? `${event.start.date}T00:00:00`);
}

function formatEventDate(event: GoogleCalendarEvent, timeZone: string) {
  const start = getEventStart(event);

  if (Number.isNaN(start.getTime())) {
    return "날짜 미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone,
  }).format(start);
}

function formatEventTime(event: GoogleCalendarEvent, timeZone: string) {
  if (event.start.date) {
    return "종일";
  }

  const start = new Date(event.start.dateTime ?? "");
  const end = new Date(event.end.dateTime ?? "");

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "시간 미정";
  }

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function isYouthEvent(event: GoogleCalendarEvent) {
  const haystack = [event.summary, event.description, event.location].filter(Boolean).join(" ");
  return haystack.includes("청년회") || haystack.includes("쳥년회");
}

function isYouthMeeting(meeting: MeetingRow) {
  const haystack = [meeting.title, meeting.meeting_types?.name].filter(Boolean).join(" ");
  return haystack.includes("청년회") || haystack.includes("쳥년회");
}

function createAttendanceSummary(groupName: string, memberCount: number): AttendanceSummary {
  return {
    groupName,
    memberCount,
    정상출석: 0,
    지각: 0,
    행사: 0,
    결석: 0,
    출석총합: 0,
  };
}

function finalizeAttendanceSummary(summary: AttendanceSummary) {
  return {
    ...summary,
    출석총합: summary.정상출석 + summary.지각 + summary.행사,
  };
}

export default async function DashboardPage() {
  const session = await requireSession();
  const { appUser } = session;
  const supabase = createPageReadClient(appUser, session.supabase);
  const canManage = canWrite(appUser);

  let scheduleEvents: GoogleCalendarEvent[] = [];
  let scheduleError: string | null = null;
  let timeZone = "Asia/Seoul";
  let latestYouthMeeting: MeetingRow | null = null;
  let departmentAttendanceSummary: AttendanceSummary[] = [];
  let genderAttendanceSummary: AttendanceSummary[] = [];

  try {
    const calendar = await loadGoogleCalendarEvents({
      daysBack: 0,
      daysAhead: 45,
      maxResults: 80,
    });
    timeZone = calendar.summary?.timeZone ?? timeZone;
    scheduleEvents = calendar.events.filter((event) => event.status !== "cancelled" && isYouthEvent(event)).slice(0, 8);
  } catch (error) {
    scheduleError = error instanceof Error ? error.message : "청년회 일정을 불러오지 못했습니다.";
  }

  const [{ data: activeMembers }, { data: recentMeetings }] = await Promise.all([
    supabase.from("members").select("id, gender, departments(name)").eq("is_active", true),
    supabase
      .from("meetings")
      .select("id, meeting_date, title, meeting_types(name)")
      .order("meeting_date", { ascending: false })
      .limit(20),
  ]);

  const memberRows = (activeMembers as ActiveMemberRow[] | null) ?? [];
  const meetingRows = (recentMeetings as MeetingRow[] | null) ?? [];
  latestYouthMeeting = meetingRows.find(isYouthMeeting) ?? null;

  if (latestYouthMeeting) {
    const { data: attendanceRecords } = await supabase
      .from("attendance_records")
      .select("member_id, status")
      .eq("meeting_id", latestYouthMeeting.id);
    const records = (attendanceRecords as AttendanceRecordRow[] | null) ?? [];
    const memberById = new Map(memberRows.map((member) => [member.id, member]));

    const departmentCount = new Map<string, number>();
    const genderCount = new Map<"형제" | "자매", number>([
      ["형제", 0],
      ["자매", 0],
    ]);

    memberRows.forEach((member) => {
      const departmentName = member.departments?.name ?? "미지정";
      departmentCount.set(departmentName, (departmentCount.get(departmentName) ?? 0) + 1);
      genderCount.set(member.gender, (genderCount.get(member.gender) ?? 0) + 1);
    });

    const departmentSummary = new Map<string, AttendanceSummary>();
    Array.from(departmentCount.entries()).forEach(([departmentName, memberCount]) => {
      departmentSummary.set(departmentName, createAttendanceSummary(departmentName, memberCount));
    });

    const genderSummary = new Map<"형제" | "자매", AttendanceSummary>([
      ["형제", createAttendanceSummary("형제", genderCount.get("형제") ?? 0)],
      ["자매", createAttendanceSummary("자매", genderCount.get("자매") ?? 0)],
    ]);

    records.forEach((record) => {
      const member = memberById.get(record.member_id);
      if (!member) {
        return;
      }

      const departmentName = member.departments?.name ?? "미지정";
      const departmentItem = departmentSummary.get(departmentName);
      if (departmentItem) {
        departmentItem[record.status] += 1;
      }

      const genderItem = genderSummary.get(member.gender);
      if (genderItem) {
        genderItem[record.status] += 1;
      }
    });

    departmentAttendanceSummary = Array.from(departmentSummary.values())
      .map(finalizeAttendanceSummary)
      .sort((a, b) => compareDepartmentName(a.groupName, b.groupName));
    genderAttendanceSummary = (["형제", "자매"] as const)
      .map((gender) => genderSummary.get(gender))
      .filter((summary): summary is AttendanceSummary => Boolean(summary))
      .map(finalizeAttendanceSummary);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Quick Actions</h2>
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
            href="/calendar"
            title="청년회 일정"
            description="구글 캘린더에 등록된 일정을 확인합니다."
            icon={<Icon name="events" className="h-5 w-5" />}
            highlighted
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">최근 청년회 출석정보</h2>
            <p className="text-sm text-slate-500">
              {latestYouthMeeting
                ? `${latestYouthMeeting.title} · ${formatDate(latestYouthMeeting.meeting_date)}`
                : "최근 청년회 모임 기록이 없습니다."}
            </p>
          </div>
          <Link href="/reports" className="text-sm font-semibold text-[#2563eb] transition hover:text-[#1d4ed8]">
            리포트 보기
          </Link>
        </div>

        {latestYouthMeeting ? (
          <div className="grid gap-0 lg:grid-cols-2">
            <AttendanceSummaryTable title="부서별" rows={departmentAttendanceSummary} />
            <AttendanceSummaryTable title="형제/자매별" rows={genderAttendanceSummary} />
          </div>
        ) : (
          <div className="px-6 py-8 text-sm text-slate-500">표시할 출석정보가 없습니다.</div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">청년회 일정</h2>
          <Link href="/calendar" className="text-sm font-semibold text-[#2563eb] transition hover:text-[#1d4ed8]">
            전체 보기
          </Link>
        </div>

        {scheduleError ? (
          <div className="px-6 py-8 text-sm text-rose-600">{scheduleError}</div>
        ) : scheduleEvents.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {scheduleEvents.map((event) => (
              <article key={event.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-950">{event.summary}</p>
                  {event.location ? <p className="mt-1 truncate text-sm text-slate-500">{event.location}</p> : null}
                </div>
                <div className="shrink-0 text-left text-sm font-medium text-slate-600 sm:text-right">
                  <p>{formatEventDate(event, timeZone)}</p>
                  <p className="text-xs text-slate-500">{formatEventTime(event, timeZone)}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-sm text-slate-500">표시할 청년회 일정이 없습니다.</div>
        )}
      </section>
    </div>
  );
}

function AttendanceSummaryTable({ title, rows }: { title: string; rows: AttendanceSummary[] }) {
  const totals = rows.reduce(
    (acc, row) => ({
      memberCount: acc.memberCount + row.memberCount,
      정상출석: acc.정상출석 + row.정상출석,
      지각: acc.지각 + row.지각,
      행사: acc.행사 + row.행사,
      결석: acc.결석 + row.결석,
      출석총합: acc.출석총합 + row.출석총합,
    }),
    {
      memberCount: 0,
      정상출석: 0,
      지각: 0,
      행사: 0,
      결석: 0,
      출석총합: 0,
    },
  );

  return (
    <div className="border-b border-slate-100 p-6 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-2 py-2 text-left">구분</th>
              <th className="px-2 py-2 text-center">인원</th>
              <th className="px-2 py-2 text-center">정상</th>
              <th className="px-2 py-2 text-center">지각</th>
              <th className="px-2 py-2 text-center">행사</th>
              <th className="px-2 py-2 text-center">결석</th>
              <th className="px-2 py-2 text-center">출석 총합</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.groupName}>
                <td className="px-2 py-2 font-medium text-slate-950">{row.groupName}</td>
                <td className="px-2 py-2 text-center text-slate-600">{row.memberCount}</td>
                <td className="px-2 py-2 text-center text-slate-600">{row.정상출석}</td>
                <td className="px-2 py-2 text-center text-slate-600">{row.지각}</td>
                <td className="px-2 py-2 text-center text-slate-600">{row.행사}</td>
                <td className="px-2 py-2 text-center text-slate-600">{row.결석}</td>
                <td className="px-2 py-2 text-center font-semibold text-[#2563eb]">{row.출석총합}</td>
              </tr>
            ))}
            {rows.length > 0 ? (
              <tr className="bg-slate-50 font-semibold text-slate-950">
                <td className="px-2 py-2">총합</td>
                <td className="px-2 py-2 text-center">{totals.memberCount}</td>
                <td className="px-2 py-2 text-center">{totals.정상출석}</td>
                <td className="px-2 py-2 text-center">{totals.지각}</td>
                <td className="px-2 py-2 text-center">{totals.행사}</td>
                <td className="px-2 py-2 text-center">{totals.결석}</td>
                <td className="px-2 py-2 text-center text-[#2563eb]">{totals.출석총합}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="mt-3 text-sm text-slate-500">데이터가 없습니다.</p> : null}
    </div>
  );
}
