"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { ErrorNote, Modal, simApi, type CoursePick, type TeePick } from "./ui";

type ApiTee = {
  tee_name: string;
  course_rating?: number | null;
  slope_rating?: number | null;
  total_yards?: number | null;
  number_of_holes?: number | null;
  par_total?: number | null;
};
type ApiCourse = {
  id: number;
  club_name?: string;
  course_name?: string;
  location?: { city?: string; state?: string; country?: string };
  tees?: { male?: ApiTee[]; female?: ApiTee[] };
};

const detailsCache = new Map<number, ApiCourse>();

async function fetchDetails(apiId: number): Promise<ApiCourse | null> {
  const hit = detailsCache.get(apiId);
  if (hit) return hit;
  const res = await simApi<{ course: ApiCourse }>(`/api/sim/courses/details/${apiId}`, "GET");
  if (!res.ok) return null;
  detailsCache.set(apiId, res.data.course);
  return res.data.course;
}

/** Course details for an API-linked course (null while loading / unlinked). */
export function useCourseDetails(apiId: number | null) {
  const [state, setState] = useState<{ apiId: number | null; course: ApiCourse | null; loading: boolean }>({
    apiId: null,
    course: null,
    loading: false,
  });
  useEffect(() => {
    if (!apiId) return;
    let live = true;
    const cached = detailsCache.get(apiId);
    // Async callback, not a synchronous setState in the effect body.
    Promise.resolve(cached ?? null).then((c) => {
      if (!live) return;
      if (c) {
        setState({ apiId, course: c, loading: false });
        return;
      }
      setState({ apiId, course: null, loading: true });
      fetchDetails(apiId).then((course) => live && setState({ apiId, course, loading: false }));
    });
    return () => {
      live = false;
    };
  }, [apiId]);
  if (!apiId || state.apiId !== apiId) return { course: null, loading: !!apiId };
  return { course: state.course, loading: state.loading };
}

/** Search GolfCourseAPI. `asTyped` adds the old "Use As Typed" escape hatch. */
export function CourseSearchModal({
  open,
  onClose,
  initialQuery,
  title,
  asTyped,
  onPick,
  onInfo,
}: {
  open: boolean;
  onClose: () => void;
  initialQuery: string;
  title: string;
  asTyped: boolean;
  onPick: (course: CoursePick) => void;
  onInfo: (apiId: number) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      {open && (
        <SearchBody
          initialQuery={initialQuery}
          asTyped={asTyped}
          onPick={onPick}
          onInfo={onInfo}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}

type Result = { apiId: number; name: string; city: string | null; state: string | null; country: string | null };

function SearchBody({
  initialQuery,
  asTyped,
  onPick,
  onInfo,
  onCancel,
}: {
  initialQuery: string;
  asTyped: boolean;
  onPick: (course: CoursePick) => void;
  onInfo: (apiId: number) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Result[] | null>(null);
  const [selected, setSelected] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function search(q = query) {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setError("Enter at least 2 characters");
      return;
    }
    setBusy(true);
    setError("");
    setSelected(null);
    const res = await simApi<{ courses: Result[] }>(`/api/sim/courses/search?q=${encodeURIComponent(trimmed)}`, "GET");
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setResults([]);
      return;
    }
    setResults(res.data.courses);
  }

  useEffect(() => {
    // Old-app behavior: opening with 2+ chars already typed searches at once.
    if (initialQuery.trim().length >= 2) {
      const t = setTimeout(() => search(initialQuery), 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          autoFocus
          className="sim-input"
          placeholder="Search courses…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="sim-btn sim-btn-primary shrink-0" disabled={busy}>
          {busy ? "…" : "Search"}
        </button>
      </form>
      <ErrorNote error={error} />

      <div className="max-h-72 space-y-1.5 overflow-y-auto">
        {results === null && !busy && (
          <p className="sim-muted py-6 text-center text-sm">Search the course database</p>
        )}
        {busy && <p className="sim-muted py-6 text-center text-sm">Searching…</p>}
        {results?.length === 0 && !busy && !error && (
          <p className="sim-muted py-6 text-center text-sm">No courses found</p>
        )}
        {!busy &&
          results?.map((r, i) => {
            const on = selected?.apiId === r.apiId;
            return (
              <motion.div
                key={r.apiId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.025, 0.3) }}
                className="flex items-start gap-2 rounded-lg border p-2.5"
                style={{
                  borderColor: on ? "var(--sim-primary)" : "var(--sim-border)",
                  background: on ? "var(--sim-primary-soft)" : "var(--sim-surface)",
                }}
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelected(r)}>
                  <div className="text-sm font-semibold">{r.name}</div>
                  <div className="sim-muted text-xs">
                    {[r.city, r.state, r.country].filter(Boolean).join(", ") || "No location data"}
                  </div>
                </button>
                <button
                  type="button"
                  title="Course details"
                  className="shrink-0 rounded px-1 text-sm hover:opacity-70"
                  onClick={() => onInfo(r.apiId)}
                >
                  ℹ️
                </button>
              </motion.div>
            );
          })}
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button type="button" className="sim-btn sim-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        {asTyped && (
          <button
            type="button"
            className="sim-btn sim-btn-secondary"
            disabled={!query.trim()}
            onClick={() =>
              onPick({ name: query.trim(), apiId: null, city: null, state: null, country: null })
            }
          >
            Use as typed
          </button>
        )}
        <button
          type="button"
          className="sim-btn sim-btn-primary"
          disabled={!selected}
          onClick={() => selected && onPick(selected)}
        >
          Use selected
        </button>
      </div>
    </div>
  );
}

export function CourseInfoModal({ apiId, onClose }: { apiId: number | null; onClose: () => void }) {
  return (
    <Modal open={apiId !== null} onClose={onClose}>
      {apiId !== null && <CourseInfoBody key={apiId} apiId={apiId} />}
    </Modal>
  );
}

function CourseInfoBody({ apiId }: { apiId: number }) {
  const { course, loading } = useCourseDetails(apiId);
  const [gender, setGender] = useState<"male" | "female">("male");

  if (loading) return <p className="sim-muted py-10 text-center text-sm">Loading course data…</p>;
  if (!course) return <p className="sim-muted py-10 text-center text-sm">Unable to load course details</p>;

  const male = course.tees?.male ?? [];
  const female = course.tees?.female ?? [];
  const tees = gender === "male" && male.length ? male : female.length ? female : male;
  const first = male[0] ?? female[0];
  const loc = course.location ?? {};
  const name = course.course_name || course.club_name || "Unknown course";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="sim-heading pr-8 text-2xl font-bold">{name}</h2>
        {course.club_name && course.club_name !== name && (
          <p className="sim-muted text-sm">{course.club_name}</p>
        )}
        <p className="mt-1 text-sm">📍 {[loc.city, loc.state, loc.country].filter(Boolean).join(", ") || "—"}</p>
        {first && (
          <p className="text-sm">
            ⛳ {first.number_of_holes ?? "?"} holes · Par {first.par_total ?? "?"}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="font-semibold">Tees</span>
        {female.length > 0 && male.length > 0 && (
          <div className="flex rounded-full p-0.5" style={{ background: "var(--sim-surface-2)" }}>
            {(["male", "female"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className="relative rounded-full px-3 py-1 text-xs font-semibold"
              >
                {gender === g && (
                  <motion.span
                    layoutId="tee-gender"
                    className="absolute inset-0 rounded-full"
                    style={{ background: "var(--sim-primary)" }}
                  />
                )}
                <span className="relative" style={{ color: gender === g ? "var(--sim-on-primary)" : "var(--sim-text)" }}>
                  {g === "male" ? "Men" : "Women"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {tees.length === 0 ? (
        <p className="sim-muted text-sm">No tee data available</p>
      ) : (
        <div className="divide-y rounded-lg border" style={{ borderColor: "var(--sim-border)" }}>
          {tees.map((t, i) => (
            <motion.div
              key={`${gender}-${t.tee_name}-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="grid grid-cols-3 gap-2 px-3 py-2 text-sm"
              style={{ borderColor: "var(--sim-border)" }}
            >
              <span className="font-semibold">{t.tee_name}</span>
              <span className="text-right">{t.total_yards ? `${t.total_yards.toLocaleString()} yds` : "—"}</span>
              <span className="sim-muted text-right">
                {t.course_rating != null ? t.course_rating.toFixed(1) : "—"} / {t.slope_rating ?? "—"}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Tee input: a dropdown of the API's men's + women's tees for a linked
 * course, else free text. Optional — `null` means no tee recorded.
 */
export function TeePicker({
  apiId,
  initial,
  onChange,
}: {
  apiId: number | null;
  initial: TeePick | null;
  onChange: (tee: TeePick | null) => void;
}) {
  const { course, loading } = useCourseDetails(apiId);
  const [text, setText] = useState(initial?.name ?? "");
  const [choice, setChoice] = useState("");

  const options = course
    ? [
        ...(course.tees?.male ?? []).map((t) => ({ t, g: "Men's" })),
        ...(course.tees?.female ?? []).map((t) => ({ t, g: "Women's" })),
      ]
    : [];

  if (apiId && loading) return <p className="sim-muted text-sm">Loading tees…</p>;

  if (options.length > 0) {
    const initialIdx = initial
      ? options.findIndex((o) => o.t.tee_name.toLowerCase() === initial.name.toLowerCase())
      : -1;
    const value = choice || (initialIdx >= 0 ? String(initialIdx) : "");
    return (
      <select
        className="sim-input"
        value={value}
        onChange={(e) => {
          setChoice(e.target.value);
          const o = options[Number(e.target.value)];
          onChange(
            e.target.value === "" || !o
              ? null
              : {
                  name: o.t.tee_name,
                  rating: o.t.course_rating ?? null,
                  slope: o.t.slope_rating ?? null,
                  yards: o.t.total_yards ?? null,
                }
          );
        }}
      >
        <option value="">— Select tees (optional) —</option>
        {options.map((o, i) => (
          <option key={i} value={i}>
            {o.t.tee_name} - {o.g} ({o.t.course_rating?.toFixed(1) ?? "—"} / {o.t.slope_rating ?? "—"} /{" "}
            {o.t.total_yards?.toLocaleString() ?? "—"} yds)
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="space-y-1">
      <input
        className="sim-input"
        placeholder="e.g. White, Blue, Gold (optional)"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const name = e.target.value.trim();
          onChange(name ? { name, rating: null, slope: null, yards: null } : null);
        }}
      />
      <p className="sim-muted text-xs">
        {apiId ? "No tee data available for this course" : "Enter the tee name"}
      </p>
    </div>
  );
}
