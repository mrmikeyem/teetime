import { requireAdmin, isProtectedUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { CreateUserForm } from "./create-user-form";
import { UserRow } from "./user-row";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ lastLoginAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      lastLoginAt: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <Link href="/tee-times" className="text-sm text-emerald-700 hover:underline">
        ← Tee times
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage users and create new accounts.
        </p>
      </header>

      <Link
        href="/admin/emails"
        className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-emerald-300"
      >
        📧 Email log →
      </Link>

      <Link
        href="/admin/feedback"
        className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-emerald-300"
      >
        💬 Feedback →
      </Link>

      <Link
        href="/admin/announcements"
        className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-emerald-300"
      >
        📣 Announcements →
      </Link>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Users ({users.length})
        </h2>
        <ul className="space-y-2">
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={{
                id: u.id,
                username: u.username,
                name: u.name,
                email: u.email,
                role: u.role,
                lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
                createdAt: u.createdAt.toISOString(),
                teeTimeCount: u._count.memberships,
                isProtected: isProtectedUserId(u.id),
              }}
              isSelf={u.id === session.user.id}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-lg bg-white dark:bg-gray-900 p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Invite user
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Send an email invite. They&apos;ll set their own name and password.
        </p>
        <CreateUserForm />
      </section>
    </main>
  );
}
