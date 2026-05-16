"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/app/components/logo";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirm = formData.get("confirm") as string;

    if (password !== confirm) {
      setError("Passwords don't match");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Reset failed");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  if (!token) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">
        Missing or invalid reset link.
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-md bg-emerald-50 p-4 text-sm text-emerald-800">
        Password updated. Redirecting to sign in...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="confirm" className="block text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {loading ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center text-center">
          <Logo size={96} priority className="h-20 w-20 sm:h-24 sm:w-24" />
          <h1 className="mt-3 text-xl font-bold sm:text-2xl">Choose a new password</h1>
        </div>

        <Suspense fallback={<div className="text-sm text-gray-500">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>

        <p className="text-center text-sm text-gray-500">
          <Link
            href="/login"
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
