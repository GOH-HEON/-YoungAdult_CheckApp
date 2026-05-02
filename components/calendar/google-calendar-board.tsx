"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { GoogleCalendarEvent } from "@/lib/google/calendar";

type CalendarDayView = {
  key: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: GoogleCalendarEvent[];
};

type GoogleCalendarBoardProps = {
  monthKey: string;
  monthLabel: string;
  todayMonthKey: string;
  todayDateKey: string;
  days: CalendarDayView[];
  timeZone: string;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function buildHref(monthKey: string, dateKey?: string) {
  const params = new URLSearchParams({ month: monthKey });
  if (dateKey) {
    params.set("date", dateKey);
  }
  return `/calendar?${params.toString()}`;
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
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatEventTitle(event: GoogleCalendarEvent, timeZone: string) {
  return event.start.date ? event.summary : `${formatEventTime(event, timeZone)} ${event.summary}`;
}

function formatEventDateLabel(event: GoogleCalendarEvent, timeZone: string) {
  const rawDate = event.start.date ?? event.start.dateTime ?? "";
  const date = new Date(event.start.date ? `${rawDate}T00:00:00` : rawDate);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone,
  }).format(date);
}

export function GoogleCalendarBoard({
  monthKey,
  monthLabel,
  todayMonthKey,
  todayDateKey,
  days,
  timeZone,
}: GoogleCalendarBoardProps) {
  const [activeEvent, setActiveEvent] = useState<GoogleCalendarEvent | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveEvent(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const weekRows = useMemo(
    () => Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7)),
    [days],
  );

  const activeEventLabel = activeEvent ? formatEventDateLabel(activeEvent, timeZone) : "";

  return (
    <>
      <div className="min-h-[calc(100vh-2rem)] rounded-[2rem] border border-slate-200 bg-[#f8f9fa] text-slate-900 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.12)]">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <p className="text-[22px] font-medium leading-none text-slate-900">Calendar</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={buildHref(todayMonthKey, todayDateKey)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              오늘
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href={buildHref(formatMonthShift(monthKey, -1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
                aria-label="이전 달"
              >
                ‹
              </Link>
              <Link
                href={buildHref(formatMonthShift(monthKey, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
                aria-label="다음 달"
              >
                ›
              </Link>
            </div>
            <h2 className="ml-2 text-[22px] font-medium text-slate-900">{monthLabel}</h2>
          </div>
        </header>

        <div className="min-h-[calc(100vh-4rem)]">
          <main className="overflow-auto px-4 py-4">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-white text-[11px] font-semibold text-slate-500">
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
                <div
                  key={week[0]?.key ?? String(weekIndex)}
                  className="grid grid-cols-7 border-b border-slate-200 last:border-b-0"
                >
                  {week.map((day) => (
                    <div
                      key={day.key}
                      className={[
                        "min-h-[156px] border-l border-slate-200 px-2 pb-2 pt-1 first:border-l-0",
                        day.isSelected ? "bg-[#e8f0fe]" : "bg-white",
                        !day.inMonth ? "bg-[#fbfbfb] text-slate-400" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-end">
                        <Link
                          href={buildHref(monthKey, day.key)}
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
                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => setActiveEvent(event)}
                              className="flex w-full items-start rounded-md px-1 py-0.5 text-left text-[3pt] leading-[1.15] transition hover:bg-slate-100"
                            >
                              <span className="min-w-0 whitespace-normal break-words text-slate-700">
                                {formatEventTitle(event, timeZone)}
                              </span>
                            </button>
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

      {activeEvent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveEvent(null)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_30px_60px_-18px_rgba(15,23,42,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1a73e8]">일정 상세</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">{activeEvent.summary}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {formatEventTime(activeEvent, timeZone)}
                  {activeEventLabel ? ` · ${activeEventLabel}` : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveEvent(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {activeEvent.location ? (
                <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">장소</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{activeEvent.location}</p>
                </section>
              ) : null}

              {activeEvent.description ? (
                <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">내용</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {stripHtml(activeEvent.description)}
                  </p>
                </section>
              ) : (
                <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  상세 설명이 없습니다.
                </section>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatMonthShift(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map((value) => Number(value));
  if (!year || !month) {
    return monthKey;
  }

  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
