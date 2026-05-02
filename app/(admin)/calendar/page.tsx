import Link from "next/link";

import { PageTitle } from "@/components/ui/page-title";
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

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const selectedDayEvents = monthGrid.days.find((day) => day.key === selectedDateKey)?.events ?? [];
  const selectedDayLabel = formatDayLabel(selectedDate, timeZone);
  const nextEvent = pickNextEvent(events);
  const monthEventCount = eventsByDay.size;

  return (
    <div className="space-y-6">
      <PageTitle
        title="구글 캘린더"
        description="공유된 구글 캘린더를 월간 달력으로 보여줍니다. 날짜를 누르면 그날 일정을 바로 확인할 수 있습니다."
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
          <p className="text-sm font-semibold text-slate-500">이번 달 일정</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{formatUpdatedCount(monthEventCount)}개 날짜</p>
          <p className="mt-1 text-xs text-slate-500">달력에 표시되는 날짜 묶음 수입니다.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold text-slate-500">다음 일정</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{nextEvent?.summary ?? "일정 없음"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {nextEvent ? formatEventTime(nextEvent, timeZone) : "표시할 일정이 없습니다."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                <span>Calendar</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500">
                  {formatMonthLabel(visibleMonth)}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-slate-950">{formatMonthLabel(visibleMonth)}</h3>
              <p className="text-sm text-slate-500">날짜를 누르면 오른쪽에서 그날의 일정을 볼 수 있습니다.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={buildNavigationHref(addMonths(visibleMonth, -1))}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                이전 달
              </Link>
              <Link
                href={buildNavigationHref(startOfMonth(today), todayKey)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                오늘
              </Link>
              <Link
                href={buildNavigationHref(addMonths(visibleMonth, 1))}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                다음 달
              </Link>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-400">
            {WEEKDAY_LABELS.map((label, index) => (
              <div key={label} className={index === 0 ? "text-rose-500" : index === 6 ? "text-blue-500" : ""}>
                {label}
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-2">
            {monthGrid.days.map((day) => (
              <Link
                key={day.key}
                href={buildNavigationHref(visibleMonth, day.key)}
                className={[
                  "group min-h-[132px] rounded-2xl border p-3 text-left transition",
                  day.inMonth ? "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white" : "border-slate-100 bg-slate-50/50 text-slate-400",
                  day.isSelected ? "border-[#2563eb] bg-[#eff6ff] shadow-[0_0_0_1px_rgba(37,99,235,0.12)]" : "",
                  day.isToday ? "ring-1 ring-inset ring-emerald-300" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={[
                      "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold",
                      day.isSelected
                        ? "bg-[#2563eb] text-white"
                        : day.isToday
                          ? "bg-emerald-100 text-emerald-700"
                          : day.inMonth
                            ? "text-slate-900"
                            : "text-slate-400",
                    ].join(" ")}
                  >
                    {day.dayNumber}
                  </span>
                  {day.events.length > 0 ? (
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500 shadow-sm">
                      {day.events.length}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-1">
                  {day.events.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className={[
                        "rounded-lg border px-2 py-1 text-xs leading-4",
                        day.isSelected ? "border-[#bfdbfe] bg-white text-slate-700" : "border-slate-200 bg-white text-slate-700",
                      ].join(" ")}
                    >
                      <div className="font-semibold text-[#1d4ed8]">{formatEventTime(event, timeZone)}</div>
                      <div className="truncate">{event.summary}</div>
                    </div>
                  ))}
                  {day.events.length > 3 ? (
                    <div className="text-xs font-semibold text-slate-500">+{day.events.length - 3}개 더보기</div>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">선택한 날짜</p>
                <h4 className="mt-1 text-xl font-bold text-slate-950">{selectedDayLabel}</h4>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {selectedDayEvents.length}개
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {selectedDayEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  이 날짜에는 표시할 일정이 없습니다.
                </div>
              ) : (
                selectedDayEvents.map((event) => (
                  <article
                    key={event.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
                  >
                    <p className="text-sm font-semibold text-[#1d4ed8]">{formatEventTime(event, timeZone)}</p>
                    <p className="mt-1 text-base font-bold text-slate-950">{event.summary}</p>
                    {event.location ? <p className="mt-1 text-sm text-slate-500">장소: {event.location}</p> : null}
                    {event.description ? (
                      <p className="mt-2 max-h-24 overflow-hidden text-sm leading-6 text-slate-600">
                        {stripHtml(event.description).slice(0, 220)}
                      </p>
                    ) : null}
                    {event.htmlLink ? (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        원본 열기
                      </a>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-[#eff6ff] p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
            <p className="text-sm font-semibold text-[#1d4ed8]">바로가기</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Google Calendar에서 직접 열고 싶으면 아래 버튼을 쓰면 됩니다.
            </p>
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              Google Calendar 열기
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
