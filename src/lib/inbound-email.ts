import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { APP_TZ } from "@/lib/time";

/**
 * Inbound email support: members forward a ForeUp booking confirmation to
 * tee@tee3golf.com; Resend receives it and POSTs an `email.received` webhook
 * to /api/inbound/email, which uses these helpers to verify the request,
 * fetch the full message, and extract the booking details with Claude.
 */

// ---------------------------------------------------------------------------
// Webhook signature verification (svix scheme, implemented with node:crypto
// so we don't take on a dependency for one HMAC).
// Signed content is `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 keyed with
// the base64-decoded portion of the `whsec_...` secret, base64 output.
// ---------------------------------------------------------------------------

const SIGNATURE_TOLERANCE_SEC = 5 * 60;

export function verifyResendWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null }
): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) {
    return false;
  }

  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > SIGNATURE_TOLERANCE_SEC) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);

  // Header may contain multiple space-separated signatures (key rotation).
  return headers.signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const sigBuf = Buffer.from(sig);
    return (
      sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)
    );
  });
}

// ---------------------------------------------------------------------------
// Fetch the full received email (the webhook payload has metadata only).
// Requires a Resend API key with receiving access — the SMTP key is send-only.
// ---------------------------------------------------------------------------

export type ReceivedEmail = {
  from: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  // Mailboxes the message transited before reaching tee@ — i.e. the member who
  // auto-forwarded it. Populated from the Gmail forwarding headers (see
  // forwardingMailboxes). Empty for a message sent straight to tee@.
  forwardedFor: string[];
};

const OUR_INBOUND_ADDRESS = "tee@tee3golf.com";

/**
 * Extract the address(es) of the mailbox that auto-forwarded a message to us.
 *
 * Gmail filter-forwarding preserves the original `From:` (e.g. ForeUp), so the
 * forwarding member only shows up in the routing headers. `Delivered-To` is the
 * cleanest signal (a single bare address); `X-Forwarded-For`'s first token is
 * the forwarder as a fallback. We drop our own address and dedupe. The caller
 * decides whether any of these maps to a member.
 */
export function forwardingMailboxes(headers: Record<string, unknown>): string[] {
  const candidates = [
    String(headers["delivered-to"] ?? ""),
    String(headers["x-forwarded-for"] ?? "").split(/\s+/)[0] ?? "",
  ];
  return [
    ...new Set(
      candidates
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[^@\s]+@[^@\s]+$/.test(s) && s !== OUR_INBOUND_ADDRESS)
    ),
  ];
}

// ---------------------------------------------------------------------------
// Gmail forwarding-confirmation relay.
//
// When a member sets up Gmail auto-forwarding to tee@, Google sends a
// confirmation email *to tee@* (not to the member) carrying the link they must
// click to enable forwarding. We detect that email, pull out who requested it
// and the confirm link, and relay the link to the member so onboarding is
// self-service instead of an admin fishing it out of the Resend dashboard.
// ---------------------------------------------------------------------------

const GMAIL_FORWARDING_SENDER = "forwarding-noreply@google.com";

export type ForwardingConfirmation = {
  /** Gmail address that requested forwarding (parsed from the body). */
  requestedBy: string;
  /** The Google link that enables forwarding when clicked. */
  confirmUrl: string;
};

/**
 * If `email` is a Gmail forwarding-confirmation message, extract the requester
 * and the confirm link; otherwise null. Matches on the Google sender plus the
 * confirm-link shape (`/mail/vf-...`) so we never mistake the separate cancel
 * link (`/mail/uf-...`) for it.
 */
export function parseForwardingConfirmation(
  email: Pick<ReceivedEmail, "from" | "subject" | "text" | "html">
): ForwardingConfirmation | null {
  const from = email.from.toLowerCase();
  if (!from.includes(GMAIL_FORWARDING_SENDER)) return null;

  const body = email.text?.trim() || stripHtml(email.html ?? "");
  if (!body) return null;

  // "<address> has requested to automatically forward mail to your email address"
  const requester = body.match(
    /([^\s<>]+@[^\s<>]+)\s+has requested to automatically forward/i
  );
  // The confirm link is the verify-forwarding path; the cancel link is /uf-.
  const confirm = body.match(
    /https:\/\/mail-settings\.google\.com\/mail\/vf-[^\s<>"]+/i
  );
  if (!requester || !confirm) return null;

  return {
    requestedBy: requester[1].trim().toLowerCase(),
    confirmUrl: confirm[0],
  };
}

export async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const res = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!res.ok) {
    throw new Error(`Resend receiving fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    from: data.from ?? "",
    subject: data.subject ?? null,
    text: data.text ?? null,
    html: data.html ?? null,
    forwardedFor: forwardingMailboxes(data.headers ?? {}),
  };
}

// ---------------------------------------------------------------------------
// Extraction: Claude reads the forwarded confirmation and returns structured
// booking details. Uses the same Haiku model/key as the weather blurbs, with
// a JSON schema response format so the output is guaranteed parseable; the
// zod pass after it is belt-and-suspenders plus range checks.
// ---------------------------------------------------------------------------

const extractionZod = z.object({
  is_confirmation: z.boolean(),
  course: z.string().nullable(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  time: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .nullable(),
  players: z.number().int().nullable(),
  holes: z.number().int().nullable(),
  confirmation_number: z.string().nullable(),
});

export type TeeTimeExtraction = z.infer<typeof extractionZod>;

const nullable = (inner: Record<string, unknown>) => ({
  anyOf: [inner, { type: "null" }],
});

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    is_confirmation: {
      type: "boolean",
      description:
        "true only if this email is (or contains a forwarded) golf tee time / booking confirmation",
    },
    course: nullable({
      type: "string",
      description: "Golf course name, e.g. \"Kings Walk Golf Course\"",
    }),
    date: nullable({
      type: "string",
      description: "Tee time date in the course's local time, YYYY-MM-DD",
    }),
    time: nullable({
      type: "string",
      description: "Tee-off time in the course's local time, 24-hour HH:MM",
    }),
    players: nullable({
      type: "integer",
      description: "Number of players / golfers on the booking",
    }),
    holes: nullable({ type: "integer", description: "9 or 18 if stated" }),
    confirmation_number: nullable({
      type: "string",
      description: "Booking / confirmation / reservation number if present",
    }),
  },
  required: [
    "is_confirmation",
    "course",
    "date",
    "time",
    "players",
    "holes",
    "confirmation_number",
  ],
  additionalProperties: false,
} as const;

const EXTRACTION_SYSTEM = `You extract golf tee time booking details from emails forwarded by members of a small golf group. The emails are usually ForeUp booking confirmations from Kings Walk Golf Course (Grand Forks, ND), but may come from any course or booking system.

The email is a forward, so ignore forwarding headers/quoting artifacts and read the original confirmation inside it.

Rules:
- Set is_confirmation to true ONLY if the email clearly confirms a booked tee time or golf reservation (not a marketing email, receipt for something else, or general correspondence).
- course is the specific course being played, not the facility/organization name. ForeUp facility names can cover several courses (e.g. "King's Walk or Lincoln Golf Course"); when the email also names the specific course (e.g. "At Kings Walk"), return that one.
- date and time are the tee-off date/time as written in the email, in the course's local timezone. Do not convert timezones.
- If the year is missing, infer it from the current date given in the message: the tee time is in the future, almost always within the next 60 days.
- Leave any field you cannot find as null. Never guess values that are not in the email.`;

/** Crude HTML→text for when the received email has no text part. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

const MAX_BODY_CHARS = 20_000;

export async function extractTeeTime(email: {
  subject: string | null;
  text: string | null;
  html: string | null;
}): Promise<TeeTimeExtraction | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const body =
    email.text?.trim() || (email.html ? stripHtml(email.html) : "");
  if (!body) return null;

  const todayCt = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const userText =
    `Current date (US Central): ${todayCt}\n\n` +
    `Subject: ${email.subject ?? "(none)"}\n\n` +
    `Email body:\n${body.slice(0, MAX_BODY_CHARS)}`;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      system: EXTRACTION_SYSTEM,
      output_config: {
        format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
      },
      messages: [{ role: "user", content: userText }],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!textBlock?.text) return null;

    const parsed = extractionZod.safeParse(JSON.parse(textBlock.text));
    if (!parsed.success) {
      console.error("[inbound-email] extraction failed zod:", parsed.error.message);
      return null;
    }
    return parsed.data;
  } catch (err) {
    console.error("[inbound-email] extraction error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Timezone: the extraction gives CT wall-clock date/time; tee times are stored
// as UTC instants. Same offset technique as startOfTodayInAppTz in lib/time.ts.
// ---------------------------------------------------------------------------

function ctOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second")
  );
  return asIfUtc - at.getTime(); // negative for CT (UTC-5 / UTC-6)
}

export function ctWallTimeToUtc(dateStr: string, timeStr: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const t = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  if (!d || !t) return null;

  const wallAsUtc = Date.UTC(
    Number(d[1]),
    Number(d[2]) - 1,
    Number(d[3]),
    Number(t[1]),
    Number(t[2])
  );
  if (isNaN(wallAsUtc)) return null;

  // Two passes so a DST boundary between the guess and the target settles.
  let utc = wallAsUtc;
  for (let i = 0; i < 2; i++) {
    utc = wallAsUtc - ctOffsetMs(new Date(utc));
  }
  return new Date(utc);
}
