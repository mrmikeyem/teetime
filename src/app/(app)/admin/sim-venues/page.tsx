import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { VenueForm } from "./venue-form";

export const dynamic = "force-dynamic";

export default async function AdminSimVenuesPage() {
  await requireAdmin();

  const [venues, users] = await Promise.all([
    prisma.simVenue.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: { not: "EVENT" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="flex-1 text-lg font-bold sm:text-2xl">Sim venues</h1>
        <Link
          href="/admin"
          className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          ← Admin
        </Link>
      </header>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        A venue with a host is someone&apos;s place: nights there need the
        host&apos;s OK, and only the host can call one off. A standing night is
        proposed to the host every Monday for that week.
      </p>
      <ul className="space-y-3">
        {venues.map((v) => (
          <li key={v.id}>
            <VenueForm
              venue={{
                id: v.id,
                name: v.name,
                hostUserId: v.hostUserId,
                standingDay: v.standingDay,
                standingTime: v.standingTime,
              }}
              users={users}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
