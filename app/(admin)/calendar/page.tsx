import Link from "next/link";

import { requireSession } from "@/lib/auth/session";
import {
  loadGoogleCalendarEventsInRange,
  type GoogleCalendarEvent,
} from "@/lib/google/calendar";

export const dynamic = "force-dynamic";

type CalendarPageProps = {
  searchParams: Promise<{
    month?: string;
    date?: string;
  }>;
};

type CalendarDay = {
  date: Date;
  key: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: GoogleCalendarEvent[];
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const EVENT_COLORS = ["#1a73e8", "#34a853", "#ea4335", "#f9ab00", "#9333ea", "#0f9d58"] as const;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseMonthKey(value?: string) {
  const match = value?.trim().match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return new Date(year, month - 1, 1);
}

function parseDateKey(value?: string) {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date;
}

function cloneDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date: Date, amount: number) {
  const next = cloneDate(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfWeek(date: Date) {
  const cloned = cloneDate(date);
  cloned.setDate(cloned.getDate() - cloned.getDay());
  return cloned;
}

function endOfWeek(date: Date) {
  const cloned = cloneDate(date);
  cloned.setDate(cloned.getDate() + (6 - cloned.getDay()));
  return cloned;
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function formatDayLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone,
  }).format(date);
}

function getEventStartDate(event: GoogleCalendarEvent) {
  return new Date(event.start.dateTime ?? `${event.start.date}T00:00:00`);
}

function toDateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
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

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickEventColor(event: GoogleCalendarEvent) {
  return EVENT_COLORS[hashString(event.id || event.summary) % EVENT_COLORS.length];
}

function formatCellEventLabel(event: GoogleCalendarEvent, timeZone: string) {
  if (event.start.date) {
    return event.summary;
  }

  return `${formatEventTime(event, timeZone)} ${event.summary}`;
}

function groupEventsByDay(events: GoogleCalendarEvent[], timeZone: string) {
  const map = new Map<string, GoogleCalendarEvent[]>();

  for (const event of events) {
    const start = getEventStartDate(event);
    if (Number.isNaN(start.getTime())) {
      continue;
    }

    const key = toDateKey(start, timeZone);
    const existing = map.get(key) ?? [];
    existing.push(event);
    map.set(key, existing);
  }

  return map;
}

function buildMonthGrid(params: {
  visibleMonth: Date;
  selectedDateKey: string;
  todayKey: string;
  eventsByDay: Map<string, GoogleCalendarEvent[]>;
  timeZone: string;
}) {
  const { visibleMonth, selectedDateKey, todayKey, eventsByDay, timeZone } = params;
  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days: CalendarDay[] = [];

  for (let date = cloneDate(gridStart); date <= gridEnd; date = addDays(date, 1)) {
    const key = formatDateKey(date);
    days.push({
      date: cloneDate(date),
      key,
      dayNumber: date.getDate(),
      inMonth: date.getMonth() === visibleMonth.getMonth(),
      isToday: key === todayKey,
      isSelected: key === selectedDateKey,
      events: eventsByDay.get(toDateKey(date, timeZone)) ?? [],
    });
  }

  return { days, gridStart, gridEnd };
}

function formatUpdatedCount(count: number) {
  return new Intl.NumberFormat("ko-KR").format(count);
}

function buildNavigationHref(month: Date, date?: string) {
  const params = new URLSearchParams({ month: formatMonthKey(month), date: date ?? formatDateKey(startOfMonth(month)) });
  return `/calendar?${params.toString()}`;
}

function pickSelectedDate(params: { date?: string; visibleMonth: Date; today: Date }) {
  const parsed = parseDateKey(params.date);
  if (parsed) {
    if (parsed.getFullYear() === params.visibleMonth.getFullYear() && parsed.getMonth() === params.visibleMonth.getMonth()) {
      return parsed;
    }
  }

  const { visibleMonth, today } = params;
  if (today.getFullYear() === visibleMonth.getFullYear() && today.getMonth() === visibleMonth.getMonth()) {
    return today;
  }

  return startOfMonth(visibleMonth);
}

function pickNextEvent(events: GoogleCalendarEvent[]) {
  return (
    events.find((event) => {
      const start = getEventStartDate(event);
      return !Number.isNaN(start.getTime()) && start >= new Date();
    }) ?? events[0] ?? null
  );
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  await requireSession();
  const params = await searchParams;
  const today = cloneDate(new Date());
  const visibleMonth = parseMonthKey(params.month) ?? startOfMonth(today);
  const selectedDate = pickSelectedDate({ date: params.date, visibleMonth, today });
  const selectedDateKey = formatDateKey(selectedDate);
  const todayKey = formatDateKey(today);

  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  let calendarSummary: Awaited<ReturnType<typeof loadGoogleCalendarEventsInRange>>["summary"] | null = null;
  let events: GoogleCalendarEvent[] = [];
  let errorMessage: string | null = null;

  try {
    const result = await loadGoogleCalendarEventsInRange({
      timeMin: addDays(gridStart, -1).toISOString(),
      timeMax: addDays(gridEnd, 1).toISOString(),
      maxResults: 200,
    });
    calendarSummary = result.summary;
    events = result.events;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "구글 캘린더를 불러오지 못했습니다.";
  }

  const timeZone = calendarSummary?.timeZone ?? "Asia/Seoul";
  const eventsByDay = groupEventsByDay(events, timeZone);
  const monthGrid = buildMonthGrid({
    visibleMonth,
    selectedDateKey,
    todayKey,
    eventsByDay,
    timeZone,
  });
  const weekRows = Array.from(
    { length: Math.ceil(monthGrid.days.length / 7) },
    (_, index) => monthGrid.days.slice(index * 7, index * 7 + 7),
  );
  const selectedDayEvents = monthGrid.days.find((day) => day.key === selectedDateKey)?.events ?? [];
  const selectedDayLabel = formatDayLabel(selectedDate, timeZone);
  const nextEvent = pickNextEvent(events);
  const monthEventCount = eventsByDay.size;

  return (
    <div className="min-h-[calc(100vh-2rem)] rounded-[2rem] border border-slate-200 bg-[#f8f9fa] text-slate-900 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.12)]">
      <header className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 grid-cols-2 grid-rows-2 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <span className="bg-[#4285f4]" />
              <span className="bg-[#ea4335]" />
              <span className="bg-[#fbbc05]" />
              <span className="bg-[#34a853]" />
            </div>
            <div className="min-w-0">
              <p className="text-[22px] font-medium leading-none text-slate-900">Calendar</p>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={buildNavigationHref(startOfMonth(today), todayKey)}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            오늘
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href={buildNavigationHref(addMonths(visibleMonth, -1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
              aria-label="이전 달"
            >
              ‹
            </Link>
            <Link
              href={buildNavigationHref(addMonths(visibleMonth, 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
              aria-label="다음 달"
            >
              ›
            </Link>
          </div>
          <h2 className="ml-2 text-[22px] font-medium text-slate-900">{formatMonthLabel(visibleMonth)}</h2>
        </div>
      </header>

      {errorMessage ? (
        <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-[#f8f9fa] px-4 py-5">
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{formatMonthLabel(visibleMonth)}</h3>
              <div className="flex items-center gap-1">
                <Link
                  href={buildNavigationHref(addMonths(visibleMonth, -1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
                  aria-label="이전 달"
                >
                  ‹
                </Link>
                <Link
                  href={buildNavigationHref(addMonths(visibleMonth, 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
                  aria-label="다음 달"
                >
                  ›
                </Link>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-medium text-slate-500">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="py-1">
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-y-1 text-center text-[11px]">
              {monthGrid.days.map((day) => (
                <Link
                  key={day.key}
                  href={buildNavigationHref(visibleMonth, day.key)}
                  className={[
                    "mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full transition",
                    day.isSelected
                      ? "bg-[#1a73e8] text-white"
                      : day.isToday
                        ? "bg-[#e8f0fe] text-[#1a73e8]"
                        : day.inMonth
                          ? "text-slate-700 hover:bg-slate-100"
                          : "text-slate-400 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {day.dayNumber}
                </Link>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">선택한 날짜</span>
                <span>{selectedDayLabel}</span>
              </div>
            <div className="space-y-1 rounded-xl bg-slate-50 px-3 py-2">
                {selectedDayEvents.length > 0 ? (
                  selectedDayEvents.slice(0, 2).map((event) => {
                    const color = pickEventColor(event);

                    return (
                      <div key={event.id} className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span className="min-w-0 truncate text-xs text-slate-600">
                          {formatCellEventLabel(event, timeZone)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500">이 날짜에는 일정이 없습니다.</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">표시 범위</span>
                <span>{formatUpdatedCount(monthEventCount)}개 날짜</span>
              </div>
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  다음 일정
                </div>
                {nextEvent ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="truncate text-sm font-semibold text-slate-900">{nextEvent.summary}</div>
                    <div className="truncate text-xs text-slate-500">{formatEventTime(nextEvent, timeZone)}</div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    표시할 일정이 없습니다.
                  </div>
                )}
              </div>
            </div>
          </section>
        </aside>

        <main className="overflow-auto px-3 py-3">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
            <div className="grid grid-cols-7 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
              {WEEKDAY_LABELS.map((label, index) => (
                <div
                  key={label}
                  className={[
                    "px-3 py-3 text-center",
                    index === 0 ? "text-rose-500" : index === 6 ? "text-[#1a73e8]" : "",
                  ].join(" ")}
                >
                  {label}
                </div>
              ))}
            </div>

            {weekRows.map((week, weekIndex) => (
              <div key={week[0]?.key ?? String(weekIndex)} className="grid grid-cols-7 border-b border-slate-200 last:border-b-0">
                {week.map((day) => (
                  <div
                    key={day.key}
                    className={[
                      "min-h-[148px] border-l border-slate-200 px-2 pb-2 pt-1 first:border-l-0",
                      day.isSelected ? "bg-[#e8f0fe]" : "bg-white",
                      !day.inMonth ? "bg-[#fbfbfb] text-slate-400" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-end">
                      <Link
                        href={buildNavigationHref(visibleMonth, day.key)}
                        className={[
                          "inline-flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium transition",
                          day.isSelected
                            ? "bg-[#1a73e8] text-white"
                            : day.isToday
                              ? "bg-[#e8f0fe] text-[#1a73e8]"
                              : "text-slate-700 hover:bg-slate-100",
                        ].join(" ")}
                      >
                        {day.dayNumber}
                      </Link>
                    </div>

                    <div className="mt-2 space-y-1">
                      {day.events.slice(0, 4).map((event) => {
                        const color = pickEventColor(event);
                        return event.htmlLink ? (
                          <a
                            key={event.id}
                            href={event.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-start gap-1.5 rounded-md px-1 py-0.5 text-[11px] leading-4 transition hover:bg-slate-100"
                          >
                            <span
                              className="mt-[5px] h-2 w-2 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="min-w-0 truncate text-slate-700">
                              {formatCellEventLabel(event, timeZone)}
                            </span>
                          </a>
                        ) : (
                          <div
                            key={event.id}
                            className="flex items-start gap-1.5 rounded-md px-1 py-0.5 text-[11px] leading-4"
                          >
                            <span
                              className="mt-[5px] h-2 w-2 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="min-w-0 truncate text-slate-700">
                              {formatCellEventLabel(event, timeZone)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
