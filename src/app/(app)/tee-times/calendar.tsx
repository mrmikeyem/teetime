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

type ViewMode = "week" | "month";

export function TeeTimeCalendar({
  teeTimesByDate,
  dailyWeather,
}: {
  teeTimesByDate: Map<string, TeeTimeListItem[]>;
  dailyWeather: Map<string, DailyWeatherEntry>;
}) {
  const today = startOfDay(new Date());
  const [view, setView] = useState<ViewMode>("week");
  // Anchor is "any day inside the period currently shown" — for week it's
  // the day used to derive Sun-Sat; for month it's the first of that month.
  const [anchor, setAnchor] = useState<Date>(today);
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingDate) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPendingDate(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingDate]);

  function shift(delta: number) {
    if (view === "week") {
      const next = new Date(anchor);
      next.setDate(next.getDate() + 7 * delta);
      setAnchor(next);
    } else {
      const next = new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
      setAnchor(next);
    }
  }

  const cells = view === "week" ? weekCells(anchor) : monthCells(anchor);
  const headerLabel =
    view === "week"
      ? weekLabel(cells[0]!, cells[6]!)
      : `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;

  // Can we go backwards? In week mode, allow as long as the current week
  // contains a day >= today's start (so the week including today is the floor).
  // In month mode, the current month must not be entirely in the past.
  const canGoPrev =
    view === "week"
      ? cells[0]! > today
      : firstOfMonth(anchor) > firstOfMonth(today);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={!canGoPrev}
          className="flex h-9 w-9 items-center justify-center rounded-md text-base text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          aria-label={view === "week" ? "Previous week" : "Previous month"}
        >
          ‹
        </button>
        <h3 className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
          {headerLabel}
        </h3>
        <button
          type="button"
          onClick={() => shift(1)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-base text-gray-600 hover:bg-gray-100"
          aria-label={view === "week" ? "Next week" : "Next month"}
        >
          ›
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView("week")}
            className={`rounded px-3 py-1 font-semibold ${
              view === "week"
                ? "bg-emerald-700 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setView("month")}
            className={`rounded px-3 py-1 font-semibold ${
              view === "month"
                ? "bg-emerald-700 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Month
          </button>
        </div>
        <button
          type="button"
          onClick={() => setAnchor(today)}
          className="rounded-md px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
        >
          Today
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
        {cells.map((cell, i) => (
          <CalendarCell
            key={i}
            cell={cell}
            today={today}
            view={view}
            teeTimesByDate={teeTimesByDate}
            dailyWeather={dailyWeather}
            onPick={(iso) => setPendingDate(iso)}
          />
        ))}
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
          <Modal
            date={pendingDate}
            onCancel={() => setPendingDate(null)}
          />
        </div>
      )}
    </div>
  );
}

function CalendarCell({
  cell,
  today,
  view,
  teeTimesByDate,
  dailyWeather,
  onPick,
}: {
  cell: Date | null;
  today: Date;
  view: ViewMode;
  teeTimesByDate: Map<string, TeeTimeListItem[]>;
  dailyWeather: Map<string, DailyWeatherEntry>;
  onPick: (iso: string) => void;
}) {
  if (!cell) {
    return (
      <div
        className={view === "week" ? "min-h-20" : "min-h-12 sm:min-h-14"}
      />
    );
  }
  const iso = toIsoDate(cell);
  const tees = teeTimesByDate.get(iso) ?? [];
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
  const hasTee = tees.length > 0;

  // Week view gives more room: bigger cells, both icon + temp always visible,
  // tee-time course readable. Month view is denser but now also shows temp.
  const sizeClasses =
    view === "week"
      ? "min-h-20 text-xs"
      : "min-h-12 text-[10px] leading-tight sm:min-h-14 sm:text-xs";

  return (
    <div
      role={canBook ? "button" : undefined}
      tabIndex={canBook ? 0 : -1}
      aria-label={canBook ? `Book a tee time on ${iso}` : undefined}
      onClick={() => canBook && onPick(iso)}
      onKeyDown={(e) => {
        if (!canBook) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick(iso);
        }
      }}
      className={`relative flex flex-col items-stretch gap-0.5 overflow-hidden rounded-md p-1 text-left transition-colors ${sizeClasses} ${
        canBook ? "cursor-pointer" : ""
      } ${
        hasTee
          ? "bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
          : isPast
          ? "text-gray-300"
          : "text-gray-700 hover:bg-gray-50"
      } ${isToday ? "ring-1 ring-emerald-700 ring-inset" : ""}`}
    >
      <div className="flex items-center justify-between gap-0.5">
        <span className="text-[11px] font-semibold">{cell.getDate()}</span>
        {day && !isPast && (
          <span
            className="whitespace-nowrap text-[10px] text-gray-500"
            title={`${day.condition} · ${day.tempF}°`}
            aria-label={`${day.condition}, ${day.tempF}°F`}
          >
            <span aria-hidden>{day.icon}</span>
            <span> {day.tempF}°</span>
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
          {extra > 0 && <div className="text-emerald-600">+{extra}</div>}
        </div>
      )}
    </div>
  );
}

function Modal({
  date,
  onCancel,
}: {
  date: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  return (
    <div
      className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-base font-semibold">
        Book a tee time on {formatPretty(date)}?
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        You&apos;ll be taken to the new tee time form with this date filled in.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => router.push(`/tee-times/new?date=${date}`)}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Yes, book it
        </button>
      </div>
    </div>
  );
}

function weekCells(anchor: Date): Date[] {
  // Sunday-start week containing `anchor`
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function monthCells(anchor: Date): (Date | null)[] {
  const monthStart = firstOfMonth(anchor);
  const startWeekday = monthStart.getDay();
  const daysInMonth = new Date(
    anchor.getFullYear(),
    anchor.getMonth() + 1,
    0
  ).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), d));
  }
  return cells;
}

function weekLabel(from: Date, to: Date) {
  const sameMonth = from.getMonth() === to.getMonth();
  const fromStr = from.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const toStr = sameMonth
    ? to.getDate().toString()
    : to.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fromStr} – ${toStr}, ${to.getFullYear()}`;
}

function formatPretty(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
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
