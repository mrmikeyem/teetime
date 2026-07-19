import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { EventForm } from "../../event-form";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const ev = await prisma.event.findUnique({ where: { id } });
  if (!ev) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold sm:text-2xl">Edit event</h1>
        <Link
          href={`/events/${id}`}
          className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          ← Back to hub
        </Link>
      </header>
      <EventForm
        initial={{
          id: ev.id,
          name: ev.name,
          location: ev.location ?? "",
          rules: ev.rules ?? "",
          startDate: ev.startDate.toISOString().slice(0, 10),
          endDate: ev.endDate.toISOString().slice(0, 10),
          standingsMode: ev.standingsMode,
        }}
      />
    </main>
  );
}
