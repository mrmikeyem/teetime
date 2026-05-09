import { auth } from "@/lib/auth";
import { CreateUserForm } from "./create-user-form";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8 space-y-6">
      <Link href="/tee-times" className="text-sm text-emerald-700 hover:underline">
        ← Tee times
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-gray-500">
          Create a real user account so they can log in.
        </p>
      </header>
      <CreateUserForm />
    </main>
  );
}
