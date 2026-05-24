import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Coords } from "./weather";

export type HourlyPoint = {
  hour: number;
  tempF: number;
  feelsLikeF: number;
  precipChance: number;
  windMph: number;
  conditionCode: number;
};

export type RoundForecast = {
  teeOff: HourlyPoint;
  hours: HourlyPoint[];
};

const SYSTEM_PROMPT = `You write one-sentence weather briefings for a casual men's golf group in North Dakota.

Input: hourly forecast covering the 4 hours of a round (tee-off + next 3 hours), with temperature, feels-like, wind, and precipitation chance.

Output: ONE sentence (max ~25 words) telling the golfer what to expect over the round. Mention the practical thing — what to wear, whether wind/rain will be a factor, whether it'll warm up or cool off. Be specific, not generic. No greetings, no "have fun", no emojis. Plain text only.

Examples of the tone:
- "Mid-60s and breezy at tee-off, climbing to 72 by the back nine — light layer to start, you'll shed it."
- "Holding around 78 with a steady 15mph breeze the whole round — sunglasses, no jacket needed."
- "40% chance of showers picking up after hour two — pack a rain jacket."`;

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
      "wind_speed_10m",
      "weather_code",
    ].join(",")
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "auto");
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

  const target = new Date(teeOffAt);
  target.setMinutes(0, 0, 0);
  const targetIso = target.toISOString().slice(0, 13);

  let startIdx = hourly.time.findIndex((t) => t.slice(0, 13) === targetIso);
  if (startIdx === -1) {
    let bestDelta = Infinity;
    hourly.time.forEach((t, i) => {
      const delta = Math.abs(new Date(t).getTime() - teeOffAt.getTime());
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
      tempF: Math.round(hourly.temperature_2m[i]),
      feelsLikeF: Math.round(hourly.apparent_temperature[i]),
      precipChance: hourly.precipitation_probability?.[i] ?? 0,
      windMph: Math.round(hourly.wind_speed_10m[i]),
      conditionCode: hourly.weather_code[i],
    });
  }
  if (points.length === 0) return null;

  return { teeOff: points[0], hours: points };
}

export async function summarizeRound(
  forecast: RoundForecast
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const userText = forecast.hours
    .map(
      (h) =>
        `Hour ${h.hour}: ${h.tempF}°F (feels ${h.feelsLikeF}°F), wind ${h.windMph} mph, ${h.precipChance}% precip`
    )
    .join("\n");

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
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
    return out && out.length > 0 ? out : null;
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
