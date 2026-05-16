"use client";

import { useState } from "react";

type Prefs = {
  reminders: boolean;
  addedTo: boolean;
  joinedByOther: boolean;
  leftByOther: boolean;
  unsubscribedAll: boolean;
};

const ROWS: Array<{
  key: keyof Omit<Prefs, "unsubscribedAll">;
  label: string;
  description: string;
}> = [
  {
    key: "reminders",
    label: "Tee-time reminders",
    description: "1 hour before tee-off.",
  },
  {
    key: "addedTo",
    label: "When you're added to a tee time",
    description: "Someone books you into a group.",
  },
  {
    key: "joinedByOther",
    label: "When someone joins your tee time",
    description: "A new player signs up for a group you're already on.",
  },
  {
    key: "leftByOther",
    label: "When someone leaves your tee time",
    description: "A player drops from a group you're on.",
  },
];

export function PreferencesForm({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const disabledByKillSwitch = prefs.unsubscribedAll;

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs((p) => ({ ...p, [key]: value }));
    setStatus("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus("idle");
    setError("");
    const res = await fetch("/api/profile/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't save");
      setStatus("error");
      return;
    }
    setStatus("saved");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ul className="divide-y divide-gray-100">
        {ROWS.map((row) => (
          <li
            key={row.key}
            className={`flex items-start justify-between gap-3 py-3 ${
              disabledByKillSwitch ? "opacity-50" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{row.label}</p>
              <p className="text-xs text-gray-500">{row.description}</p>
            </div>
            <Toggle
              checked={prefs[row.key]}
              disabled={disabledByKillSwitch}
              onChange={(v) => update(row.key, v)}
            />
          </li>
        ))}
      </ul>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Unsubscribe from all emails</p>
            <p className="text-xs text-gray-500">
              Master kill switch. Overrides the toggles above.
            </p>
          </div>
          <Toggle
            checked={prefs.unsubscribedAll}
            onChange={(v) => update("unsubscribedAll", v)}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {status === "saved" && (
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          Saved.
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? "bg-emerald-700" : "bg-gray-300"
      } ${disabled ? "cursor-not-allowed" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
