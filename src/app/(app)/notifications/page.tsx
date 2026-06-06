import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Logo } from "@/app/components/logo";
import { getResolvedFeed } from "@/lib/notification-feed";
import { AutoRefresh } from "../tee-times/auto-refresh";
import { FeedPageClient } from "./feed-page-client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { items } = await getResolvedFeed(session.user.id, 50);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <header className="flex items-center gap-3">
        <Logo size={40} className="h-9 w-9 shrink-0" />
        <h1 className="flex-1 text-lg font-bold sm:text-2xl">Notifications</h1>
        <Link
          href="/tee-times"
          className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          ← Tee times
        </Link>
      </header>

      <FeedPageClient initialItems={items} />
      <AutoRefresh />
    </main>
  );
}
