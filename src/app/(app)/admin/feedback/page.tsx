import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { feedbackTypeLabel, isFeedbackType } from "@/lib/feedback-types";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

function formatWhen(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

const TYPE_BADGE: Record<string, string> = {
  bug: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  idea: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300",
  other: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
};

const FILTERS = [
  { key: undefined, label: "All" },
  { key: "bug", label: "Bugs" },
  { key: "idea", label: "Ideas" },
  { key: "other", label: "Other" },
] as const;

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireAdmin();
  const { type } = await searchParams;
  const activeType = isFeedbackType(type) ? type : undefined;

  const items = await prisma.feedback.findMany({
    where: activeType ? { type: activeType } : undefined,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <Link href="/admin" className="text-sm text-emerald-700 hover:underline">
        ← Admin
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          What members have sent in, newest first. Last {PAGE_SIZE} shown.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => {
          const active = activeType === f.key;
          const href = f.key ? `/admin/feedback?type=${f.key}` : "/admin/feedback";
          return (
            <Link
              key={f.label}
              href={href}
              className={`rounded-full px-3 py-1 ${
                active
                  ? "bg-emerald-700 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {activeType ? "Nothing in this category yet." : "No feedback yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((f) => (
            <li
              key={f.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">
                  {f.user?.name ?? "(unknown)"}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    TYPE_BADGE[f.type] ?? TYPE_BADGE.other
                  }`}
                >
                  {feedbackTypeLabel(f.type)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
                {f.message}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400">
                {f.user?.email && (
                  <>
                    <a
                      href={`mailto:${f.user.email}?subject=${encodeURIComponent(
                        "Re: your Tee Time Tracker feedback"
                      )}`}
                      className="text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {f.user.email}
                    </a>
                    <span>·</span>
                  </>
                )}
                <span>{formatWhen(f.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
