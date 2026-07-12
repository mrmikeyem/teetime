import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/app/components/logo";
import { isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const INBOUND_ADDRESS = "tee@tee3golf.com";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });
}

const GMAIL_STEPS = [
  `On a computer, open Gmail → gear (⚙️) → "See all settings".`,
  `"Forwarding and POP/IMAP" tab → "Add a forwarding address" → enter ${INBOUND_ADDRESS} → Next/Proceed.`,
  `Gmail emails a confirmation. We forward that confirmation link straight back to your inbox — open it and click "Confirm".`,
  `Now make TWO filters. Open the "Filters and Blocked Addresses" tab → "Create a new filter".`,
  `Filter 1 (new bookings): From = no-reply@foreupsoftware.com, Subject = Reservation Details. Click "Create filter", then check "Forward it to: ${INBOUND_ADDRESS}" and click "Create filter".`,
  `Filter 2 (cancellations): "Create a new filter" again. From = no-reply@foreupsoftware.com, Subject = Reservation Cancellation Details. Create filter → check "Forward it to: ${INBOUND_ADDRESS}" → "Create filter".`,
  `Leave "Skip the Inbox" unchecked on both so you keep your own copy. Done — bookings and cancellations flow in automatically.`,
];

export default async function WhatsNewPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [announcements, admin] = await Promise.all([
    prisma.announcement.findMany({ orderBy: { publishedAt: "desc" } }),
    isAdmin(),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <header className="flex items-center gap-3">
        <Logo size={40} className="h-9 w-9 shrink-0" />
        <h1 className="flex-1 text-lg font-bold sm:text-2xl">
          What&apos;s new
        </h1>
        {admin && (
          <Link
            href="/admin/announcements"
            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            Manage
          </Link>
        )}
        <Link
          href="/tee-times"
          className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          ← Tee times
        </Link>
      </header>

      <p className="text-sm text-gray-600 dark:text-gray-300">
        Every feature announcement lives here for good — no digging through
        old emails. How-to guides are at the bottom.
      </p>

      <section className="space-y-3">
        {announcements.map((a) => (
          <article
            key={a.id}
            className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {a.title}
              </h2>
              <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                {formatDate(a.publishedAt)}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-200">
              {a.body}
            </p>
            {a.url && (
              <Link
                href={a.url}
                className="mt-3 inline-block rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Check it out
              </Link>
            )}
          </article>
        ))}
        {announcements.length === 0 && (
          <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            Nothing here yet.
          </p>
        )}
      </section>

      <section
        id="email-forwarding"
        className="scroll-mt-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          How-to · Email a booking, get a tee time
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
          <p>
            <strong>The easy way (any email):</strong> when the course sends
            you a booking confirmation, forward it to{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-700">
              {INBOUND_ADDRESS}
            </code>
            . We read the course, date, time and players and put it on the
            board with you on it. Forward a cancellation the same way and
            we&apos;ll ask whether to drop just you or cancel the whole thing
            — we never change anything on our own.
          </p>
          <p>
            <strong>Set-and-forget (Gmail only):</strong> two one-time
            filters and Gmail forwards bookings and cancellations
            automatically:
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            {GMAIL_STEPS.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className="text-gray-500 dark:text-gray-400">
            Outlook/Hotmail don&apos;t support the automatic filter yet —
            just use the forward-it method, it works great.
          </p>
        </div>
      </section>

      <section
        id="calendar-feed"
        className="scroll-mt-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          How-to · Tee times in your calendar
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
          Your <Link href="/profile" className="font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-400">profile</Link>{" "}
          has a personal calendar subscription link — add it to Apple,
          Google, or Outlook once and every tee time (and any edits) shows
          up automatically within about half an hour.
        </p>
      </section>
    </main>
  );
}
