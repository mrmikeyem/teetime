"use client";

import Link from "next/link";
import { useState } from "react";
import { Countdown } from "./countdown";
import { TeeTimeCalendar } from "./calendar";

export type TeeTimeListItem = {
  id: string;
  course: string;
  teeOffAt: string;
  partySize: number;
  creatorName: string;
  members: { name: string; confirmed: boolean }[];
  weather: { tempF: number; icon: string } | null;
};

export type DailyWeatherEntry = {
  date: string;
  tempF: number;
  icon: string;
  condition: string;
};

export function ListWithCalendar({
  teeTimes,
  dailyWeather,
}: {
  teeTimes: TeeTimeListItem[];
  dailyWeather: DailyWeatherEntry[];
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dailyMap = new Map(dailyWeather.map((d) => [d.date, d]));

  const byDate = new Map<string, TeeTimeListItem[]>();
  for (const t of teeTimes) {
    const key = isoLocalDate(new Date(t.teeOffAt));
    const list = byDate.get(key) ?? [];
    list.push(t);
    byDate.set(key, list);
  }

  return (
    <div className="space-y-4">
      {teeTimes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          No upcoming tee times. Be the first to put one on the board.
        </p>
      ) : (
        <ul className="space-y-3">
          {teeTimes.map((t) => {
            const teeOff = new Date(t.teeOffAt);
            const confirmed = t.members.filter((m) => m.confirmed).length;
            const tooManyConfirmed = confirmed > t.partySize;
            const overCapacity = t.members.length > t.partySize;
            return (
              <li
                key={t.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <Link href={`/tee-times/${t.id}`} className="block space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-semibold">{t.course}</h2>
                    <span className="text-xs text-gray-500">
                      {formatDate(teeOff)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm text-gray-600">
                    <span>
                      {formatTime(teeOff)} — {t.creatorName}
                    </span>
                    <Countdown
                      teeOffAt={t.teeOffAt}
                      className="text-xs text-emerald-700"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        tooManyConfirmed
                          ? "bg-red-100 text-red-700"
                          : confirmed === t.partySize
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {confirmed}/{t.partySize} confirmed
                    </span>
                    {overCapacity && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                        ⚠️ {t.members.length}/{t.partySize}
                      </span>
                    )}
                    <span className="truncate text-gray-500">
                      {t.members.length === 0
                        ? "no one yet"
                        : t.members.map((m) => m.name).join(", ")}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setCalendarOpen((v) => !v)}
          aria-expanded={calendarOpen}
          className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <span>{calendarOpen ? "Hide calendar" : "Browse the calendar"}</span>
          <span aria-hidden className="text-gray-400">
            {calendarOpen ? "▾" : "▸"}
          </span>
        </button>
        {calendarOpen && (
          <div className="border-t border-gray-100 p-3">
            <TeeTimeCalendar teeTimesByDate={byDate} dailyWeather={dailyMap} />
          </div>
        )}
      </div>
    </div>
  );
}

function isoLocalDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}
