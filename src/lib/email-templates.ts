import "server-only";

const APP_URL = process.env.AUTH_URL ?? "https://infiniterien.com";
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
  teeOffAt: Date;
  roster: RosterEntry[];
  confirmUrl: string;
  leaveUrl: string;
  detailUrl: string;
  unsubscribeUrl: string;
  whatToExpect?: string | null;
}) {
  const { name, course, teeOffAt, roster, confirmUrl, leaveUrl, detailUrl, unsubscribeUrl, whatToExpect } = opts;
  const when = formatTeeOff(teeOffAt);
  const subject = `Tee time in 1 hour — ${course}, ${when}`;

  const rosterText = roster
    .map((r) => `  ${r.confirmed ? "✓" : "•"} ${r.name}${r.isGuest ? " (guest)" : ""}`)
    .join("\n");

  const text =
    `Hi ${name},\n\n` +
    `You're scheduled to tee off in about an hour:\n\n` +
    `Course: ${course}\n` +
    `When: ${when}\n\n` +
    (whatToExpect ? `What to expect: ${whatToExpect}\n\n` : "") +
    `Group:\n${rosterText}\n\n` +
    `Confirm you're playing: ${confirmUrl}\n` +
    `Can't make it (leave): ${leaveUrl}\n` +
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

  const whatToExpectHtml = whatToExpect
    ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;width:100%;background-color:#eff6ff;border-radius:8px;">
          <tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#1e3a8a;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">What to expect</p>
            <p style="margin:0;font-size:14px;line-height:1.5;color:#1e3a8a;">${escapeHtml(whatToExpect)}</p>
          </td></tr>
        </table>`
    : "";

  const html = shell(
    `
        <p style="margin:0 0 12px 0;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 16px 0;">You're scheduled to tee off in about an hour.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;width:100%;background-color:#f9fafb;border-radius:8px;">
          <tr><td style="padding:14px 16px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Course</p>
            <p style="margin:0 0 10px 0;font-size:16px;font-weight:600;">${escapeHtml(course)}</p>
            <p style="margin:0 0 4px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">When</p>
            <p style="margin:0;font-size:16px;font-weight:600;">${escapeHtml(when)}</p>
          </td></tr>
        </table>${whatToExpectHtml}
        <p style="margin:0 0 6px 0;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Group</p>
        <ul style="list-style:none;padding:0;margin:0 0 18px 0;">${rosterHtml}</ul>
        <div>${btn("I'm playing", confirmUrl)}${btnSecondary("Can't make it", leaveUrl)}</div>
        <p style="margin:14px 0 0 0;font-size:13px;"><a href="${detailUrl}" style="color:${BRAND_GREEN};">View tee time details &rarr;</a></p>
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
