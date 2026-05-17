import "server-only";

export type IcsEvent = {
  id: string;
  course: string;
  teeOffAt: Date;
  updatedAt: Date;
  notes: string | null;
  durationMinutes?: number;
};

const DEFAULT_DURATION_MIN = 4 * 60; // 4 hours
const PRODID = "-//Tee Time Tracker//infiniterien.com//EN";
const UID_DOMAIN = "infiniterien.com";

/**
 * Build an iCalendar (.ics) document for a user's tee times.
 * CRLF line endings per RFC 5545. UIDs are stable per tee-time so calendar
 * apps treat updates as edits, not new events. SEQUENCE bumps on each
 * updatedAt change so clients pick up the latest version.
 */
export function buildIcs(opts: {
  calendarName: string;
  events: IcsEvent[];
}): string {
  const { calendarName, events } = opts;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-WR-TIMEZONE:America/Chicago",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
    "X-PUBLISHED-TTL:PT30M",
  ];

  const dtstamp = formatUtc(new Date());

  for (const e of events) {
    const start = e.teeOffAt;
    const end = new Date(
      start.getTime() + (e.durationMinutes ?? DEFAULT_DURATION_MIN) * 60_000
    );
    const sequence = Math.floor(e.updatedAt.getTime() / 1000);
    const summary = `Tee time — ${e.course}`;
    const description = e.notes ? e.notes : "";

    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@${UID_DOMAIN}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${formatUtc(start)}`,
      `DTEND:${formatUtc(end)}`,
      `SEQUENCE:${sequence}`,
      `SUMMARY:${escapeText(summary)}`,
      `LOCATION:${escapeText(e.course)}`,
      `DESCRIPTION:${escapeText(description)}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/**
 * Format a JS Date as an iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ.
 */
function formatUtc(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/**
 * Escape iCalendar TEXT field per RFC 5545 section 3.3.11.
 * Backslash, comma, and semicolon must be backslash-escaped.
 * Newlines become the literal two characters '\\n'.
 */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
