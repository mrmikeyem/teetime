"use client";

import { useState } from "react";

export function CreateUserForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = (formData.get("email") as string).trim();
    const eventOnly = formData.get("eventOnly") === "on";

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: eventOnly ? "EVENT" : "BASIC" }),
    });

    setLoading(false);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error || "Failed to send invite");
      return;
    }

    setSuccess(data.warning || `Invite sent to ${email}`);
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/30 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="user@example.com"
          className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm lowercase focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          They&apos;ll get an email to set their name and password.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          name="eventOnly"
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-600"
        />
        <span>
          Event-only user
          <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
            For trip guests: full access to events they&apos;re in, but no
            emails/pushes about the group&apos;s regular tee times.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {loading ? "Sending invite..." : "Send invite"}
      </button>
    </form>
  );
}
