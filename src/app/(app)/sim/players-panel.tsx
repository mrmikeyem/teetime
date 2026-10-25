"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { eligibleByPlayer, type WheelSettings } from "@/lib/sim-wheel";
import { CourseSearchModal } from "./course-modals";
import { TallyBadge } from "./result-sheet";
import { ErrorNote, Modal, simApi, type CoursePick, type HubEntry, type HubPlayer } from "./ui";

export function PlayersPanel({
  players,
  viewerId,
  isAdmin,
  settings,
  skipped,
  adjustTallies,
  onInfo,
}: {
  players: HubPlayer[];
  viewerId: string;
  isAdmin: boolean;
  settings: WheelSettings;
  skipped: ReadonlySet<string>;
  adjustTallies: boolean;
  onInfo: (apiId: string) => void;
}) {
  const router = useRouter();
  // Mirrors canEditList / canRemovePlayer in lib/sim.ts (the API enforces it).
  const canEdit = (p: HubPlayer) => (p.userId ? p.userId === viewerId : isAdmin);
  const canRemove = (p: HubPlayer) => isAdmin && p.isGuest;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<HubPlayer | null>(null);
  const [linking, setLinking] = useState<HubEntry | null>(null);

  // Which list rows actually feed the wheel right now (checked, not skipped,
  // within the per-player limit) — others render faded.
  const onWheel = new Set(
    eligibleByPlayer(players, settings, skipped).flatMap((g) => g.entries.map((e) => e.entryId))
  );

  async function run(p: Promise<{ ok: boolean; error?: string }>) {
    setError("");
    const res = await p;
    if (!res.ok) setError(res.error ?? "Something went wrong");
    router.refresh();
    return res.ok;
  }

  return (
    <section className="sim-card p-4">
      <h2 className="sim-heading mb-3 text-lg font-bold">Players &amp; Courses</h2>
      <AddGuest run={run} />
      <ErrorNote error={error} />

      <div className="mt-3 space-y-2">
        {players.length === 0 && <p className="sim-muted py-4 text-center text-sm">No players yet</p>}
        <AnimatePresence initial={false}>
          {players.map((p) => (
            <motion.div
              key={p.id}
              layout="position"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <PlayerCard
                player={p}
                isYou={p.userId === viewerId}
                canEdit={canEdit(p)}
                canRemove={canRemove(p)}
                open={expanded.has(p.id)}
                onToggleOpen={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(p.id)) next.delete(p.id);
                    else next.add(p.id);
                    return next;
                  })
                }
                showTally={settings.tallyEnabled}
                adjustTallies={adjustTallies}
                skipped={skipped}
                onWheel={onWheel}
                run={run}
                onRemove={() => setRemoving(p)}
                onInfo={onInfo}
                onLink={setLinking}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <RemoveGuestModal player={removing} onClose={() => setRemoving(null)} run={run} />
      <CourseSearchModal
        open={linking !== null}
        onClose={() => setLinking(null)}
        initialQuery={linking?.courseName ?? ""}
        title={`🔗 Link “${linking?.courseName ?? ""}”`}
        asTyped={false}
        onInfo={onInfo}
        onPick={async (c) => {
          const entry = linking;
          setLinking(null);
          if (entry) await run(simApi(`/api/sim/courses/${entry.courseId}/link`, "POST", c));
        }}
      />
    </section>
  );
}

/** Members are on the wheel automatically — this only adds guests. */
function AddGuest({
  run,
}: {
  run: (p: Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
}) {
  const [guestName, setGuestName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!guestName.trim() || busy) return;
    setBusy(true);
    const ok = await run(simApi("/api/sim/players", "POST", { guestName }));
    setBusy(false);
    if (ok) setGuestName("");
  }

  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <input
        className="sim-input flex-1"
        placeholder="Add a guest (not a member)…"
        value={guestName}
        onChange={(e) => setGuestName(e.target.value)}
      />
      <button type="submit" className="sim-btn sim-btn-primary" disabled={busy || !guestName.trim()}>
        Add
      </button>
    </form>
  );
}

function PlayerCard({
  player,
  isYou,
  canEdit,
  canRemove,
  open,
  onToggleOpen,
  showTally,
  adjustTallies,
  skipped,
  onWheel,
  run,
  onRemove,
  onInfo,
  onLink,
}: {
  player: HubPlayer;
  isYou: boolean;
  canEdit: boolean;
  canRemove: boolean;
  open: boolean;
  onToggleOpen: () => void;
  showTally: boolean;
  adjustTallies: boolean;
  skipped: ReadonlySet<string>;
  onWheel: Set<string>;
  run: (p: Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
  onRemove: () => void;
  onInfo: (apiId: string) => void;
  onLink: (entry: HubEntry) => void;
}) {
  const [checked, setChecked] = useState(player.checked);
  const [prevChecked, setPrevChecked] = useState(player.checked);
  // Server prop wins whenever it changes (another device toggled it).
  if (player.checked !== prevChecked) {
    setPrevChecked(player.checked);
    setChecked(player.checked);
  }

  // Optimistic drag order, dropped as soon as the server's list differs.
  const [order, setOrder] = useState<{ basis: string; ids: string[] } | null>(null);
  const basis = player.list.map((e) => e.entryId).join(",");
  const list =
    order && order.basis === basis
      ? order.ids.map((id) => player.list.find((e) => e.entryId === id)!).filter(Boolean)
      : player.list;

  const [newCourse, setNewCourse] = useState("");
  const [searching, setSearching] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = list.map((x) => x.entryId);
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    setOrder({ basis, ids: next });
    await run(simApi(`/api/sim/players/${player.id}/courses`, "PUT", { entryIds: next }));
  }

  async function addCourse(c: CoursePick) {
    const ok = await run(simApi(`/api/sim/players/${player.id}/courses`, "POST", c));
    if (ok) setNewCourse("");
  }

  return (
    <div
      className="rounded-[calc(var(--sim-radius)*0.8)] border transition-colors"
      style={{
        borderColor: checked ? "var(--sim-primary)" : "var(--sim-border)",
        background: checked ? "var(--sim-primary-soft)" : "var(--sim-surface-2)",
      }}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--sim-primary)]"
          checked={checked}
          aria-label={`${player.name} is playing`}
          onChange={async (e) => {
            setChecked(e.target.checked);
            await run(simApi(`/api/sim/players/${player.id}`, "PATCH", { checked: e.target.checked }));
          }}
        />
        <button type="button" onClick={onToggleOpen} className="min-w-0 flex-1 text-left font-semibold">
          {player.name}
          {player.isGuest && <span className="sim-muted ml-1 text-xs font-normal">(guest)</span>}
          {isYou && <span className="sim-muted ml-1 text-xs font-normal">(you)</span>}{" "}
          <span className="sim-muted font-normal">({player.list.length})</span>
        </button>
        {!checked && canRemove && (
          <button type="button" className="sim-btn sim-btn-danger px-2 py-1 text-xs" onClick={onRemove}>
            Remove
          </button>
        )}
        <motion.button
          type="button"
          aria-label={open ? "Collapse" : "Expand"}
          onClick={onToggleOpen}
          animate={{ rotate: open ? 180 : 0 }}
          className="px-1 text-sm"
        >
          ▼
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 px-2 pb-3">
              {list.length === 0 && <p className="sim-muted px-2 py-2 text-sm">No courses added</p>}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={list.map((e) => e.entryId)} strategy={verticalListSortingStrategy}>
                  {list.map((entry) => (
                    <CourseRow
                      key={entry.entryId}
                      entry={entry}
                      canEdit={canEdit}
                      showTally={showTally}
                      adjustTallies={adjustTallies}
                      skipped={skipped.has(entry.courseId)}
                      onWheel={onWheel.has(entry.entryId)}
                      run={run}
                      onInfo={onInfo}
                      onLink={onLink}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {!canEdit && (
                <p className="sim-muted px-2 pt-1 text-xs">Only {player.name} can change this list.</p>
              )}
              {canEdit && (
              <form
                className="flex gap-1.5 pt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newCourse.trim();
                  if (name) addCourse({ name, apiId: null, city: null, state: null, country: null });
                }}
              >
                <input
                  className="sim-input"
                  placeholder="Add course…"
                  value={newCourse}
                  onChange={(e) => setNewCourse(e.target.value)}
                />
                <button
                  type="button"
                  className="sim-btn sim-btn-ghost shrink-0 px-2.5"
                  title="Search the course database"
                  onClick={() => setSearching(true)}
                >
                  🔍
                </button>
                <button type="submit" className="sim-btn sim-btn-primary shrink-0" disabled={!newCourse.trim()}>
                  Add
                </button>
              </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CourseSearchModal
        open={searching}
        onClose={() => setSearching(false)}
        initialQuery={newCourse}
        title={`🔍 Add a course for ${player.name}`}
        asTyped
        onInfo={onInfo}
        onPick={(c) => {
          setSearching(false);
          addCourse(c);
        }}
      />
    </div>
  );
}

function CourseRow({
  entry,
  canEdit,
  showTally,
  adjustTallies,
  skipped,
  onWheel,
  run,
  onInfo,
  onLink,
}: {
  entry: HubEntry;
  canEdit: boolean;
  showTally: boolean;
  adjustTallies: boolean;
  skipped: boolean;
  onWheel: boolean;
  run: (p: Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
  onInfo: (apiId: string) => void;
  onLink: (entry: HubEntry) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.entryId,
    disabled: !canEdit,
  });
  const [armed, setArmed] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        background: "var(--sim-item)",
        borderLeft: `4px solid ${entry.apiId ? "var(--sim-primary)" : "var(--sim-border)"}`,
        zIndex: isDragging ? 10 : undefined,
        boxShadow: isDragging ? "var(--sim-shadow)" : undefined,
        opacity: skipped ? 0.45 : onWheel ? 1 : 0.65,
      }}
      className="flex items-center gap-2 rounded-md px-2 py-2"
    >
      {canEdit && (
        <button
          type="button"
          className="sim-muted cursor-grab touch-none px-1 active:cursor-grabbing"
          aria-label={`Drag to reorder ${entry.courseName}`}
          {...attributes}
          {...listeners}
        >
          ☰
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-semibold ${skipped ? "line-through" : ""}`}>{entry.courseName}</div>
        {entry.location && <div className="sim-muted truncate text-xs">{entry.location}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {entry.apiId ? (
          <button type="button" title="Course info" className="px-0.5 text-sm" onClick={() => onInfo(entry.apiId!)}>
            ℹ️
          </button>
        ) : (
          <button type="button" title="Link to course database" className="px-0.5 text-sm" onClick={() => onLink(entry)}>
            🔗
          </button>
        )}
        {showTally &&
          (adjustTallies ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                className="sim-btn sim-btn-ghost h-6 w-6 p-0 text-sm leading-none"
                onClick={() => run(simApi(`/api/sim/entries/${entry.entryId}`, "PATCH", { delta: -1 }))}
              >
                −
              </button>
              <TallyBadge value={entry.tally} />
              <button
                type="button"
                className="sim-btn sim-btn-ghost h-6 w-6 p-0 text-sm leading-none"
                onClick={() => run(simApi(`/api/sim/entries/${entry.entryId}`, "PATCH", { delta: 1 }))}
              >
                +
              </button>
            </span>
          ) : (
            <TallyBadge value={entry.tally} />
          ))}
        {canEdit && (
        <button
          type="button"
          title={armed ? "Tap again to remove" : "Remove from list"}
          className="ml-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold text-white transition-all"
          style={{ background: "var(--sim-danger)" }}
          onClick={() => {
            if (!armed) {
              setArmed(true);
              setTimeout(() => setArmed(false), 3000);
              return;
            }
            run(simApi(`/api/sim/entries/${entry.entryId}`, "DELETE"));
          }}
        >
          {armed ? "Remove?" : "✕"}
        </button>
        )}
      </div>
    </div>
  );
}

function RemoveGuestModal({
  player,
  onClose,
  run,
}: {
  player: HubPlayer | null;
  onClose: () => void;
  run: (p: Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
}) {
  const [typed, setTyped] = useState("");
  return (
    <Modal
      open={player !== null}
      onClose={() => {
        setTyped("");
        onClose();
      }}
      title="⚠️ Remove guest"
    >
      {player && (
        <div className="space-y-3 text-sm">
          <p>
            Remove <strong>{player.name}</strong> and their {player.list.length} course
            {player.list.length === 1 ? "" : "s"} from the wheel? Their play history stays in the log.
          </p>
          <p className="font-semibold" style={{ color: "var(--sim-danger)" }}>
            Type REMOVE to confirm:
          </p>
          <input className="sim-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="REMOVE" />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="sim-btn sim-btn-ghost"
              onClick={() => {
                setTyped("");
                onClose();
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sim-btn sim-btn-danger"
              disabled={typed !== "REMOVE"}
              onClick={async () => {
                const id = player.id;
                setTyped("");
                onClose();
                await run(simApi(`/api/sim/players/${id}`, "DELETE"));
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
