import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/app/components/logo";
import { TeamGenerator } from "./team-generator";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const members = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <header className="flex items-center gap-3">
        <Logo size={40} className="h-9 w-9 shrink-0" />
        <h1 className="flex-1 text-lg font-bold sm:text-2xl">Team generator</h1>
        <Link
          href="/tee-times"
          className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          ← Tee times
        </Link>
      </header>

      <p className="text-sm text-gray-600 dark:text-gray-300">
        Build a roster, pick a style, and shake out teams. Nothing here is
        saved — copy the result when you like it.
      </p>

      <TeamGenerator members={members} />
    </main>
  );
}
