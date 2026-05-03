import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { canWrite, requireSession } from "@/lib/auth/session";
import { loadGoogleCalendarEvents, type GoogleCalendarEvent } from "@/lib/google/calendar";

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

export default async function DashboardPage() {
  const { appUser } = await requireSession();
  const canManage = canWrite(appUser);

  let scheduleEvents: GoogleCalendarEvent[] = [];
  let scheduleError: string | null = null;
  let timeZone = "Asia/Seoul";

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
