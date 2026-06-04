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

// Resend rate-limits sends per second. All sends are serialized through a
// single queue with a minimum gap so concurrent fan-outs (new tee time
// broadcasts, reminder crons) can't exceed the limit — without this, a
// burst of sends fails with 429s. Transient failures retry with backoff.
const MIN_SEND_GAP_MS = 600; // ~1.7 sends/sec, safely under the limit
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2000;

let queue: Promise<void> = Promise.resolve();
let lastSendAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendMail({ to, subject, text, html }: SendMailArgs) {
  if (!transport) {
    console.log("\n[mailer:dev] SMTP_HOST not set — would have sent:");
    console.log(`  To:      ${to}`);
    console.log(`  From:    ${from}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body:\n${text.replace(/^/gm, "    ")}\n`);
    return;
  }

  const send = queue.then(async () => {
    for (let attempt = 1; ; attempt++) {
      const wait = lastSendAt + MIN_SEND_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        await transport.sendMail({ from, to, subject, text, html });
        return;
      } catch (err) {
        if (attempt >= MAX_ATTEMPTS) throw err;
        console.error(
          `[mailer] send to ${to} failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying:`,
          err
        );
        await sleep(attempt * RETRY_BACKOFF_MS);
      } finally {
        lastSendAt = Date.now();
      }
    }
  });

  // Keep the queue alive even when this send ultimately fails.
  queue = send.catch(() => {});

  try {
    await send;
  } catch (err) {
    console.error(
      `[mailer] send to ${to} FAILED after ${MAX_ATTEMPTS} attempts — subject "${subject}":`,
      err
    );
    throw err;
  }
}
