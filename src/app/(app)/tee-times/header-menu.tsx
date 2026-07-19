"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * The ☰ menu that replaced the crowded header button row. Secondary
 * destinations live here; the bell stays outside as its own affordance.
 * `children` is the server-rendered sign-out form.
 */
export function HeaderMenu({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const itemClass =
    "block rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700";

  const links: { href: string; label: string }[] = [
    { href: "/events", label: "⛳ Events" },
    { href: "/teams", label: "🎲 Teams" },
    { href: "/profile", label: "👤 Profile" },
    { href: "/feedback", label: "💬 Feedback" },
    { href: "/whats-new", label: "✨ What's new" },
    ...(isAdmin ? [{ href: "/admin", label: "🔧 Admin" }] : []),
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Menu"
        className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
      >
        ☰
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
            tabIndex={-1}
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-48 space-y-0.5 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                {l.label}
              </Link>
            ))}
            <div className="border-t border-gray-100 pt-1 dark:border-gray-700">
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
