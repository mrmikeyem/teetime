import type { WeatherSummary } from "@/lib/weather";

export function WeatherChip({ weather }: { weather: WeatherSummary }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 dark:bg-sky-900/30 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:text-sky-300"
      title={`${weather.condition} · feels like ${weather.feelsLikeF}°F · ${weather.precipChance}% precip`}
    >
      <span aria-hidden>{weather.icon}</span>
      <span>{weather.tempF}°F</span>
      <span className="text-sky-600 dark:text-sky-400">·</span>
      <span className="font-normal text-sky-700 dark:text-sky-300">{weather.condition}</span>
      <span className="text-sky-600 dark:text-sky-400">·</span>
      <span className="font-normal text-sky-700 dark:text-sky-300">{weather.windMph} mph</span>
      {weather.precipChance >= 30 && (
        <>
          <span className="text-sky-600 dark:text-sky-400">·</span>
          <span className="font-normal text-sky-700 dark:text-sky-300">
            {weather.precipChance}% rain
          </span>
        </>
      )}
    </span>
  );
}
