"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/app/components/logo";

const REMEMBER_KEY = "ttt:rememberedUsername";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setUsername(saved);
        setRemember(true);
      }
    } catch {
      // localStorage unavailable (privacy mode, etc) — silently skip
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const usernameValue = formData.get("username") as string;
    const result = await signIn("credentials", {
      username: usernameValue,
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid credentials");
      setLoading(false);
      return;
    }

    try {
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, usernameValue);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    } catch {
      // ignore
    }

    // Full reload (not router.push) so the iOS viewport zoom resets between
    // pages — client-side navigation preserves the user's pinch-zoom level.
    window.location.href = "/tee-times";
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center text-center">
          <Logo size={128} priority className="h-28 w-28 sm:h-32 sm:w-32" />
          <h1 className="mt-3 text-xl font-bold sm:text-2xl">Tee Time Tracker</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sign in to your group</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium">
              Username or email
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm lowercase focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-emerald-700 focus:ring-emerald-700"
            />
            Remember username on this device
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
