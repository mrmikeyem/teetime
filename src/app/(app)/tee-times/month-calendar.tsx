"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DailyWeatherEntry, TeeTimeListItem } from "./list-with-calendar";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function MonthCalendar({
  teeTimesByDate,
  dailyWeather,
}: {
  teeTimesByDate: Map<string, TeeTimeListItem[]>;
  dailyWeather: Map<string, DailyWeatherEntry>;
}) {
  const router = useRouter();
  const today = startOfDay(new Date());
  const [viewMonth, setViewMonth] = useState(() => firstOfMonth(today));
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingDate) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPendingDate(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingDate]);

  const monthStart = firstOfMonth(viewMonth);
  const startWeekday = monthStart.getDay();
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0
  ).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  }

  const canGoPrev = monthStart > firstOfMonth(today);

  function shiftMonth(delta: number) {
    setViewMonth(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1)
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={!canGoPrev}
          className="flex h-9 w-9 items-center justify-center rounded-md text-base text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          aria-label="Previous month"
        >
          ‹
        </button>
        <h3 className="text-sm font-semibold">
          {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </h3>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-base text-gray-600 hover:bg-gray-100"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((d, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400"
          >
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="h-12 sm:h-14" />;
          const iso = toIsoDate(cell);
          const tees = teeTimesByDate.get(iso) ?? [];
          const hasTee = tees.length > 0;
          const isToday = isSameDay(cell, today);
          const isPast = cell < today;
          const canBook = !isPast;

          const sortedTees = [...tees].sort(
            (a, b) =>
              new Date(a.teeOffAt).getTime() - new Date(b.teeOffAt).getTime()
          );
          const firstTee = sortedTees[0];
          const extra = sortedTees.length - 1;
          const day = dailyWeather.get(iso);

          const promptBook = () => setPendingDate(iso);

          return (
            <div
              key={i}
              role={canBook ? "button" : undefined}
              tabIndex={canBook ? 0 : -1}
              aria-label={canBook ? `Book a tee time on ${iso}` : undefined}
              onClick={() => canBook && promptBook()}
              onKeyDown={(e) => {
                if (!canBook) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  promptBook();
                }
              }}
              className={`relative flex min-h-12 flex-col items-stretch gap-0.5 overflow-hidden rounded-md p-1 text-left text-[10px] leading-tight transition-colors sm:min-h-14 sm:text-xs ${
                canBook ? "cursor-pointer" : ""
              } ${
                hasTee
                  ? "bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  : isPast
                  ? "text-gray-300"
                  : "text-gray-700 hover:bg-gray-50"
              } ${
                isToday ? "ring-1 ring-emerald-700 ring-inset" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-0.5">
                <span className="text-[11px] font-semibold">
                  {cell.getDate()}
                </span>
                {day && !isPast && (
                  <span
                    className="whitespace-nowrap text-[9px] text-gray-500 sm:text-[10px]"
                    title={`${day.condition} · ${day.tempF}°`}
                    aria-label={`${day.condition}, ${day.tempF}°F`}
                  >
                    <span aria-hidden>{day.icon}</span>
                    <span className="hidden sm:inline"> {day.tempF}°</span>
                  </span>
                )}
              </div>
              {firstTee && (
                <div className="space-y-0.5">
                  <div className="truncate font-semibold text-emerald-800">
                    {firstTee.course}
                  </div>
                  <div className="font-semibold text-emerald-700">
                    {firstTee.members.length}/{firstTee.partySize}
                  </div>
                  {extra > 0 && (
                    <div className="text-emerald-600">+{extra}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-center text-[10px] text-gray-400">
        Tap a day to book a tee time
      </p>

      {pendingDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPendingDate(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold">
              Book a tee time on {formatPretty(pendingDate)}?
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              You&apos;ll be taken to the new tee time form with this date filled in.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDate(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push(`/tee-times/new?date=${pendingDate}`);
                }}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Yes, book it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatPretty(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
