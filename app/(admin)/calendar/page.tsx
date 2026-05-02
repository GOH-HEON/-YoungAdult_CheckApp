import { GoogleCalendarBoard } from "@/components/calendar/google-calendar-board";
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
  key: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: GoogleCalendarEvent[];
};

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
  const monthKey = formatMonthKey(visibleMonth);
  const todayMonthKey = formatMonthKey(today);
  const monthLabel = formatMonthLabel(visibleMonth);
  const days = monthGrid.days;

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <GoogleCalendarBoard
        monthKey={monthKey}
        monthLabel={monthLabel}
        todayMonthKey={todayMonthKey}
        todayDateKey={todayKey}
        days={days}
        timeZone={timeZone}
      />
    </div>
  );
}
