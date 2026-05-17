"use client";

import { useTheme, type ThemeMode } from "@/app/components/theme-provider";

const OPTIONS: Array<{ value: ThemeMode; label: string; description: string }> = [
  { value: "light", label: "Light", description: "Always light" },
  { value: "dark", label: "Dark", description: "Always dark" },
  { value: "system", label: "System", description: "Match my device" },
];

export function AppearancePicker() {
  const { mode, setMode } = useTheme();

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Appearance">
      {OPTIONS.map((opt) => {
        const selected = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setMode(opt.value)}
            className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
              selected
                ? "border-emerald-700 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/30"
                : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
            }`}
          >
            <div>
              <div className="font-semibold">{opt.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {opt.description}
              </div>
            </div>
            <span
              aria-hidden
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                selected
                  ? "border-emerald-700 dark:border-emerald-400"
                  : "border-gray-300 dark:border-gray-600"
              }`}
            >
              {selected && (
                <span className="h-2 w-2 rounded-full bg-emerald-700 dark:bg-emerald-400" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
