import { PageTitle } from "@/components/ui/page-title";
import { requireSession } from "@/lib/auth/session";
import {
  loadGoogleCalendarEvents,
  type GoogleCalendarEvent,
} from "@/lib/google/calendar";

export const dynamic = "force-dynamic";

type CalendarGroup = {
  label: string;
  key: string;
  events: GoogleCalendarEvent[];
};

function formatGroupLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone,
  }).format(date);
}

function toDateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
}

function getEventStartDate(event: GoogleCalendarEvent) {
  return new Date(event.start.dateTime ?? `${event.start.date}T00:00:00`);
}

function formatEventTime(event: GoogleCalendarEvent, timeZone: string) {
  if (event.start.date) {
    return "종일";
  }

  const start = new Date(event.start.dateTime ?? "");
  const end = new Date(event.end.dateTime ?? "");

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "-";
  }

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function groupEvents(events: GoogleCalendarEvent[], timeZone: string): CalendarGroup[] {
  const map = new Map<string, CalendarGroup>();

  for (const event of events) {
    const start = getEventStartDate(event);
    if (Number.isNaN(start.getTime())) {
      continue;
    }

    const key = toDateKey(start, timeZone);
    const existing = map.get(key);
    const label = formatGroupLabel(start, timeZone);

    if (existing) {
      existing.events.push(event);
      continue;
    }

    map.set(key, {
      key,
      label,
      events: [event],
    });
  }

  return Array.from(map.values());
}

function pickNextEvent(events: GoogleCalendarEvent[]) {
  return events.find((event) => {
    const start = getEventStartDate(event);
    return !Number.isNaN(start.getTime()) && start >= new Date();
  }) ?? events[0] ?? null;
}

export default async function CalendarPage() {
  await requireSession();

  let calendarSummary: Awaited<ReturnType<typeof loadGoogleCalendarEvents>>["summary"] | null = null;
  let events: GoogleCalendarEvent[] = [];
  let errorMessage: string | null = null;

  try {
    const result = await loadGoogleCalendarEvents({ daysBack: 7, daysAhead: 60, maxResults: 100 });
    calendarSummary = result.summary;
    events = result.events;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "구글 캘린더를 불러오지 못했습니다.";
  }

  const timeZone = calendarSummary?.timeZone ?? "Asia/Seoul";
  const groupedEvents = groupEvents(events, timeZone);
  const nextEvent = pickNextEvent(events);

  return (
    <div className="space-y-6">
      <PageTitle
        title="구글 캘린더"
        description="공유된 구글 캘린더 일정을 바로 확인하는 페이지입니다. 읽기 전용으로 먼저 보여줍니다."
      />

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold text-slate-500">캘린더</p>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {calendarSummary?.summary ?? "구글 캘린더"}
          </p>
          <p className="mt-1 text-xs text-slate-500">{calendarSummary?.id ?? "설정된 캘린더 ID"}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold text-slate-500">다음 일정</p>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {nextEvent?.summary ?? "일정 없음"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {nextEvent ? formatEventTime(nextEvent, timeZone) : "표시할 일정이 없습니다."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold text-slate-500">표시 중인 일정</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{events.length}개</p>
          <p className="mt-1 text-xs text-slate-500">최근 7일부터 앞으로 60일 범위</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900">일정 목록</h3>
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Google Calendar 열기
          </a>
        </div>

        {groupedEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            표시할 일정이 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {groupedEvents.map((group) => (
              <section key={group.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h4 className="text-base font-bold text-slate-900">{group.label}</h4>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {group.events.length}개
                  </span>
                </div>

                <div className="space-y-3">
                  {group.events.map((event) => (
                    <article
                      key={event.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
                    >
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-[#1d4ed8]">
                            {formatEventTime(event, timeZone)}
                          </p>
                          <p className="text-base font-bold text-slate-900">{event.summary}</p>
                          {event.location ? (
                            <p className="text-sm text-slate-500">장소: {event.location}</p>
                          ) : null}
                          {event.description ? (
                            <p className="max-w-3xl text-sm leading-6 text-slate-600">
                              {stripHtml(event.description).slice(0, 180)}
                            </p>
                          ) : null}
                        </div>

                          {event.htmlLink ? (
                            <a
                              href={event.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              원본 열기
                            </a>
                          ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
