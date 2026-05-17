import { Logo } from "@/app/components/logo";
import Link from "next/link";

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; message?: string }>;
}) {
  const { status, message } = await searchParams;
  const ok = status === "ok";

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center">
          <Logo size={96} className="h-20 w-20 sm:h-24 sm:w-24" />
          <h1 className="mt-3 text-xl font-bold sm:text-2xl">
            {ok ? "Done" : "Hmm"}
          </h1>
        </div>

        <div
          className={`rounded-md p-4 text-center text-sm ${
            ok
              ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
          }`}
        >
          {message ?? (ok ? "Action complete." : "Something went wrong.")}
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          <Link
            href="/tee-times"
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Go to tee times
          </Link>
        </p>
      </div>
    </div>
  );
}
