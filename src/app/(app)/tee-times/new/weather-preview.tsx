"use client";

import { useEffect, useState } from "react";
import type { WeatherSummary } from "@/lib/weather";
import { WeatherChip } from "../weather-chip";

export function WeatherPreview({
  course,
  date,
  time,
}: {
  course: string;
  date: string;
  time: string;
}) {
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!course.trim() || !date || !time) {
      setWeather(null);
      return;
    }
    const teeOffAt = new Date(`${date}T${time}`).toISOString();
    if (isNaN(new Date(teeOffAt).getTime())) {
      setWeather(null);
      return;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ course, teeOffAt });
        const res = await fetch(`/api/weather?${params}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setWeather(data.weather);
        }
      } catch {
        // aborted or network error — keep last value
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [course, date, time]);

  if (!course.trim() || !date || !time) return null;

  return (
    <div className="rounded-lg border border-sky-100 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-900/20 p-2 text-xs text-sky-800 dark:text-sky-300">
      {loading ? (
        <span>Checking forecast…</span>
      ) : weather ? (
        <WeatherChip weather={weather} />
      ) : (
        <span className="text-gray-500 dark:text-gray-400">
          No forecast yet — too far out or course not found.
        </span>
      )}
    </div>
  );
}
