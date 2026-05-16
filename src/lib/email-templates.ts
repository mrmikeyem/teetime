import "server-only";

const APP_URL = process.env.AUTH_URL ?? "https://infiniterien.com";
const APP_NAME = "Tee Time Tracker";
const TAGLINE = "Track. Plan. Shank. Repeat.";
const LOGO_URL = `${APP_URL}/logo-email.png`;
const BRAND_NAVY = "#1f2c4a";
const BRAND_GREEN = "#15803d";

function shell(bodyHtml: string) {
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
                <p style="margin:0;">${APP_URL.replace(/^https?:\/\//, "")}</p>
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
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px 0;">
  <tr>
    <td bgcolor="${BRAND_GREEN}" style="border-radius:8px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
    </td>
  </tr>
</table>`;
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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
