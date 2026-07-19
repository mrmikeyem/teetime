import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { EventForm } from "../event-form";

export default async function NewEventPage() {
  await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold sm:text-2xl">New event</h1>
        <Link
          href="/events"
          className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          ← Events
        </Link>
      </header>
      <EventForm />
    </main>
  );
}
