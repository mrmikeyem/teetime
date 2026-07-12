import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { AnnouncementForm, DeleteAnnouncementButton } from "./announcement-form";

export const dynamic = "force-dynamic";

function formatWhen(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

export default async function AdminAnnouncementsPage() {
  await requireAdmin();

  const announcements = await prisma.announcement.findMany({
    orderBy: { publishedAt: "desc" },
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="flex-1 text-lg font-bold sm:text-2xl">Announcements</h1>
        <Link
          href="/whats-new"
          className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          View as member
        </Link>
        <Link
          href="/admin"
          className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          ← Admin
        </Link>
      </header>

      <AnnouncementForm />

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Published ({announcements.length})
        </p>
        {announcements.map((a) => (
          <article
            key={a.id}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {a.title}
              </h2>
              <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                {formatWhen(a.publishedAt)}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-700 dark:text-gray-200">
              {a.body}
            </p>
            <div className="mt-2 flex items-center gap-3">
              {a.url && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  links to <code>{a.url}</code>
                </span>
              )}
              <DeleteAnnouncementButton id={a.id} title={a.title} />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
