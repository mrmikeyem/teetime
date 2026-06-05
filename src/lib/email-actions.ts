import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type EmailActionType =
  | "confirm"
  | "decline"
  | "leave"
  | "join"
  | "cancel_teetime"
  | "unsubscribe";

const ONE_SHOT_ACTIONS: ReadonlySet<EmailActionType> = new Set([
  "confirm",
  "decline",
  "leave",
  "join",
  "cancel_teetime",
]);

const APP_URL = process.env.AUTH_URL ?? "https://tee3golf.com";

export class EmailActionError extends Error {
  constructor(public code: "invalid" | "expired" | "used") {
    super(code);
  }
}

export async function mintToken(opts: {
  userId: string;
  action: EmailActionType;
  teeTimeId?: string | null;
  ttlMs: number;
}) {
  const { userId, action, teeTimeId, ttlMs } = opts;
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + ttlMs);

  const row = await prisma.emailActionToken.create({
    data: {
      userId,
      action,
      teeTimeId: teeTimeId ?? null,
      tokenHash,
      expiresAt,
    },
    select: { id: true },
  });

  return { rawToken, id: row.id };
}

export async function verifyToken(
  rawToken: string,
  expectedAction: EmailActionType
) {
  if (!rawToken) throw new EmailActionError("invalid");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const row = await prisma.emailActionToken.findUnique({
    where: { tokenHash },
  });
  if (!row || row.action !== expectedAction) {
    throw new EmailActionError("invalid");
  }
  if (row.expiresAt < new Date()) throw new EmailActionError("expired");
  if (ONE_SHOT_ACTIONS.has(row.action as EmailActionType) && row.usedAt) {
    throw new EmailActionError("used");
  }
  return row;
}

export async function markUsed(tokenId: string) {
  await prisma.emailActionToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}

export function buildActionUrl(rawToken: string, action: EmailActionType) {
  return `${APP_URL}/email-actions/${action}?token=${rawToken}`;
}
