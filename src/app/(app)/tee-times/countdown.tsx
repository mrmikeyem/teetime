"use client";

import { useEffect, useState } from "react";

export function Countdown({
  teeOffAt,
  className,
}: {
  teeOffAt: string;
  className?: string;
}) {
  const target = new Date(teeOffAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (now === null) return null;

  return <span className={className}>{formatRemaining(target - now)}</span>;
}

function formatRemaining(ms: number) {
  if (ms <= 0) {
    const past = Math.abs(ms);
    if (past < 4 * 60 * 60 * 1000) return "Started";
    return "Past";
  }
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}
