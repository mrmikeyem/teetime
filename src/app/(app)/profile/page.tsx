import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PreferencesForm } from "./preferences-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, name: true, email: true },
  });
  if (!user) redirect("/login");

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 space-y-6">
      <header className="flex items-center justify-between gap-2">
        <Link href="/tee-times" className="text-sm text-emerald-700 hover:underline">
          ← Back to tee times
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="space-y-1">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-gray-500">Manage your info and notifications.</p>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Account
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Name</dt>
            <dd className="font-medium">{user.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Username</dt>
            <dd className="font-mono text-gray-700">{user.username}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Email</dt>
            <dd className="text-gray-700">{user.email ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Email notifications
        </h2>
        <PreferencesForm
          initial={{
            reminders: prefs?.reminders ?? true,
            addedTo: prefs?.addedTo ?? true,
            joinedByOther: prefs?.joinedByOther ?? true,
            leftByOther: prefs?.leftByOther ?? true,
            newTeeTime: prefs?.newTeeTime ?? true,
            unsubscribedAll: prefs?.unsubscribedAll ?? false,
          }}
        />
      </section>
    </main>
  );
}
