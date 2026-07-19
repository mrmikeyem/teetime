"use client";

import Link from "next/link";
import { useState } from "react";
import { Countdown } from "./countdown";
import { TeeTimeCalendar } from "./calendar";
import { WeatherChip } from "./weather-chip";
import { EventCard, type EventCardData } from "./event-card";
import type { WeatherSummary } from "@/lib/weather";

export type TeeTimeListItem = {
  id: string;
  course: string;
  name: string | null;
  teeOffAt: string;
  partySize: number | null;
  teamSize: number | null;
  type: "TEE_TIME" | "TOURNAMENT";
  creatorName: string;
  /** True when the tee time belongs to an event round — it renders collapsed
   *  under the event's card instead of as its own list entry. */
  inEvent: boolean;
  members: { name: string; confirmed: boolean }[];
  weather: WeatherSummary | null;
};

export type DailyWeatherEntry = {
  date: string;
  tempF: number;
  icon: string;
  condition: string;
};

/** One row in the unified "everything scheduled" feed. */
type FeedEntry =
  | { kind: "teeTime"; sortKey: string; teeTime: TeeTimeListItem }
  | { kind: "event"; sortKey: string; event: EventCardData };

export function ListWithCalendar({
  teeTimes,
  events = [],
  dailyWeather,
}: {
  teeTimes: TeeTimeListItem[];
  events?: EventCardData[];
  dailyWeather: DailyWeatherEntry[];
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dailyMap = new Map(dailyWeather.map((d) => [d.date, d]));

  // The calendar sees every tee time, event ones included.
  const byDate = new Map<string, TeeTimeListItem[]>();
  for (const t of teeTimes) {
    const key = isoLocalDate(new Date(t.teeOffAt));
    const list = byDate.get(key) ?? [];
    list.push(t);
    byDate.set(key, list);
  }

  // The feed is everything scheduled, chronologically: standalone tee times,
  // tournaments, and event cards (whose tee times collapse under them).
  const feed: FeedEntry[] = [
    ...teeTimes
      .filter((t) => !t.inEvent)
      .map(
        (t): FeedEntry => ({ kind: "teeTime", sortKey: t.teeOffAt, teeTime: t })
      ),
    ...events.map(
      (ev): FeedEntry => ({ kind: "event", sortKey: ev.sortKey, event: ev })
    ),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return (
    <div className="space-y-4">
      {feed.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          No upcoming tee times. Be the first to put one on the board.
        </p>
      ) : (
        <ul className="space-y-3">
          {feed.map((entry) => {
            if (entry.kind === "event") {
              return (
                <li key={`event-${entry.event.id}`}>
                  <EventCard event={entry.event} />
                </li>
              );
            }
            const t = entry.teeTime;
            const teeOff = new Date(t.teeOffAt);
            const isTournament = t.type === "TOURNAMENT";
            const confirmed = t.members.filter((m) => m.confirmed).length;
            const tooManyConfirmed =
              !isTournament && t.partySize != null && confirmed > t.partySize;
            const overCapacity =
              !isTournament &&
              t.partySize != null &&
              t.members.length > t.partySize;
            return (
              <li
                key={t.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <Link href={`/tee-times/${t.id}`} className="block space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-semibold">
                      {isTournament && <span aria-hidden>🏆 </span>}
                      {isTournament && t.name ? t.name : t.course}
                    </h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(teeOff)}
                    </span>
                  </div>
                  {isTournament && t.name && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      at {t.course}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <span>
                      {formatTime(teeOff)} — {t.creatorName}
                    </span>
                    <Countdown
                      teeOffAt={t.teeOffAt}
                      className="text-xs text-emerald-700 dark:text-emerald-400"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {isTournament ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Tournament{t.teamSize ? ` · ${t.teamSize}-man` : ""} ·{" "}
                        {t.members.length} playing
                      </span>
                    ) : (
                      <>
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            tooManyConfirmed
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : confirmed === t.partySize
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          }`}
                        >
                          {confirmed}/{t.partySize} confirmed
                        </span>
                        {overCapacity && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            ⚠️ {t.members.length}/{t.partySize}
                          </span>
                        )}
                      </>
                    )}
                    {t.weather && <WeatherChip weather={t.weather} />}
                    <span className="truncate text-gray-500 dark:text-gray-400">
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

      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setCalendarOpen((v) => !v)}
          aria-expanded={calendarOpen}
          className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <span>{calendarOpen ? "Hide calendar" : "Browse the calendar"}</span>
          <span aria-hidden className="text-gray-400 dark:text-gray-500">
            {calendarOpen ? "▾" : "▸"}
          </span>
        </button>
        {calendarOpen && (
          <div className="border-t border-gray-100 p-3 dark:border-gray-800">
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
