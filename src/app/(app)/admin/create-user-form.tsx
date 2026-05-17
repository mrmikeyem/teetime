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
    const firstName = (formData.get("firstName") as string).trim();
    const lastName = (formData.get("lastName") as string).trim();
    const email = (formData.get("email") as string).trim();
    const phone = (formData.get("phone") as string).trim();
    const password = formData.get("password") as string;

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, phone, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create");
      return;
    }

    const username = `${firstName}${lastName}`.toLowerCase();
    setSuccess(`Created ${firstName} ${lastName} (username: ${username})`);
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

      <div className="flex gap-2">
        <div className="flex-1">
          <label htmlFor="firstName" className="block text-sm font-medium">
            First Name
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="lastName" className="block text-sm font-medium">
            Last Name
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
          />
        </div>
      </div>

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
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium">
          Phone (optional)
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+1 555 555 5555"
          className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="text"
          required
          minLength={6}
          autoComplete="new-password"
          className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-emerald-700 focus:ring-emerald-700 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Share this with the user — they can change it later.
        </p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create user"}
      </button>
    </form>
  );
}
