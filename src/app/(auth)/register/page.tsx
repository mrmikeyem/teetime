import Link from "next/link";
import { Logo } from "@/app/components/logo";

export default function RegisterPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center text-center">
          <Logo size={96} priority className="h-20 w-20 sm:h-24 sm:w-24" />
          <h1 className="mt-3 text-xl font-bold sm:text-2xl">Invite only</h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Tee Time Tracker is a private group app. New accounts are created
            by your group admin. Ask them to set one up for you.
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
