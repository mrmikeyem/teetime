import "server-only";
import nodemailer from "nodemailer";

type SendMailArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT ?? 25);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.MAIL_FROM ?? "no-reply@infiniterien.com";

const transport = host
  ? nodemailer.createTransport({
      host,
      port,
      secure: port === 465 || port === 2465,
      auth: user && pass ? { user, pass } : undefined,
    })
  : null;

export async function sendMail({ to, subject, text, html }: SendMailArgs) {
  if (!transport) {
    console.log("\n[mailer:dev] SMTP_HOST not set — would have sent:");
    console.log(`  To:      ${to}`);
    console.log(`  From:    ${from}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body:\n${text.replace(/^/gm, "    ")}\n`);
    return;
  }
  await transport.sendMail({ from, to, subject, text, html });
}
