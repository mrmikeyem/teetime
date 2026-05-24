import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Coords } from "./weather";

export type HourlyPoint = {
  hour: number;
  utcIso: string;
  tempF: number;
  feelsLikeF: number;
  precipChance: number;
  windMph: number;
  windDirDeg: number;
  gustsMph: number;
  uvIndex: number;
  conditionCode: number;
};

export type RoundForecast = {
  teeOff: HourlyPoint;
  hours: HourlyPoint[];
  sunsetUtcIso: string | null;
  past24hPrecipIn: number;
};

const SYSTEM_PROMPT = `You write a "what to expect" paragraph for a casual men's golf group in North Dakota about their upcoming 4-hour round.

Input: hourly forecast for tee-off and the next 3 hours, plus sunset time, past-24h rainfall, and severe-weather alerts.

Output: ONE short paragraph (3-5 sentences, ~80 words max) covering the practical things — weather across the round, what to wear or bring, ground conditions, wind impact on play, daylight runway, and any heads-up like bugs or severe weather. Connect the factors when it's natural: "dry + light wind = ball will roll" beats stating them separately.

Rules:
- Be specific. Use numbers and times. "Upper 70s easing to 74 by 8pm" beats "warm."
- Don't invent course-specific knowledge. You don't know the layout. Talk about general effects of wind direction and ground conditions, not specific holes.
- Don't recommend a layer or jacket when temperatures stay above 70°F, unless wind/humidity make it feel meaningfully colder.
- Only mention dusk or daylight if the round's last hour falls within 30 minutes of sunset. Otherwise skip it.
- If conditions are unremarkable across the board (mild, calm, dry, no daylight concerns), return the single word: null
- Skip filler. "Dress comfortably" or "enjoy your round" is not acceptable.
- No greetings, no sign-offs, no emojis. Plain prose, casual tone.

Examples of the voice:

Example A (windy summer round):
Upper 70s and breezy at tee-off, easing to low 70s by 8pm with gusts up to 22mph the first two hours. The steady SW wind will drift tee shots right early — less of a factor as it quiets after hour two. Bring a hat that stays on. Sunset's 9:12pm, so the last group finishes near dusk; a glow ball doesn't hurt if pace gets soft.

Example B (post-rain cool round):
Cool and damp at 58° to start, climbing to a comfortable 65° by hour three under partly cloudy skies. Light layer over a polo to start, you'll shed it by the back nine. Yesterday's half-inch of rain means soft fairways — the ball won't roll out, so club up on approaches. Calm wind throughout.

Example C (unremarkable):
null`;

function compass(deg: number): string {
  const dirs = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

function formatCtTime(utcIso: string): string {
  const d = new Date(`${utcIso}Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    hour12: true,
  }).format(d);
}

export async function getRoundForecast(
  coords: Coords,
  teeOffAt: Date
): Promise<RoundForecast | null> {
  const now = Date.now();
  const days = (teeOffAt.getTime() - now) / (1000 * 60 * 60 * 24);
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
      "precipitation",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "uv_index",
      "weather_code",
    ].join(",")
  );
  url.searchParams.set("daily", "sunset");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("past_days", "1");
  url.searchParams.set("forecast_days", "16");

  const res = await fetch(url, { next: { revalidate: 60 * 30 } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    hourly?: {
      time: string[];
      temperature_2m: number[];
      apparent_temperature: number[];
      precipitation_probability: number[];
      precipitation: number[];
      wind_speed_10m: number[];
      wind_direction_10m: number[];
      wind_gusts_10m: number[];
      uv_index: number[];
      weather_code: number[];
    };
    daily?: {
      time: string[];
      sunset: string[];
    };
  };
  const hourly = data.hourly;
  if (!hourly) return null;

  const target = new Date(teeOffAt);
  target.setUTCMinutes(0, 0, 0);
  const targetIso = target.toISOString().slice(0, 13);

  let startIdx = hourly.time.findIndex((t) => t.slice(0, 13) === targetIso);
  if (startIdx === -1) {
    let bestDelta = Infinity;
    hourly.time.forEach((t, i) => {
      const delta = Math.abs(new Date(`${t}Z`).getTime() - teeOffAt.getTime());
      if (delta < bestDelta) {
        bestDelta = delta;
        startIdx = i;
      }
    });
  }
  if (startIdx < 0) return null;

  const points: HourlyPoint[] = [];
  for (let offset = 0; offset < 4; offset++) {
    const i = startIdx + offset;
    if (i >= hourly.time.length) break;
    points.push({
      hour: offset,
      utcIso: hourly.time[i],
      tempF: Math.round(hourly.temperature_2m[i]),
      feelsLikeF: Math.round(hourly.apparent_temperature[i]),
      precipChance: hourly.precipitation_probability?.[i] ?? 0,
      windMph: Math.round(hourly.wind_speed_10m[i]),
      windDirDeg: Math.round(hourly.wind_direction_10m[i]),
      gustsMph: Math.round(hourly.wind_gusts_10m[i]),
      uvIndex: Math.round(hourly.uv_index?.[i] ?? 0),
      conditionCode: hourly.weather_code[i],
    });
  }
  if (points.length === 0) return null;

  // Past 24h rainfall (sum of precip across the 24 hours before tee-off).
  let past24hPrecipIn = 0;
  const teeOffMs = teeOffAt.getTime();
  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(`${hourly.time[i]}Z`).getTime();
    if (t >= teeOffMs - 24 * 60 * 60 * 1000 && t < teeOffMs) {
      past24hPrecipIn += hourly.precipitation?.[i] ?? 0;
    }
  }
  past24hPrecipIn = Math.round(past24hPrecipIn * 100) / 100;

  // Sunset on tee-off day (UTC).
  let sunsetUtcIso: string | null = null;
  const teeOffDayUtc = target.toISOString().slice(0, 10);
  if (data.daily) {
    for (let i = 0; i < data.daily.time.length; i++) {
      if (data.daily.time[i] === teeOffDayUtc) {
        sunsetUtcIso = data.daily.sunset[i] ?? null;
        break;
      }
    }
  }

  return { teeOff: points[0], hours: points, sunsetUtcIso, past24hPrecipIn };
}

function formatUserMessage(forecast: RoundForecast): string {
  const teeOffCt = formatCtTime(forecast.teeOff.utcIso);
  const sunsetCt = forecast.sunsetUtcIso
    ? new Date(forecast.sunsetUtcIso).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  const lines: string[] = [];
  lines.push(`Tee-off: ${teeOffCt} CDT`);
  if (sunsetCt) {
    lines.push(`Sunset:  ${sunsetCt} CDT`);
  }
  lines.push("");

  for (const h of forecast.hours) {
    const ct = formatCtTime(h.utcIso);
    const dir = compass(h.windDirDeg);
    lines.push(
      `Hour ${h.hour} (${ct}): ${h.tempF}°F (feels ${h.feelsLikeF}°F), wind ${h.windMph}mph ${dir}, gusts ${h.gustsMph}mph, ${h.precipChance}% precip, UV ${h.uvIndex}`
    );
  }
  lines.push("");

  const precipDesc =
    forecast.past24hPrecipIn === 0
      ? "0.0 in (dry)"
      : `${forecast.past24hPrecipIn.toFixed(2)} in`;
  lines.push(`Past 24h precipitation: ${precipDesc}`);
  lines.push("Severe alerts: none");

  return lines.join("\n");
}

export async function summarizeRound(
  forecast: RoundForecast
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const userText = formatUserMessage(forecast);

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userText }],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const out = textBlock?.text?.trim();
    if (!out) return null;
    // Model returns the literal word "null" when conditions are unremarkable.
    if (out.toLowerCase() === "null") return null;
    return out;
  } catch {
    return null;
  }
}

export async function getRoundSummary(
  coords: Coords,
  teeOffAt: Date
): Promise<{ forecast: RoundForecast; summary: string | null } | null> {
  const forecast = await getRoundForecast(coords, teeOffAt);
  if (!forecast) return null;
  const summary = await summarizeRound(forecast);
  return { forecast, summary };
}
