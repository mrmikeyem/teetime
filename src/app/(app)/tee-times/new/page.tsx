"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MemberPicker, type PickerItem } from "../member-picker";
import { WeatherPreview } from "./weather-preview";

const COURSE_SHORTCUTS = [
  "Kings Walk",
  "Valley Golf Course",
  "Lincoln Park",
  "Larimore",
  "Fertile",
];

export default function NewTeeTimePage() {
  return (
    <Suspense>
      <NewTeeTimeForm />
    </Suspense>
  );
}

function NewTeeTimeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date") ?? "";
  const { data: session } = useSession();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [staged, setStaged] = useState<PickerItem[]>([]);
  const [partySize, setPartySize] = useState(4);
  const [course, setCourse] = useState("");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState("15:30");
  const courseRef = useRef<HTMLInputElement>(null);

  const creator: PickerItem | null = session?.user
    ? { kind: "user", id: session.user.id, name: session.user.name }
    : null;

  function addStaged(item: PickerItem) {
    setStaged((prev) =>
      prev.find((p) => p.kind === item.kind && p.id === item.id)
        ? prev
        : [...prev, item]
    );
  }

  function removeStaged(item: PickerItem) {
    setStaged((prev) =>
      prev.filter((p) => !(p.kind === item.kind && p.id === item.id))
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const courseValue = course.trim();
    const notes = (formData.get("notes") as string).trim() || null;

    const teeOffAt = new Date(`${date}T${time}`).toISOString();

    const res = await fetch("/api/tee-times", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course: courseValue,
        teeOffAt,
        partySize,
        notes,
        memberUserIds: staged.filter((s) => s.kind === "user").map((s) => s.id),
        memberGuestIds: staged.filter((s) => s.kind === "guest").map((s) => s.id),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create");
      setLoading(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/tee-times/${id}`);
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 space-y-6">
      <Link
        href="/tee-times"
        className="text-sm text-emerald-700 hover:underline"
      >
        ← Back to tee times
      </Link>
      <h1 className="text-2xl font-bold">New tee time</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium" htmlFor="course">
            Course
          </label>
          <input
            id="course"
            name="course"
            ref={courseRef}
            required
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            placeholder="Kings Walk, Grand Forks"
            className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COURSE_SHORTCUTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCourse(c)}
                className="rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-800 dark:hover:text-emerald-300"
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <label className="block text-sm font-medium" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full min-w-0 appearance-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="block text-sm font-medium" htmlFor="time">
              Tee off
            </label>
            <input
              id="time"
              name="time"
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 block w-full min-w-0 appearance-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
            />
          </div>
        </div>

        <WeatherPreview course={course} date={date} time={time} />

        <div>
          <label className="block text-sm font-medium">Party size</label>
          <div className="mt-1 flex gap-2">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPartySize(n)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                  partySize === n
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:border-emerald-700"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium" htmlFor="notes">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label className="block text-sm font-medium">
              Add players (optional)
            </label>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {staged.length + (creator ? 1 : 0)} of {partySize}
            </span>
          </div>

          <ul className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
            {creator && (
              <li className="flex items-center justify-between rounded-md bg-white dark:bg-gray-900 px-3 py-1.5 text-sm shadow-sm">
                <span className="flex items-center gap-2">
                  <span className="text-emerald-700">✓</span>
                  <span>{creator.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-emerald-700">
                    booker
                  </span>
                </span>
              </li>
            )}
            {staged.map((s) => (
              <li
                key={`${s.kind}-${s.id}`}
                className="flex items-center justify-between rounded-md bg-white dark:bg-gray-900 px-3 py-1.5 text-sm shadow-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="text-emerald-700">✓</span>
                  <span>{s.name}</span>
                  {s.kind === "guest" && (
                    <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      guest
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removeStaged(s)}
                  aria-label={`Remove ${s.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-300"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <MemberPicker
            excludeUserIds={[
              ...(creator ? [creator.id] : []),
              ...staged.filter((s) => s.kind === "user").map((s) => s.id),
            ]}
            excludeGuestIds={staged
              .filter((s) => s.kind === "guest")
              .map((s) => s.id)}
            onPick={addStaged}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Create tee time"}
        </button>
      </form>
    </main>
  );
}
