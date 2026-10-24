"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CourseSearchModal, TeePicker } from "./course-modals";
import {
  ErrorNote,
  Modal,
  PlayerChips,
  ctInputParts,
  formatPlayDate,
  simApi,
  teeColorClass,
  teeLabel,
  type CoursePick,
  type HubPlay,
  type TeePick,
} from "./ui";

type PlayerOption = { id: string; name: string };

const COLLAPSED_COUNT = 5;

export function PlayLog({
  plays,
  players,
  onInfo,
}: {
  plays: HubPlay[];
  /** Active players — chip options for edit / manual entry. */
  players: PlayerOption[];
  onInfo: (apiId: string) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<HubPlay | null>(null);
  const [linking, setLinking] = useState<HubPlay | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? plays.filter((p) =>
        [
          p.courseName,
          p.comment,
          p.suggesters.map((s) => s.name).join(" "),
          p.players.map((s) => s.name).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : plays;
  const shown = expanded || q ? filtered : filtered.slice(0, COLLAPSED_COUNT);

  return (
    <section className="sim-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="sim-heading text-lg font-bold">Play Log</h2>
        <span className="sim-muted text-xs">
          {plays.length} round{plays.length === 1 ? "" : "s"}
        </span>
      </div>
      <input
        className="sim-input mb-3"
        placeholder="Search plays…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {plays.length === 0 ? (
        <p className="sim-muted py-4 text-center text-sm">No plays logged yet</p>
      ) : filtered.length === 0 ? (
        <p className="sim-muted py-4 text-center text-sm">No matching plays found</p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {shown.map((p) => (
              <motion.article
                key={p.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className="relative rounded-lg border-l-4 p-3 pr-10"
                style={{
                  background: "var(--sim-surface-2)",
                  borderColor: p.apiId ? "var(--sim-primary)" : "var(--sim-border)",
                }}
              >
                <button
                  type="button"
                  title="Edit entry"
                  onClick={() => setEditing(p)}
                  className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-sm hover:opacity-70"
                >
                  ✏️
                </button>
                <div className="flex flex-wrap items-center gap-x-1.5 font-semibold" style={{ color: "var(--sim-primary)" }}>
                  <span>{p.courseName}</span>
                  {p.apiId ? (
                    <button type="button" title="Course info" className="text-xs" onClick={() => onInfo(p.apiId!)}>
                      ℹ️
                    </button>
                  ) : (
                    <button type="button" title="Link to course database" className="text-xs" onClick={() => setLinking(p)}>
                      🔗
                    </button>
                  )}
                </div>
                {p.tee && <span className={`sim-tee ${teeColorClass(p.tee.name)} mt-1`}>{teeLabel(p.tee)}</span>}
                {p.location && <p className="sim-muted mt-1 text-xs">📍 {p.location}</p>}
                <p className="mt-1 text-xs">
                  {p.suggesters.length > 0 ? (
                    <>Suggested by: {p.suggesters.map((s) => s.name).join(", ")}</>
                  ) : (
                    <span className="sim-muted">Manual entry</span>
                  )}
                </p>
                {p.players.length > 0 && (
                  <p className="text-xs" style={{ color: "var(--sim-primary)" }}>
                    Players: {p.players.map((s) => s.name).join(", ")}
                  </p>
                )}
                {p.comment && <p className="mt-1.5 whitespace-pre-wrap text-sm italic">“{p.comment}”</p>}
                <div className="mt-2 flex justify-end">
                  <span className="sim-muted rounded-full px-2.5 py-0.5 text-xs" style={{ background: "var(--sim-surface)" }}>
                    {formatPlayDate(p.playedAt, p.dateOnly)}
                  </span>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
          {!q && filtered.length > COLLAPSED_COUNT && (
            <button
              type="button"
              className="sim-btn sim-btn-ghost w-full"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "▲ Show less" : `▼ Show all (${filtered.length} total)`}
            </button>
          )}
        </div>
      )}

      <ManualEntry players={players} onInfo={onInfo} />

      <EditPlayModal
        play={editing}
        players={players}
        onClose={() => setEditing(null)}
        onInfo={onInfo}
      />
      <CourseSearchModal
        open={linking !== null}
        onClose={() => setLinking(null)}
        initialQuery={linking?.courseName ?? ""}
        title={`🔗 Link “${linking?.courseName ?? ""}”`}
        asTyped={false}
        onInfo={onInfo}
        onPick={async (c) => {
          const play = linking;
          setLinking(null);
          if (play) {
            await simApi(`/api/sim/courses/${play.courseId}/link`, "POST", c);
            router.refresh();
          }
        }}
      />
    </section>
  );
}

/** Union of active players and anyone already on the play (e.g. archived). */
function chipOptions(players: PlayerOption[], play: HubPlay | null): PlayerOption[] {
  const map = new Map(players.map((p) => [p.id, p]));
  for (const x of [...(play?.players ?? []), ...(play?.suggesters ?? [])]) {
    if (!map.has(x.playerId)) map.set(x.playerId, { id: x.playerId, name: x.name });
  }
  return Array.from(map.values());
}

function toggle(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function EditPlayModal({
  play,
  players,
  onClose,
  onInfo,
}: {
  play: HubPlay | null;
  players: PlayerOption[];
  onClose: () => void;
  onInfo: (apiId: string) => void;
}) {
  return (
    <Modal open={play !== null} onClose={onClose} title="✏️ Edit play log entry" wide>
      {play && <EditBody key={play.id} play={play} options={chipOptions(players, play)} onClose={onClose} onInfo={onInfo} />}
    </Modal>
  );
}

function EditBody({
  play,
  options,
  onClose,
  onInfo,
}: {
  play: HubPlay;
  options: PlayerOption[];
  onClose: () => void;
  onInfo: (apiId: string) => void;
}) {
  const router = useRouter();
  const initial = ctInputParts(play.playedAt);
  const [course, setCourse] = useState<CoursePick>({
    name: play.courseName,
    apiId: play.apiId,
    city: play.city,
    state: play.state,
    country: play.country,
  });
  const [unlinked, setUnlinked] = useState(false);
  const [suggesters, setSuggesters] = useState(new Set(play.suggesters.map((s) => s.playerId)));
  const [playersOn, setPlayersOn] = useState(new Set(play.players.map((s) => s.playerId)));
  const [tee, setTee] = useState<TeePick | null>(play.tee);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(play.dateOnly ? "" : initial.time);
  const [comment, setComment] = useState(play.comment);
  const [searching, setSearching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!course.name.trim()) {
      setError("Course name is required");
      return;
    }
    setBusy(true);
    setError("");
    const res = await simApi(`/api/sim/plays/${play.id}`, "PATCH", {
      course: { ...course, name: course.name.trim() },
      unlinked,
      tee,
      date,
      time,
      comment,
      suggesterIds: [...suggesters],
      playerIds: [...playersOn],
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="space-y-3 text-sm">
      <Field label="Course">
        <div className="flex gap-1.5">
          <input
            className="sim-input"
            value={course.name}
            onChange={(e) => {
              // Editing the name by hand breaks the database link.
              setCourse({ name: e.target.value, apiId: null, city: null, state: null, country: null });
              setUnlinked(true);
            }}
          />
          <button type="button" className="sim-btn sim-btn-ghost shrink-0 px-2.5" title="Search database" onClick={() => setSearching(true)}>
            🔍
          </button>
        </div>
        {course.apiId && (
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: "var(--sim-primary-soft)" }}>
              🔗 Linked
            </span>
            <button type="button" onClick={() => onInfo(course.apiId!)} className="underline">
              {[course.city, course.state].filter(Boolean).join(", ") || "Course info"}
            </button>
            <button
              type="button"
              className="sim-muted ml-auto"
              title="Remove link"
              onClick={() => {
                setCourse({ ...course, apiId: null, city: null, state: null, country: null });
                setUnlinked(true);
              }}
            >
              ✕ unlink
            </button>
          </div>
        )}
      </Field>
      <Field label="Suggested by">
        <PlayerChips players={options} selected={suggesters} onToggle={(id) => setSuggesters((s) => toggle(s, id))} />
      </Field>
      <Field label="Players">
        <PlayerChips players={options} selected={playersOn} onToggle={(id) => setPlayersOn((s) => toggle(s, id))} />
      </Field>
      <Field label="Tees played">
        <TeePicker key={course.apiId ?? "free"} apiId={course.apiId} initial={tee} onChange={setTee} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date">
          <input type="date" className="sim-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time (Central)">
          <input type="time" className="sim-input" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea
          className="sim-input min-h-20"
          placeholder="Notes about this round…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Field>
      <ErrorNote error={error} />
      <div className="flex flex-wrap justify-between gap-2 pt-1">
        <button type="button" className="sim-btn sim-btn-danger" onClick={() => setDeleting(true)}>
          🗑️ Delete
        </button>
        <div className="flex gap-2">
          <button type="button" className="sim-btn sim-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="sim-btn sim-btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <CourseSearchModal
        open={searching}
        onClose={() => setSearching(false)}
        initialQuery={course.name}
        title="🔍 Link course"
        asTyped={false}
        onInfo={onInfo}
        onPick={(c) => {
          setSearching(false);
          setCourse(c);
          setUnlinked(false);
        }}
      />
      <DeletePlayModal
        open={deleting}
        play={play}
        onClose={() => setDeleting(false)}
        onDeleted={() => {
          setDeleting(false);
          router.refresh();
          onClose();
        }}
      />
    </div>
  );
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I

function DeletePlayModal({
  open,
  play,
  onClose,
  onDeleted,
}: {
  open: boolean;
  play: HubPlay;
  onClose: () => void;
  onDeleted: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="⚠️ Delete play log entry">
      {open && <DeleteBody play={play} onClose={onClose} onDeleted={onDeleted} />}
    </Modal>
  );
}

function DeleteBody({ play, onClose, onDeleted }: { play: HubPlay; onClose: () => void; onDeleted: () => void }) {
  const [code] = useState(() =>
    Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("")
  );
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg p-3" style={{ background: "var(--sim-surface-2)" }}>
        <strong>{play.courseName}</strong>
        <div className="sim-muted text-xs">{formatPlayDate(play.playedAt, true)}</div>
      </div>
      <p>
        Type the code <strong className="font-mono text-base tracking-widest">{code}</strong> to confirm:
      </p>
      <input className="sim-input font-mono uppercase" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Enter code" />
      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="sim-btn sim-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="sim-btn sim-btn-danger"
          disabled={typed.trim().toUpperCase() !== code}
          onClick={async () => {
            const res = await simApi(`/api/sim/plays/${play.id}`, "DELETE");
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onDeleted();
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/** Log a past round by hand (the old app's form here was broken). */
function ManualEntry({ players, onInfo }: { players: PlayerOption[]; onInfo: (apiId: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState<CoursePick>({ name: "", apiId: null, city: null, state: null, country: null });
  const [suggesters, setSuggesters] = useState<Set<string>>(new Set());
  const [playersOn, setPlayersOn] = useState<Set<string>>(new Set());
  const [tee, setTee] = useState<TeePick | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [comment, setComment] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);

  async function submit() {
    if (!course.name.trim()) return setError("Enter a course name");
    if (!date) return setError("Pick a date");
    setBusy(true);
    setError("");
    const res = await simApi("/api/sim/plays", "POST", {
      course: { ...course, name: course.name.trim() },
      tee,
      date,
      time,
      comment,
      suggesterIds: [...suggesters],
      playerIds: [...playersOn],
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setCourse({ name: "", apiId: null, city: null, state: null, country: null });
    setSuggesters(new Set());
    setPlayersOn(new Set());
    setTee(null);
    setDate("");
    setTime("");
    setComment("");
    setFormKey((k) => k + 1);
    router.refresh();
  }

  return (
    <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--sim-border)" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold">
        ➕ Add manual entry
        <motion.span animate={{ rotate: open ? 180 : 0 }}>▼</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div key={formKey} className="space-y-3 pt-3 text-sm">
              <Field label="Course">
                <div className="flex gap-1.5">
                  <input
                    className="sim-input"
                    placeholder="Course name"
                    value={course.name}
                    onChange={(e) => setCourse({ name: e.target.value, apiId: null, city: null, state: null, country: null })}
                  />
                  <button type="button" className="sim-btn sim-btn-ghost shrink-0 px-2.5" title="Search database" onClick={() => setSearching(true)}>
                    🔍
                  </button>
                </div>
                {course.apiId && <p className="mt-1 text-xs">🔗 Linked · {[course.city, course.state].filter(Boolean).join(", ")}</p>}
              </Field>
              <Field label="Suggested by">
                <PlayerChips players={players} selected={suggesters} onToggle={(id) => setSuggesters((s) => toggle(s, id))} />
              </Field>
              <Field label="Players">
                <PlayerChips players={players} selected={playersOn} onToggle={(id) => setPlayersOn((s) => toggle(s, id))} />
              </Field>
              <Field label="Tees played">
                <TeePicker key={course.apiId ?? "free"} apiId={course.apiId} initial={null} onChange={setTee} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Date">
                  <input type="date" className="sim-input" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Time (optional)">
                  <input type="time" className="sim-input" value={time} onChange={(e) => setTime(e.target.value)} />
                </Field>
              </div>
              <Field label="Notes">
                <textarea className="sim-input min-h-16" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Who won? From which tees?" />
              </Field>
              <ErrorNote error={error} />
              <button type="button" className="sim-btn sim-btn-primary w-full" disabled={busy} onClick={submit}>
                {busy ? "Adding…" : "Add to log"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <CourseSearchModal
        open={searching}
        onClose={() => setSearching(false)}
        initialQuery={course.name}
        title="🔍 Find the course"
        asTyped
        onInfo={onInfo}
        onPick={(c) => {
          setSearching(false);
          setCourse(c);
        }}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // A div, not a <label>: clicking a label's text would "click" the first
    // chip button inside it.
    <div>
      <span className="sim-muted mb-1 block text-xs font-semibold uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
}
