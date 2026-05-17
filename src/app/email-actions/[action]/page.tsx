import { Logo } from "@/app/components/logo";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";

type ActionKey = "confirm" | "decline" | "leave" | "join" | "unsubscribe";

const ACTION_LABELS: Record<ActionKey, { heading: string; body: string; cta: string; cancel?: string }> = {
  confirm: {
    heading: "Confirm you're playing",
    body: "You'll be marked as confirmed for this tee time.",
    cta: "I'm in",
  },
  decline: {
    heading: "Decline this invite",
    body: "You'll be removed from the tee time.",
    cta: "I can't make it",
  },
  leave: {
    heading: "Leave this tee time",
    body: "You'll be removed from the tee time.",
    cta: "Leave",
  },
  join: {
    heading: "Join this tee time",
    body: "You'll be added as a pending member.",
    cta: "Join the group",
  },
  unsubscribe: {
    heading: "Unsubscribe from all emails",
    body: "You won't receive any more notifications. You can re-enable in your account settings.",
    cta: "Unsubscribe me",
  },
};

export default async function EmailActionPage({
  params,
  searchParams,
}: {
  params: Promise<{ action: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { action } = await params;
  const { token } = await searchParams;

  if (!isValidAction(action)) return errorView("Unknown action.");
  if (!token) return errorView("Missing token.");

  // Peek at the token (don't consume) to render context-aware copy.
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = await prisma.emailActionToken.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { name: true } },
      // teeTimeId is not a FK, fetch separately if present
    },
  });

  if (!row || row.action !== action) return errorView("This link is invalid.");
  if (row.expiresAt < new Date()) return errorView("This link has expired.");
  if (row.usedAt && action !== "unsubscribe") {
    return errorView("This link has already been used.");
  }

  const teeTime = row.teeTimeId
    ? await prisma.teeTime.findUnique({
        where: { id: row.teeTimeId },
        select: { course: true, teeOffAt: true },
      })
    : null;

  const labels = ACTION_LABELS[action];

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center">
          <Logo size={96} priority className="h-20 w-20 sm:h-24 sm:w-24" />
          <h1 className="mt-3 text-xl font-bold sm:text-2xl">{labels.heading}</h1>
          {row.user?.name && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Signed in as {row.user.name}</p>
          )}
        </div>

        {teeTime && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4 text-center text-sm">
            <p className="font-semibold">{teeTime.course}</p>
            <p className="text-gray-500 dark:text-gray-400">{formatTeeOff(teeTime.teeOffAt)}</p>
          </div>
        )}

        <p className="text-center text-sm text-gray-600 dark:text-gray-300">{labels.body}</p>

        <form action={`/api/email-actions/${action}`} method="POST" className="space-y-3">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            {labels.cta}
          </button>
        </form>
      </div>
    </div>
  );
}

function isValidAction(s: string): s is ActionKey {
  return ["confirm", "decline", "leave", "join", "unsubscribe"].includes(s);
}

function formatTeeOff(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
    timeZone: "America/Chicago",
  }).format(date);
}

function errorView(message: string) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center">
          <Logo size={96} className="h-20 w-20 sm:h-24 sm:w-24" />
          <h1 className="mt-3 text-xl font-bold sm:text-2xl">Can't do that</h1>
        </div>
        <p className="text-center text-sm text-gray-600 dark:text-gray-300">{message}</p>
      </div>
    </div>
  );
}
