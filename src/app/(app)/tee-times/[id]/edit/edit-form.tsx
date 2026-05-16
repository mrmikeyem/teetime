"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const COURSE_SHORTCUTS = [
  "Kings Walk",
  "Valley Golf Course",
  "Lincoln Park",
  "Larimore",
  "Fertile",
];

export function EditForm({
  teeTimeId,
  initialCourse,
  initialDate,
  initialTime,
  initialPartySize,
  initialNotes,
}: {
  teeTimeId: string;
  initialCourse: string;
  initialDate: string;
  initialTime: string;
  initialPartySize: number;
  initialNotes: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [course, setCourse] = useState(initialCourse);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [partySize, setPartySize] = useState(initialPartySize);
  const [notes, setNotes] = useState(initialNotes);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const teeOffAt = new Date(`${date}T${time}`).toISOString();
    const res = await fetch(`/api/tee-times/${teeTimeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course: course.trim(),
        teeOffAt,
        partySize,
        notes: notes.trim() || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
      setLoading(false);
      return;
    }

    router.push(`/tee-times/${teeTimeId}`);
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 space-y-6">
      <Link
        href={`/tee-times/${teeTimeId}`}
        className="text-sm text-emerald-700 hover:underline"
      >
        ← Back
      </Link>
      <h1 className="text-2xl font-bold">Edit tee time</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
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
            required
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COURSE_SHORTCUTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCourse(c)}
                className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
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
              className="mt-1 block w-full min-w-0 appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
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
              className="mt-1 block w-full min-w-0 appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
            />
          </div>
        </div>

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
                    : "border-gray-300 bg-white text-gray-700 hover:border-emerald-700"
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
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save changes"}
        </button>
      </form>
    </main>
  );
}
