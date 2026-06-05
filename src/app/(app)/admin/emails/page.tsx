import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
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

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ failed?: string }>;
}) {
  await requireAdmin();
  const { failed } = await searchParams;
  const failedOnly = failed === "1";

  const [logs, failedCount] = await Promise.all([
    prisma.emailLog.findMany({
      where: failedOnly ? { status: "FAILED" } : undefined,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.emailLog.count({ where: { status: "FAILED" } }),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <Link href="/admin" className="text-sm text-emerald-700 hover:underline">
        ← Admin
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Email log</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Every email the app has sent, newest first. Last {PAGE_SIZE} shown.
        </p>
      </header>

      <div className="flex gap-2 text-sm">
        <Link
          href="/admin/emails"
          className={`rounded-full px-3 py-1 ${
            !failedOnly
              ? "bg-emerald-700 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          }`}
        >
          All
        </Link>
        <Link
          href="/admin/emails?failed=1"
          className={`rounded-full px-3 py-1 ${
            failedOnly
              ? "bg-red-600 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          }`}
        >
          Failed ({failedCount})
        </Link>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {failedOnly ? "No failed sends. 🎉" : "Nothing sent yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li
              key={log.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{log.subject}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    log.status === "SENT"
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                      : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                  }`}
                >
                  {log.status === "SENT" ? "Sent" : "Failed"}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{log.to}</span>
                <span>·</span>
                <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">
                  {log.kind}
                </span>
                <span>·</span>
                <span>{formatWhen(log.createdAt)}</span>
                {log.attempts > 1 && (
                  <>
                    <span>·</span>
                    <span>{log.attempts} attempts</span>
                  </>
                )}
              </div>
              {log.error && (
                <p className="mt-1 break-all text-xs text-red-600 dark:text-red-400">
                  {log.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
