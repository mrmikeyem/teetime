import "server-only";
import { feedbackTypeLabel } from "@/lib/feedback-types";

const APP_URL = process.env.AUTH_URL ?? "https://tee3golf.com";
const APP_NAME = "Tee Time Tracker";
const TAGLINE = "Track. Plan. Shank. Repeat.";
const LOGO_URL = `${APP_URL}/logo-email.png`;
const BRAND_NAVY = "#1f2c4a";
const BRAND_GREEN = "#15803d";

function shell(bodyHtml: string, opts?: { unsubscribeUrl?: string }) {
  const footerInner = opts?.unsubscribeUrl
    ? `<p style="margin:0 0 6px 0;">${APP_URL.replace(/^https?:\/\//, "")}</p>
                <p style="margin:0;"><a href="${opts.unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe from these emails</a></p>`
    : `<p style="margin:0;">${APP_URL.replace(/^https?:\/\//, "")}</p>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${APP_NAME}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
            <tr>
              <td align="center" style="padding:28px 24px 8px 24px;">
                <img src="${LOGO_URL}" alt="${APP_NAME}" width="120" height="120" style="display:block;border:0;outline:none;text-decoration:none;width:120px;height:auto;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 24px 4px 24px;">
                <h1 style="margin:0;font-size:20px;font-weight:700;color:${BRAND_NAVY};">${APP_NAME}</h1>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 24px 16px 24px;">
                <p style="margin:0;font-size:12px;color:${BRAND_GREEN};letter-spacing:0.04em;">${TAGLINE}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px 28px;font-size:15px;line-height:1.55;color:#111827;">
${bodyHtml}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 24px 24px 24px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
                ${footerInner}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function btn(label: string, url: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;margin:8px 6px 8px 0;">
  <tr>
    <td bgcolor="${BRAND_GREEN}" style="border-radius:8px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`;
}

function btnSecondary(label: string, url: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;margin:8px 0;">
  <tr>
    <td style="border-radius:8px;border:1px solid #d1d5db;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:11px 19px;font-size:15px;font-weight:600;color:#374151;text-decoration:none;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`;
}

const TZ = "America/Chicago";

function formatTeeOff(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
    timeZone: TZ,
  }).format(date);
}

export function passwordResetEmail(opts: { name: string; resetUrl: string }) {
  const { name, resetUrl } = opts;
  const subject = `Reset your ${APP_NAME} password`;

  const text =
    `Hi ${name},\n\n` +
    `Click the link below to reset your password. It expires in 1 hour.\n\n` +
    `${resetUrl}\n\n` +
    `If you didn't request this, you can ignore this email.\n`;

  const html = shell(`
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 12px 0;">Click the button below to reset your password. This link expires in 1 hour.</p>
        ${btn("Reset password", resetUrl)}
        <p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;">Or copy and paste this URL into your browser:</p>
        <p style="margin:0 0 16px 0;font-size:13px;word-break:break-all;"><a href="${resetUrl}" style="color:${BRAND_GREEN};">${resetUrl}</a></p>
        <p style="margin:0;font-size:13px;color:#6b7280;">If you didn't request this, you can ignore this email.</p>
`);

  return { subject, text, html };
}

export function inviteUserEmail(opts: { setupUrl: string }) {
  const { setupUrl } = opts;
  const subject = `Welcome to ${APP_NAME} — set up your account`;

  const text =
    `Hi,\n\n` +
    `You've been invited to ${APP_NAME}. Click the link below to enter your ` +
    `name and choose a password. The link expires in 7 days.\n\n` +
    `${setupUrl}\n\n` +
    `Once you're set up, sign in any time at ${APP_URL}.\n`;

  const html = shell(`
        <p style="margin:0 0 12px 0;">Hi,</p>
        <p style="margin:0 0 12px 0;">You've been invited to ${APP_NAME}. Click the button below to enter your name and choose a password. This link expires in 7 days.</p>
        ${btn("Set up my account", setupUrl)}
        <p style="margin:0 0 12px 0;font-size:13px;color:#6b7280;">Or copy and paste this URL into your browser:</p>
        <p style="margin:0 0 16px 0;font-size:13px;word-break:break-all;"><a href="${setupUrl}" style="color:${BRAND_GREEN};">${setupUrl}</a></p>
        <p style="margin:0;font-size:13px;color:#6b7280;">Once you're set up, you can sign in any time at ${APP_URL.replace(/^https?:\/\//, "")}.</p>
`);

  return { subject, text, html };
}

export function addedToTeeTimeEmail(opts: {
  recipientName: string;
  addedByName: string;
  course: string;
  teeOffAt: Date;
  roster: RosterEntry[];
  confirmUrl: string;
  declineUrl: string;
  detailUrl: string;
  unsubscribeUrl: string;
}) {
  const { recipientName, addedByName, course, teeOffAt, roster, confirmUrl, declineUrl, detailUrl, unsubscribeUrl } = opts;
  const when = formatTeeOff(teeOffAt);
  const subject = `${addedByName} added you to a tee time — ${course}, ${when}`;

  const rosterText = roster
    .map((r) => `  ${r.confirmed ? "✓" : "•"} ${r.name}${r.isGuest ? " (guest)" : ""}`)
    .join("\n");

  const text =
    `Hi ${recipientName},\n\n` +
    `${addedByName} added you to a tee time:\n\n` +
    `Course: ${course}\n` +
    `When: ${when}\n\n` +
    `Group:\n${rosterText}\n\n` +
    `Confirm you're playing: ${confirmUrl}\n` +
    `Decline: ${declineUrl}\n` +
    `Tee time details: ${detailUrl}\n`;

  const rosterHtml = roster
    .map((r) => {
      const mark = r.confirmed
        ? `<span style="color:${BRAND_GREEN};font-weight:600;">✓</span>`
        : `<span style="color:#9ca3af;">•</span>`;
      const guestTag = r.isGuest
        ? `<span style="color:#9ca3af;font-size:12px;margin-left:6px;">guest</span>`
        : "";
      return `<li style="padding:4px 0;">${mark} ${escapeHtml(r.name)}${guestTag}</li>`;
    })
    .join("");

  const html = shell(
    `
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(recipientName)},</p>
        <p style="margin:0 0 16px 0;"><strong>${escapeHtml(addedByName)}</strong> added you to a tee time.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;width:100%;background-color:#f9fafb;border-radius:8px;">
          <tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Course</p>
            <p style="margin:0 0 10px 0;font-size:16px;font-weight:600;">${escapeHtml(course)}</p>
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">When</p>
            <p style="margin:0;font-size:16px;font-weight:600;">${escapeHtml(when)}</p>
          </td></tr>
        </table>
        <p style="margin:0 0 6px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Group</p>
        <ul style="list-style:none;padding:0;margin:0 0 18px 0;">${rosterHtml}</ul>
        <div>${btn("I'm in", confirmUrl)}${btnSecondary("Decline", declineUrl)}</div>
        <p style="margin:14px 0 0 0;font-size:13px;"><a href="${detailUrl}" style="color:${BRAND_GREEN};">View tee time details &rarr;</a></p>
`,
    { unsubscribeUrl }
  );

  return { subject, text, html };
}

export function joinedTeeTimeEmail(opts: {
  recipientName: string;
  joinerName: string;
  course: string;
  teeOffAt: Date;
  detailUrl: string;
  unsubscribeUrl: string;
}) {
  const { recipientName, joinerName, course, teeOffAt, detailUrl, unsubscribeUrl } = opts;
  const when = formatTeeOff(teeOffAt);
  const subject = `${joinerName} joined your tee time — ${course}, ${when}`;

  const text =
    `Hi ${recipientName},\n\n` +
    `${joinerName} joined your tee time at ${course} on ${when}.\n\n` +
    `Tee time details: ${detailUrl}\n`;

  const html = shell(
    `
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(recipientName)},</p>
        <p style="margin:0 0 16px 0;"><strong>${escapeHtml(joinerName)}</strong> joined your tee time.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;width:100%;background-color:#f9fafb;border-radius:8px;">
          <tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Course</p>
            <p style="margin:0 0 10px 0;font-size:16px;font-weight:600;">${escapeHtml(course)}</p>
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">When</p>
            <p style="margin:0;font-size:16px;font-weight:600;">${escapeHtml(when)}</p>
          </td></tr>
        </table>
        <div>${btn("View tee time", detailUrl)}</div>
`,
    { unsubscribeUrl }
  );

  return { subject, text, html };
}

export function leftTeeTimeEmail(opts: {
  recipientName: string;
  leaverName: string;
  course: string;
  teeOffAt: Date;
  detailUrl: string;
  unsubscribeUrl: string;
}) {
  const { recipientName, leaverName, course, teeOffAt, detailUrl, unsubscribeUrl } = opts;
  const when = formatTeeOff(teeOffAt);
  const subject = `${leaverName} left your tee time — ${course}, ${when}`;

  const text =
    `Hi ${recipientName},\n\n` +
    `${leaverName} left your tee time at ${course} on ${when}.\n\n` +
    `Tee time details: ${detailUrl}\n`;

  const html = shell(
    `
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(recipientName)},</p>
        <p style="margin:0 0 16px 0;"><strong>${escapeHtml(leaverName)}</strong> left your tee time. There's an open spot if you'd like to invite someone.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;width:100%;background-color:#f9fafb;border-radius:8px;">
          <tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Course</p>
            <p style="margin:0 0 10px 0;font-size:16px;font-weight:600;">${escapeHtml(course)}</p>
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">When</p>
            <p style="margin:0;font-size:16px;font-weight:600;">${escapeHtml(when)}</p>
          </td></tr>
        </table>
        <div>${btn("View tee time", detailUrl)}</div>
`,
    { unsubscribeUrl }
  );

  return { subject, text, html };
}

export function newTeeTimeAvailableEmail(opts: {
  recipientName: string;
  bookerName: string;
  course: string;
  teeOffAt: Date;
  openSpots: number;
  joinUrl: string;
  detailUrl: string;
  unsubscribeUrl: string;
}) {
  const { recipientName, bookerName, course, teeOffAt, openSpots, joinUrl, detailUrl, unsubscribeUrl } = opts;
  const when = formatTeeOff(teeOffAt);
  const spotsLabel = openSpots === 1 ? "1 open spot" : `${openSpots} open spots`;
  const subject = `New tee time at ${course} — ${when} (${spotsLabel})`;

  const text =
    `Hi ${recipientName},\n\n` +
    `${bookerName} just booked a new tee time at ${course} on ${when}. ` +
    `There ${openSpots === 1 ? "is" : "are"} ${spotsLabel} — want in?\n\n` +
    `Join: ${joinUrl}\n` +
    `Details: ${detailUrl}\n`;

  const html = shell(
    `
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(recipientName)},</p>
        <p style="margin:0 0 16px 0;"><strong>${escapeHtml(bookerName)}</strong> just booked a tee time with room for more.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;width:100%;background-color:#f9fafb;border-radius:8px;">
          <tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Course</p>
            <p style="margin:0 0 10px 0;font-size:16px;font-weight:600;">${escapeHtml(course)}</p>
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">When</p>
            <p style="margin:0 0 10px 0;font-size:16px;font-weight:600;">${escapeHtml(when)}</p>
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Openings</p>
            <p style="margin:0;font-size:16px;font-weight:600;color:${BRAND_GREEN};">${escapeHtml(spotsLabel)}</p>
          </td></tr>
        </table>
        <div>${btn("Join this group", joinUrl)}${btnSecondary("View details", detailUrl)}</div>
        <p style="margin:14px 0 0 0;font-size:13px;color:#6b7280;">You're seeing this because the group has open spots. Other registered users got the same heads-up.</p>
`,
    { unsubscribeUrl }
  );

  return { subject, text, html };
}

export type RosterEntry = {
  name: string;
  confirmed: boolean;
  isGuest: boolean;
};

export function reminderEmail(opts: {
  name: string;
  course: string;
  tournamentName?: string | null;
  teeOffAt: Date;
  roster: RosterEntry[];
  confirmUrl: string;
  leaveUrl: string;
  detailUrl: string;
  unsubscribeUrl: string;
  whatToExpect?: string | null;
  isTournament?: boolean;
  isShotgun?: boolean;
}) {
  const { name, course, tournamentName, teeOffAt, roster, confirmUrl, leaveUrl, detailUrl, unsubscribeUrl, whatToExpect, isTournament, isShotgun } = opts;
  const when = formatTeeOff(teeOffAt);
  const noun = isTournament ? "Tournament" : "Tee time";
  const startLabel = isShotgun ? "Shotgun start" : isTournament ? "Start" : "Tee off";
  // Tournament subject uses name (if set) + venue. Falls back to venue alone.
  const tournamentTitle = tournamentName ? `${tournamentName} at ${course}` : course;
  const subject = isTournament
    ? `${isShotgun ? "Shotgun" : "Tournament"} in 1 hour — ${tournamentTitle}, ${when}`
    : `Tee time in 1 hour — ${course}, ${when}`;

  const rosterText = roster
    .map((r) => `  ${r.confirmed ? "✓" : "•"} ${r.name}${r.isGuest ? " (guest)" : ""}`)
    .join("\n");

  const intro = isTournament
    ? `You're playing in a tournament in about an hour:`
    : `You're scheduled to tee off in about an hour:`;

  const text =
    `Hi ${name},\n\n` +
    `${intro}\n\n` +
    (isTournament && tournamentName ? `Tournament: ${tournamentName}\n` : "") +
    `${isTournament ? "Venue" : "Course"}: ${course}\n` +
    `${startLabel}: ${when}\n\n` +
    (whatToExpect ? `What to expect: ${whatToExpect}\n\n` : "") +
    `Group:\n${rosterText}\n\n` +
    `Confirm you're playing: ${confirmUrl}\n` +
    `Can't make it (leave): ${leaveUrl}\n` +
    `${noun} details: ${detailUrl}\n`;

  const rosterHtml = roster
    .map((r) => {
      const mark = r.confirmed
        ? `<span style="color:${BRAND_GREEN};font-weight:600;">✓</span>`
        : `<span style="color:#9ca3af;">•</span>`;
      const guestTag = r.isGuest
        ? `<span style="color:#9ca3af;font-size:12px;margin-left:6px;">guest</span>`
        : "";
      return `<li style="padding:4px 0;">${mark} ${escapeHtml(r.name)}${guestTag}</li>`;
    })
    .join("");

  const whatToExpectHtml = whatToExpect
    ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;width:100%;background-color:#eff6ff;border-radius:8px;">
          <tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#1e3a8a;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">What to expect</p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#1e3a8a;">${escapeHtml(whatToExpect)}</p>
          </td></tr>
        </table>`
    : "";

  const venueLabel = isTournament ? "Venue" : "Course";
  const introHtml = isTournament
    ? `You're playing in a tournament in about an hour.${isShotgun ? " Shotgun start." : ""}`
    : "You're scheduled to tee off in about an hour.";
  const detailLinkText = isTournament ? "View tournament details" : "View tee time details";
  const tournamentNameRow =
    isTournament && tournamentName
      ? `
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Tournament</p>
            <p style="margin:0 0 10px 0;font-size:16px;font-weight:600;">${escapeHtml(tournamentName)}</p>`
      : "";

  const html = shell(
    `
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 16px 0;">${introHtml}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;width:100%;background-color:#f9fafb;border-radius:8px;">
          <tr><td style="padding:14px 16px;">${tournamentNameRow}
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">${venueLabel}</p>
            <p style="margin:0 0 10px 0;font-size:16px;font-weight:600;">${escapeHtml(course)}</p>
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">${startLabel}</p>
            <p style="margin:0;font-size:16px;font-weight:600;">${escapeHtml(when)}</p>
          </td></tr>
        </table>${whatToExpectHtml}
        <p style="margin:0 0 6px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Group</p>
        <ul style="list-style:none;padding:0;margin:0 0 18px 0;">${rosterHtml}</ul>
        <div>${btn("I'm playing", confirmUrl)}${btnSecondary("Can't make it", leaveUrl)}</div>
        <p style="margin:14px 0 0 0;font-size:13px;"><a href="${detailUrl}" style="color:${BRAND_GREEN};">${detailLinkText} &rarr;</a></p>
`,
    { unsubscribeUrl }
  );

  return { subject, text, html };
}

export function releaseUpdateEmail(opts: {
  name: string;
  appUrl: string;
  unsubscribeUrl: string;
}) {
  const { name, appUrl, unsubscribeUrl } = opts;
  const subject = `What's new in ${APP_NAME} — tournaments, weather, push, and more`;

  const features: { emoji: string; title: string; body: string }[] = [
    {
      emoji: "🏆",
      title: "Tournaments",
      body:
        "Alongside regular tee times, you can now post tournaments with a name, venue, format, team size, entry fee, signup deadline, and an info link. Look for the 🏆 toggle when you tap \"+ New tee time\".",
    },
    {
      emoji: "🌦️",
      title: "AI-written round briefing",
      body:
        "Every tee time now gets a one-paragraph \"What to expect\" rundown of conditions for your full 4-hour round, written by Claude. It looks at temperature trajectory, wind direction, recent rainfall, daylight, and UV, then tells you what to wear and what'll affect your play. Shows on the detail page and in the 1-hour reminder email.",
    },
    {
      emoji: "📱",
      title: "Push notifications",
      body:
        "Opt in from /profile to get phone-screen notifications alongside the reminder emails. iPhone users: install the app to your home screen first (Share → Add to Home Screen in Safari), then enable from Profile. Android Chrome works either way.",
    },
    {
      emoji: "✓",
      title: "\"I'm in\" / \"Can't make it\" buttons",
      body:
        "Confirm or drop from a tee time without digging into your inbox. Right on the detail page.",
    },
    {
      emoji: "⏰",
      title: "Default tee times",
      body:
        "Set your usual weeknight and weekend tee-off times in Profile, and they'll pre-fill when you create a new tee time.",
    },
    {
      emoji: "🔄",
      title: "Live updates",
      body:
        "The list and detail pages refresh themselves every 30 seconds, so when someone confirms or joins, you see it without reloading.",
    },
  ];

  const text =
    `Hi ${name},\n\n` +
    `A bunch of new stuff went live this week. Quick rundown:\n\n` +
    features
      .map((f) => `${f.emoji} ${f.title}\n${f.body}\n`)
      .join("\n") +
    `\nOpen it: ${appUrl}\n`;

  const featuresHtml = features
    .map(
      (f) => `
        <div style="margin:0 0 18px 0;">
          <p style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#111827;">
            <span style="display:inline-block;width:22px;">${f.emoji}</span>${escapeHtml(
              f.title
            )}
          </p>
          <p style="margin:0;padding-left:22px;font-size:14px;line-height:1.55;color:#374151;">${escapeHtml(
            f.body
          )}</p>
        </div>`
    )
    .join("");

  const html = shell(
    `
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 18px 0;">A bunch of new stuff went live this week. Quick rundown:</p>
        ${featuresHtml}
        <div style="margin:8px 0 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;">
            <tr>
              <td bgcolor="${BRAND_GREEN}" style="border-radius:8px;">
                <a href="${appUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Open Tee Time Tracker</a>
              </td>
            </tr>
          </table>
        </div>
`,
    { unsubscribeUrl }
  );

  return { subject, text, html };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function newUserJoinedAdminEmail(opts: {
  newUserName: string;
  newUserEmail: string;
}) {
  const { newUserName, newUserEmail } = opts;
  const subject = `New user joined: ${newUserName}`;

  const text =
    `${newUserName} (${newUserEmail}) just finished setting up their ` +
    `${APP_NAME} account.\n\n` +
    `Manage users: ${APP_URL}/admin\n`;

  const html = shell(`
        <p style="margin:0 0 12px 0;"><strong>${newUserName}</strong> (${newUserEmail}) just finished setting up their ${APP_NAME} account.</p>
        ${btn("Manage users", `${APP_URL}/admin`)}
`);

  return { subject, text, html };
}

export function feedbackSubmittedAdminEmail(opts: {
  submitterName: string;
  submitterEmail: string;
  type: string;
  message: string;
}) {
  const { submitterName, submitterEmail, type, message } = opts;
  const typeLabel = feedbackTypeLabel(type);
  const subject = `Feedback (${typeLabel}) from ${submitterName}`;

  const text =
    `${submitterName} (${submitterEmail}) sent feedback.\n\n` +
    `Type: ${typeLabel}\n\n` +
    `${message}\n\n` +
    `Reply to this email to respond to ${submitterName} directly.\n`;

  const html = shell(`
        <p style="margin:0 0 4px 0;"><strong>${escapeHtml(
          submitterName
        )}</strong> (${escapeHtml(submitterEmail)}) sent feedback.</p>
        <p style="margin:0 0 12px 0;color:#555;">Type: <strong>${typeLabel}</strong></p>
        <div style="margin:0 0 16px 0;padding:12px 14px;background:#f3f4f6;border-radius:8px;white-space:pre-wrap;">${escapeHtml(
          message
        )}</div>
        <p style="margin:0;color:#555;font-size:13px;">Reply to this email to respond to ${escapeHtml(
          submitterName
        )} directly.</p>
`);

  return { subject, text, html };
}

// --- Inbound email (forwarded booking confirmation) replies -----------------

export function inboundCreatedEmail(opts: {
  name: string;
  course: string;
  teeOffAt: Date;
  teeTimeUrl: string;
}) {
  const { name, course, teeOffAt, teeTimeUrl } = opts;
  const when = formatTeeOff(teeOffAt);
  const subject = `Tee time created: ${course} — ${when}`;

  const text =
    `Hi ${name},\n\n` +
    `Got your forwarded confirmation — the tee time is on the board:\n\n` +
    `${course}\n${when}\n\n` +
    `You're on it as the booker. The rest of the group has been notified.\n\n` +
    `${teeTimeUrl}\n`;

  const html = shell(`
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 12px 0;">Got your forwarded confirmation — the tee time is on the board:</p>
        <p style="margin:0 0 12px 0;"><strong>${escapeHtml(course)}</strong><br />${when}</p>
        <p style="margin:0 0 12px 0;">You're on it as the booker. The rest of the group has been notified.</p>
        ${btn("View tee time", teeTimeUrl)}
`);

  return { subject, text, html };
}

export function inboundDuplicateEmail(opts: {
  name: string;
  course: string;
  teeOffAt: Date;
  teeTimeUrl: string;
}) {
  const { name, course, teeOffAt, teeTimeUrl } = opts;
  const when = formatTeeOff(teeOffAt);
  const subject = `Already on the board: ${course} — ${when}`;

  const text =
    `Hi ${name},\n\n` +
    `That tee time is already on the board, so nothing new was created:\n\n` +
    `${course}\n${when}\n\n` +
    `${teeTimeUrl}\n`;

  const html = shell(`
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 12px 0;">That tee time is already on the board, so nothing new was created:</p>
        <p style="margin:0 0 12px 0;"><strong>${escapeHtml(course)}</strong><br />${when}</p>
        ${btn("View tee time", teeTimeUrl)}
`);

  return { subject, text, html };
}

export function inboundFailedEmail(opts: { name: string; reason: string }) {
  const { name, reason } = opts;
  const subject = `Couldn't read that confirmation`;

  const text =
    `Hi ${name},\n\n` +
    `I couldn't turn your forwarded email into a tee time: ${reason}\n\n` +
    `You can create it manually here: ${APP_URL}/tee-times/new\n`;

  const html = shell(`
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 12px 0;">I couldn't turn your forwarded email into a tee time: ${escapeHtml(reason)}</p>
        ${btn("Create it manually", `${APP_URL}/tee-times/new`)}
`);

  return { subject, text, html };
}

// --- Gmail forwarding setup (self-service onboarding relay) -----------------

export function forwardingSetupEmail(opts: { name: string; confirmUrl: string }) {
  const { name, confirmUrl } = opts;
  const subject = `Confirm forwarding to ${APP_NAME}`;

  const text =
    `Hi ${name},\n\n` +
    `You asked Gmail to auto-forward your tee time confirmations to ${APP_NAME}. ` +
    `Google sent the confirmation here, so we're passing it along to you.\n\n` +
    `Click to finish setting up forwarding:\n${confirmUrl}\n\n` +
    `Once confirmed, your booking confirmations will turn into tee times automatically. ` +
    `If you didn't set this up, you can ignore this — forwarding won't turn on unless you click.\n`;

  const html = shell(`
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 12px 0;">You asked Gmail to auto-forward your tee time confirmations to ${APP_NAME}. Google sent the confirmation here, so we're passing it along to you.</p>
        ${btn("Confirm forwarding", confirmUrl)}
        <p style="margin:12px 0 0 0;color:#6b7280;font-size:13px;">Once confirmed, your booking confirmations turn into tee times automatically. If you didn't set this up, ignore this — forwarding won't turn on unless you click.</p>
`);

  return { subject, text, html };
}

export function forwardingSetupAdminEmail(opts: { requestedBy: string }) {
  const { requestedBy } = opts;
  const subject = `Forwarding setup attempt from a non-member`;

  const text =
    `${requestedBy} tried to set up Gmail forwarding to ${APP_NAME}, but that ` +
    `address isn't a registered member, so the confirmation link was not relayed.\n\n` +
    `If they should have access, invite them: ${APP_URL}/admin\n`;

  const html = shell(`
        <p style="margin:0 0 12px 0;"><strong>${escapeHtml(requestedBy)}</strong> tried to set up Gmail forwarding to ${APP_NAME}, but that address isn't a registered member, so the confirmation link was <strong>not</strong> relayed.</p>
        ${btn("Manage users", `${APP_URL}/admin`)}
`);

  return { subject, text, html };
}

// --- Inbound cancellation detected (member chooses what to do) --------------

export function cancellationDetectedEmail(opts: {
  name: string;
  course: string;
  teeOffAt: Date;
  detailUrl: string;
  leaveUrl: string;
  cancelUrl: string;
}) {
  const { name, course, teeOffAt, detailUrl, leaveUrl, cancelUrl } = opts;
  const when = formatTeeOff(teeOffAt);
  const subject = `Cancelled in ForeUp? — ${course}, ${when}`;

  const text =
    `Hi ${name},\n\n` +
    `We noticed a cancellation come through for this tee time:\n\n` +
    `${course}\n${when}\n\n` +
    `We didn't change anything — you might have just removed yourself, or the whole ` +
    `booking might be off. What would you like to do?\n\n` +
    `• Just remove me from the tee time:\n${leaveUrl}\n\n` +
    `• Cancel the whole tee time for the group:\n${cancelUrl}\n\n` +
    `If nothing changed on our end, you can ignore this — the tee time stays as-is.\n` +
    `View it: ${detailUrl}\n`;

  const html = shell(`
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 12px 0;">We noticed a cancellation come through for this tee time:</p>
        <p style="margin:0 0 12px 0;"><strong>${escapeHtml(course)}</strong><br />${when}</p>
        <p style="margin:0 0 12px 0;">We didn't change anything — you might have just removed yourself, or the whole booking might be off. What would you like to do?</p>
        ${btn("Just remove me", leaveUrl)}
        ${btnSecondary("Cancel the whole tee time", cancelUrl)}
        <p style="margin:12px 0 0 0;color:#6b7280;font-size:13px;">If nothing changed on our end, ignore this — the tee time stays as-is. <a href="${detailUrl}" style="color:#047857;">View it</a>.</p>
`);

  return { subject, text, html };
}

// --- Enhancement announcement: email-to-tee-time + how to set it up ---------

const INBOUND_ADDRESS = "tee@tee3golf.com";

export function forwardingHowToEmail(opts: {
  name: string;
  appUrl: string;
  unsubscribeUrl: string;
}) {
  const { name, appUrl, unsubscribeUrl } = opts;
  const subject = `New: turn your ForeUp booking into a tee time automatically`;

  const gmailSteps = [
    `On a computer, open Gmail → gear (⚙️) → "See all settings".`,
    `"Forwarding and POP/IMAP" tab → "Add a forwarding address" → enter ${INBOUND_ADDRESS} → Next/Proceed.`,
    `Gmail emails a confirmation. We forward that confirmation link straight back to your inbox — open it and click "Confirm".`,
    `Now make TWO filters. Open the "Filters and Blocked Addresses" tab → "Create a new filter".`,
    `Filter 1 (new bookings): From = no-reply@foreupsoftware.com, Subject = Reservation Details. Click "Create filter", then check "Forward it to: ${INBOUND_ADDRESS}" and click "Create filter".`,
    `Filter 2 (cancellations): "Create a new filter" again. From = no-reply@foreupsoftware.com, Subject = Reservation Cancellation Details. Click "Create filter", check "Forward it to: ${INBOUND_ADDRESS}", "Create filter".`,
    `Leave "Skip the Inbox" unchecked on both so you keep your own copy. That's it — bookings and cancellations now flow in automatically.`,
  ];

  const text =
    `Hi ${name},\n\n` +
    `Quick upgrade: you can now turn a course booking into a tee time on the board ` +
    `without typing anything in.\n\n` +
    `THE EASY WAY (works with any email — Gmail, Outlook, Hotmail, anything):\n` +
    `When you get a booking confirmation from the course, just forward it to ` +
    `${INBOUND_ADDRESS}. We read the course, date, time and players and put it on ` +
    `the board, with you on it. Forward a cancellation the same way and we'll ask ` +
    `whether to drop just you or cancel the whole thing — we never change anything ` +
    `on our own.\n\n` +
    `SET-AND-FORGET (Gmail only):\n` +
    `Set up two one-time filters and Gmail will forward your bookings and ` +
    `cancellations automatically, so you never have to think about it:\n\n` +
    gmailSteps.map((s, i) => `${i + 1}. ${s}`).join("\n") +
    `\n\n` +
    `On Outlook/Hotmail the automatic filter isn't supported yet — just use the ` +
    `forward-it method above, which works great.\n\n` +
    `Open the app: ${appUrl}\n`;

  const gmailStepsHtml = gmailSteps
    .map(
      (s) =>
        `<li style="margin:0 0 8px 0;">${escapeHtml(s).replace(
          /(no-reply@foreupsoftware\.com|tee@tee3golf\.com|Reservation Cancellation Details|Reservation Details)/g,
          '<code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;">$1</code>'
        )}</li>`
    )
    .join("\n");

  const html = shell(
    `
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 16px 0;">Quick upgrade: you can now turn a course booking into a tee time on the board without typing anything in.</p>

        <p style="margin:0 0 6px 0;font-size:15px;font-weight:600;color:#111827;">The easy way — works with any email</p>
        <p style="margin:0 0 16px 0;">When you get a booking confirmation from the course, just <strong>forward it to <a href="mailto:${INBOUND_ADDRESS}" style="color:#047857;">${INBOUND_ADDRESS}</a></strong>. We read the course, date, time and players and put it on the board with you on it. Forward a <em>cancellation</em> the same way and we'll ask whether to drop just you or cancel the whole thing — we never change anything on our own.</p>

        <p style="margin:0 0 6px 0;font-size:15px;font-weight:600;color:#111827;">Set-and-forget (Gmail only)</p>
        <p style="margin:0 0 8px 0;">Set up two one-time filters and Gmail forwards your bookings and cancellations automatically:</p>
        <ol style="margin:0 0 16px 0;padding-left:20px;">
          ${gmailStepsHtml}
        </ol>

        <p style="margin:0 0 16px 0;color:#6b7280;font-size:13px;">On Outlook/Hotmail the automatic filter isn't supported yet — just use the forward-it method above, which works great.</p>

        ${btn("Open the app", appUrl)}
`,
    { unsubscribeUrl }
  );

  return { subject, text, html };
}

// --- Enhancement announcement: in-app feedback ------------------------------

export function feedbackAnnouncementEmail(opts: {
  name: string;
  appUrl: string;
  unsubscribeUrl: string;
}) {
  const { name, appUrl, unsubscribeUrl } = opts;
  const feedbackUrl = `${appUrl}/feedback`;
  const subject = `New: send us feedback right from the app`;

  const text =
    `Hi ${name},\n\n` +
    `Small upgrade: there's now a Feedback button in the app. Found a bug, ` +
    `got an idea, or just want to tell us something? Tap "Feedback" in the ` +
    `top bar, pick Bug / Idea / Other, and type away — it comes straight to us.\n\n` +
    `We read every one, and we'll reply by email if we need more detail.\n\n` +
    `Send feedback: ${feedbackUrl}\n`;

  const html = shell(
    `
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 16px 0;">Small upgrade: there's now a <strong>Feedback</strong> button in the app. Found a bug, got an idea, or just want to tell us something?</p>
        <p style="margin:0 0 16px 0;">Tap <strong>Feedback</strong> in the top bar, pick <em>Bug</em>, <em>Idea</em>, or <em>Other</em>, and type away — it comes straight to us. We read every one, and we'll reply by email if we need more detail.</p>
        ${btn("Send feedback", feedbackUrl)}
`,
    { unsubscribeUrl }
  );

  return { subject, text, html };
}

// Generic template for announcements created at /admin/announcements —
// future one-off feature emails go through this instead of a bespoke
// template + broadcast route per feature.
export function announcementEmail(opts: {
  name: string;
  title: string;
  body: string;
  linkUrl: string | null;
  appUrl: string;
  unsubscribeUrl: string;
}) {
  const { name, title, body, linkUrl, appUrl, unsubscribeUrl } = opts;
  const subject = `New: ${title}`;
  const whatsNewUrl = `${appUrl}/whats-new`;

  const text =
    `Hi ${name},\n\n` +
    `${body}\n\n` +
    (linkUrl ? `Check it out: ${appUrl}${linkUrl}\n\n` : "") +
    `All announcements live in the app under What's new: ${whatsNewUrl}\n`;

  const html = shell(
    `
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 8px 0;font-weight:700;">${escapeHtml(title)}</p>
        <p style="margin:0 0 16px 0;white-space:pre-line;">${escapeHtml(body)}</p>
        ${linkUrl ? btn("Check it out", `${appUrl}${linkUrl}`) : btn("Open the app", appUrl)}
        <p style="margin:16px 0 0 0;font-size:12px;color:#6b7280;">All announcements live in the app under <a href="${whatsNewUrl}" style="color:#047857;">What&#39;s new</a>.</p>
`,
    { unsubscribeUrl }
  );

  return { subject, text, html };
}

export function teamsAnnouncementEmail(opts: {
  name: string;
  appUrl: string;
  unsubscribeUrl: string;
}) {
  const { name, appUrl, unsubscribeUrl } = opts;
  const teamsUrl = `${appUrl}/teams`;
  const subject = `New: team generator for tournament days`;

  const text =
    `Hi ${name},\n\n` +
    `Just in time for the tournaments coming up: there's now a Teams button ` +
    `in the app. Pick who's playing (guests too — just type their names), ` +
    `then shake out teams three ways:\n\n` +
    `- Random — everyone into the hat.\n` +
    `- Balanced — enter handicaps and it evens out the teams.\n` +
    `- Captains — mark the captains and draw the rest onto their teams.\n\n` +
    `Re-roll until it looks right, then hit copy and paste the teams into ` +
    `the group chat. Nothing is saved — it's a quick draw tool for the ` +
    `parking lot.\n\n` +
    `Generate teams: ${teamsUrl}\n`;

  const html = shell(
    `
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 16px 0;">Just in time for the tournaments coming up: there's now a <strong>Teams</strong> button in the app. Pick who's playing (guests too — just type their names), then shake out teams three ways:</p>
        <ul style="margin:0 0 16px 0;padding-left:20px;">
          <li style="margin:0 0 6px 0;"><strong>Random</strong> — everyone into the hat.</li>
          <li style="margin:0 0 6px 0;"><strong>Balanced</strong> — enter handicaps and it evens out the teams.</li>
          <li style="margin:0;"><strong>Captains</strong> — mark the captains and draw the rest onto their teams.</li>
        </ul>
        <p style="margin:0 0 16px 0;">Re-roll until it looks right, then hit copy and paste the teams into the group chat. Nothing is saved — it's a quick draw tool for the parking lot.</p>
        ${btn("Generate teams", teamsUrl)}
`,
    { unsubscribeUrl }
  );

  return { subject, text, html };
}
