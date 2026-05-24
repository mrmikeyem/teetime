export type Coords = { lat: number; lon: number };

export type WeatherSummary = {
  tempF: number;
  feelsLikeF: number;
  windMph: number;
  precipChance: number;
  condition: string;
  icon: string;
};

export const GRAND_FORKS: Coords = { lat: 47.9253, lon: -97.0329 };

const KNOWN_COURSES: Record<string, Coords> = {
  "kings walk": { lat: 47.9425, lon: -97.0879 },
  "valley golf course": { lat: 47.9159, lon: -97.0639 },
  "lincoln park": { lat: 47.9034, lon: -97.0488 },
  larimore: { lat: 47.9067, lon: -97.6268 },
  fertile: { lat: 47.5366, lon: -96.2789 },
};

async function geocodeOpenMeteo(query: string): Promise<Coords | null> {
  if (!query.trim()) return null;

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query.trim());
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    results?: { latitude: number; longitude: number }[];
  };
  const first = data.results?.[0];
  if (!first) return null;

  return { lat: first.latitude, lon: first.longitude };
}

export async function geocodeCourse(query: string): Promise<Coords | null> {
  const q = query.trim();
  if (!q) return null;

  const lower = q.toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_COURSES)) {
    if (lower.includes(key)) return coords;
  }

  const direct = await geocodeOpenMeteo(q);
  if (direct) return direct;

  const segments = q.split(",").map((s) => s.trim()).filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const fallback = await geocodeOpenMeteo(segments[i]);
    if (fallback) return fallback;
  }

  const lastWord = q.split(/\s+/).pop();
  if (lastWord && lastWord !== q) {
    const wordMatch = await geocodeOpenMeteo(lastWord);
    if (wordMatch) return wordMatch;
  }

  return null;
}

export async function getWeatherForTeeTime(
  coords: Coords,
  when: Date
): Promise<WeatherSummary | null> {
  const now = Date.now();
  const target = when.getTime();
  const days = (target - now) / (1000 * 60 * 60 * 24);
  if (days < -0.25 || days > 16) return null;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", coords.lat.toString());
  url.searchParams.set("longitude", coords.lon.toString());
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "apparent_temperature",
      "precipitation_probability",
      "wind_speed_10m",
      "weather_code",
    ].join(",")
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("forecast_days", "16");

  const res = await fetch(url, { next: { revalidate: 60 * 30 } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    hourly?: {
      time: string[];
      temperature_2m: number[];
      apparent_temperature: number[];
      precipitation_probability: number[];
      wind_speed_10m: number[];
      weather_code: number[];
    };
  };
  const hourly = data.hourly;
  if (!hourly) return null;

  const targetHourUtc = new Date(when);
  targetHourUtc.setUTCMinutes(0, 0, 0);
  const targetIso = targetHourUtc.toISOString().slice(0, 13);

  let idx = hourly.time.findIndex((t) => t.slice(0, 13) === targetIso);
  if (idx === -1) {
    let bestDelta = Infinity;
    hourly.time.forEach((t, i) => {
      const delta = Math.abs(new Date(`${t}Z`).getTime() - when.getTime());
      if (delta < bestDelta) {
        bestDelta = delta;
        idx = i;
      }
    });
  }
  if (idx < 0) return null;

  const code = hourly.weather_code[idx];
  const { condition, icon } = describeCode(code);

  return {
    tempF: Math.round(hourly.temperature_2m[idx]),
    feelsLikeF: Math.round(hourly.apparent_temperature[idx]),
    windMph: Math.round(hourly.wind_speed_10m[idx]),
    precipChance: hourly.precipitation_probability?.[idx] ?? 0,
    condition,
    icon,
  };
}

export type DailyWeather = {
  date: string;
  tempF: number;
  icon: string;
  condition: string;
};

export async function getDailyWeatherGrid(
  coords: Coords
): Promise<Map<string, DailyWeather>> {
  const result = new Map<string, DailyWeather>();
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", coords.lat.toString());
  url.searchParams.set("longitude", coords.lon.toString());
  url.searchParams.set(
    "hourly",
    ["temperature_2m", "weather_code"].join(",")
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "16");

  const res = await fetch(url, { next: { revalidate: 60 * 30 } });
  if (!res.ok) return result;

  const data = (await res.json()) as {
    hourly?: {
      time: string[];
      temperature_2m: number[];
      weather_code: number[];
    };
  };
  if (!data.hourly) return result;

  for (let i = 0; i < data.hourly.time.length; i++) {
    const t = data.hourly.time[i];
    const date = t.slice(0, 10);
    const hour = parseInt(t.slice(11, 13), 10);
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const targetHour = isWeekend ? 10 : 17;
    if (hour !== targetHour) continue;

    const code = data.hourly.weather_code[i];
    const { condition, icon } = describeCode(code);
    result.set(date, {
      date,
      tempF: Math.round(data.hourly.temperature_2m[i]),
      icon,
      condition,
    });
  }

  return result;
}

function describeCode(code: number): { condition: string; icon: string } {
  if (code === 0) return { condition: "Clear", icon: "☀️" };
  if (code === 1) return { condition: "Mostly clear", icon: "🌤️" };
  if (code === 2) return { condition: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { condition: "Overcast", icon: "☁️" };
  if (code === 45 || code === 48) return { condition: "Fog", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { condition: "Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { condition: "Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { condition: "Snow", icon: "🌨️" };
  if (code >= 80 && code <= 82) return { condition: "Showers", icon: "🌦️" };
  if (code >= 85 && code <= 86) return { condition: "Snow showers", icon: "🌨️" };
  if (code === 95) return { condition: "Thunderstorm", icon: "⛈️" };
  if (code === 96 || code === 99)
    return { condition: "Thunderstorm w/ hail", icon: "⛈️" };
  return { condition: "Unknown", icon: "❓" };
}
