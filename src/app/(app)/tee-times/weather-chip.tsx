import type { WeatherSummary } from "@/lib/weather";

export function WeatherChip({ weather }: { weather: WeatherSummary }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800"
      title={`${weather.condition} · feels like ${weather.feelsLikeF}°F · ${weather.precipChance}% precip`}
    >
      <span aria-hidden>{weather.icon}</span>
      <span>{weather.tempF}°F</span>
      <span className="text-sky-600">·</span>
      <span className="font-normal text-sky-700">{weather.condition}</span>
      <span className="text-sky-600">·</span>
      <span className="font-normal text-sky-700">{weather.windMph} mph</span>
      {weather.precipChance >= 30 && (
        <>
          <span className="text-sky-600">·</span>
          <span className="font-normal text-sky-700">
            {weather.precipChance}% rain
          </span>
        </>
      )}
    </span>
  );
}
