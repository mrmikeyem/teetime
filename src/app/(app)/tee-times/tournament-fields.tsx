"use client";

export type TournamentFieldsState = {
  externalUrl: string;
  signupDeadline: string; // datetime-local string
  rangeOpensTime: string; // HH:MM
  isShotgun: boolean;
  format: string; // empty string = none
  entryFee: string; // string for input, validated server-side
};

export const EMPTY_TOURNAMENT_FIELDS: TournamentFieldsState = {
  externalUrl: "",
  signupDeadline: "",
  rangeOpensTime: "",
  isShotgun: false,
  format: "",
  entryFee: "",
};

const FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "STROKE", label: "Stroke play" },
  { value: "SCRAMBLE", label: "Scramble" },
  { value: "BEST_BALL", label: "Best ball" },
  { value: "MATCH_PLAY", label: "Match play" },
  { value: "OTHER", label: "Other" },
];

export function TournamentFieldsBlock({
  value,
  onChange,
}: {
  value: TournamentFieldsState;
  onChange: (next: TournamentFieldsState) => void;
}) {
  function set<K extends keyof TournamentFieldsState>(
    key: K,
    val: TournamentFieldsState[K]
  ) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
        Tournament details
      </p>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label className="block text-sm font-medium" htmlFor="rangeOpensTime">
            Range opens
          </label>
          <input
            id="rangeOpensTime"
            type="time"
            value={value.rangeOpensTime}
            onChange={(e) => set("rangeOpensTime", e.target.value)}
            className="mt-1 block w-full min-w-0 appearance-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm focus:border-emerald-700 focus:outline-none focus:ring-emerald-700"
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center">
          <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.isShotgun}
              onChange={(e) => set("isShotgun", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-700"
            />
            <span>Shotgun start</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <label className="block text-sm font-medium" htmlFor="format">
            Format
          </label>
          <select
            id="format"
            value={value.format}
            onChange={(e) => set("format", e.target.value)}
            className="mt-1 block w-full appearance-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm focus:border-emerald-700 focus:outline-none focus:ring-emerald-700"
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label className="block text-sm font-medium" htmlFor="entryFee">
            Entry fee
          </label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-500 dark:text-gray-400">
              $
            </span>
            <input
              id="entryFee"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={value.entryFee}
              onChange={(e) => set("entryFee", e.target.value)}
              className="block w-full min-w-0 appearance-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 pl-6 pr-3 py-2.5 text-sm focus:border-emerald-700 focus:outline-none focus:ring-emerald-700"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="signupDeadline">
          Sign-up deadline (optional)
        </label>
        <input
          id="signupDeadline"
          type="datetime-local"
          value={value.signupDeadline}
          onChange={(e) => set("signupDeadline", e.target.value)}
          className="mt-1 block w-full appearance-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm focus:border-emerald-700 focus:outline-none focus:ring-emerald-700"
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="externalUrl">
          More info URL
        </label>
        <input
          id="externalUrl"
          type="url"
          placeholder="https://18birdies.com/…"
          value={value.externalUrl}
          onChange={(e) => set("externalUrl", e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-emerald-700 focus:outline-none focus:ring-emerald-700"
        />
      </div>
    </div>
  );
}
