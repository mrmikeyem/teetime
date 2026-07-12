import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Coords } from "./weather";
import { buildHoleWindBlock, findCourseHoles } from "./course-holes";

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
  expectedRoundHours: number;
  expectedHoles: number;
};

const MAX_ROUND_HOURS = 4;

function estimateRoundHours(
  teeOffAt: Date,
  sunsetUtcIso: string | null
): number {
  if (!sunsetUtcIso) return MAX_ROUND_HOURS;
  const sunsetMs = new Date(`${sunsetUtcIso}Z`).getTime();
  const hoursUntilSunset =
    (sunsetMs - teeOffAt.getTime()) / (60 * 60 * 1000);
  if (hoursUntilSunset <= 0) return 1;
  return Math.max(1, Math.min(MAX_ROUND_HOURS, Math.ceil(hoursUntilSunset)));
}

function estimateHoles(roundHours: number): number {
  // ~13 min/hole baseline (4h = 18 holes for a casual group with carts).
  return Math.max(3, Math.round(roundHours * 4.5));
}

const SYSTEM_PROMPT = `You write a "what to expect" paragraph for a casual men's golf group in North Dakota about their upcoming round.

Input: hourly forecast covering the expected playable window (tee-off through sunset, capped at 4 hours), an estimate of how many holes will realistically be played, sunset time, past-24h rainfall, and severe-weather alerts. When the course's layout is known and the wind matters, a "Hole directions" section lists which holes play into/downwind/across the tee-off wind.

Output: ONE short paragraph (3-5 sentences, ~80 words max) covering the practical things — weather across the round, what to wear or bring, ground conditions, wind impact on play, daylight runway, and any heads-up like bugs or severe weather. Connect the factors when it's natural: "dry + light wind = ball will roll" beats stating them separately.

Rules:
- Be specific. Use numbers and times. "Upper 70s easing to 74 by 8pm" beats "warm."
- If a "Hole directions" section is present, the routing IS known — call out the 2-4 holes where wind matters most (long holes into the wind, exposed par 3s, doglegs that flip relation mid-hole) and the practical effect. Never recite every hole or every group.
- If NO "Hole directions" section is present, don't invent course-specific knowledge. You don't know the layout. Talk about general effects of wind direction and ground conditions, not specific holes.
- Don't recommend a layer or jacket when temperatures stay above 70°F, unless wind/humidity make it feel meaningfully colder.
- Only mention dusk or daylight if the round's last hour falls within 30 minutes of sunset. Otherwise skip it.
- Match the advice to the expected round length and hole count. For a 9-hole evening round don't warn about conditions 4 hours out — only about what happens during the actual playable window.
- Always produce a paragraph, even when conditions are mild and uneventful. A bland round still benefits from a one-line "comfortable mid-70s the whole way" confirmation.
- Skip filler phrases like "dress comfortably" or "enjoy your round." Be useful, not generic.
- No greetings, no sign-offs, no emojis. Plain prose, casual tone.

Examples of the voice:

Example A (windy summer round):
Upper 70s and breezy at tee-off, easing to low 70s by 8pm with gusts up to 22mph the first two hours. The steady SW wind will drift tee shots right early — less of a factor as it quiets after hour two. Bring a hat that stays on. Sunset's 9:12pm, so the last group finishes near dusk; a glow ball doesn't hurt if pace gets soft.

Example B (post-rain cool round):
Cool and damp at 58° to start, climbing to a comfortable 65° by hour three under partly cloudy skies. Light layer over a polo to start, you'll shed it by the back nine. Yesterday's half-inch of rain means soft fairways — the ball won't roll out, so club up on approaches. Calm wind throughout.

Example C (mild summer round, nothing remarkable):
Steady mid-to-upper 70s the whole round with a light 6-8mph breeze — comfortable polo-and-shorts weather. Dry ground means the ball will roll out a bit on tee shots. No rain in the picture and plenty of daylight to wrap up.

Example D (windy round with hole directions known):
Mid 70s with a stiff 17mph northwest wind gusting 25 — this one's about the wind. The long par 5s at 9 and 18 play straight into it, so expect two extra clubs there, and the par 3 16th is dead upwind too. You'll get it back on 1 and 2 riding the tailwind. Hats and ball flight low; scores won't be pretty on the back stretch home.`;

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
  teeOffAt: Date,
  opts?: { fresh?: boolean }
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

  const res = await fetch(
    url,
    opts?.fresh ? { cache: "no-store" } : { next: { revalidate: 60 * 30 } }
  );
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

  // Sunset on tee-off day (UTC). Needed before the forecast loop so we
  // can clamp how many hourly points we pull to the realistic playable
  // window (avoids the "warning about 9:30pm cold during a 6:30pm round"
  // case when sunset cuts the round short).
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

  const expectedRoundHours = estimateRoundHours(teeOffAt, sunsetUtcIso);
  const expectedHoles = estimateHoles(expectedRoundHours);

  const points: HourlyPoint[] = [];
  for (let offset = 0; offset < expectedRoundHours; offset++) {
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

  return {
    teeOff: points[0],
    hours: points,
    sunsetUtcIso,
    past24hPrecipIn,
    expectedRoundHours,
    expectedHoles,
  };
}

function formatUserMessage(
  forecast: RoundForecast,
  holeWindBlock: string | null
): string {
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
  lines.push(
    `Expected round: ~${forecast.expectedRoundHours}h (~${forecast.expectedHoles} holes — capped at sunset)`
  );
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

  if (holeWindBlock) {
    lines.push("");
    lines.push(holeWindBlock);
  }

  return lines.join("\n");
}

export async function summarizeRound(
  forecast: RoundForecast,
  courseName?: string | null
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const course = courseName ? findCourseHoles(courseName) : null;
  const holeWindBlock = course
    ? buildHoleWindBlock({
        course,
        windFromDeg: forecast.teeOff.windDirDeg,
        windMph: forecast.teeOff.windMph,
        gustsMph: forecast.teeOff.gustsMph,
        hours: forecast.hours,
        expectedHoles: forecast.expectedHoles,
      })
    : null;
  const userText = formatUserMessage(forecast, holeWindBlock);

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
  teeOffAt: Date,
  opts?: { courseName?: string | null; fresh?: boolean }
): Promise<{ forecast: RoundForecast; summary: string | null } | null> {
  const forecast = await getRoundForecast(coords, teeOffAt, {
    fresh: opts?.fresh,
  });
  if (!forecast) return null;
  const summary = await summarizeRound(forecast, opts?.courseName);
  return { forecast, summary };
}
