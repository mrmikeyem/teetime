"use client";

import { useState } from "react";

export function CalendarSync({
  appUrl,
  initialToken,
}: {
  appUrl: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<"https" | "webcal" | null>(null);
  const [error, setError] = useState("");
  const [confirmRotate, setConfirmRotate] = useState(false);

  async function ensureToken() {
    if (token) return token;
    return rotate(false);
  }

  async function rotate(force: boolean) {
    setError("");
    setGenerating(true);
    try {
      const res = await fetch("/api/profile/calendar-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate: force }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't generate");
        return null;
      }
      const { token: newToken } = await res.json();
      setToken(newToken);
      return newToken;
    } finally {
      setGenerating(false);
      setConfirmRotate(false);
    }
  }

  async function copy(kind: "https" | "webcal") {
    const t = await ensureToken();
    if (!t) return;
    const url = kind === "https" ? httpsUrl(appUrl, t) : webcalUrl(appUrl, t);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Couldn't copy — long-press the URL to copy manually");
    }
  }

  if (!token) {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => rotate(false)}
          disabled={generating}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate calendar feed"}
        </button>
        <p className="text-xs text-gray-500">
          We'll create a unique URL just for you. Keep it private — anyone with
          the URL can see your tee times.
        </p>
      </div>
    );
  }

  const https = httpsUrl(appUrl, token);
  const webcal = webcalUrl(appUrl, token);

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <UrlRow
          label="Apple Calendar"
          url={webcal}
          onCopy={() => copy("webcal")}
          copied={copied === "webcal"}
        />
        <UrlRow
          label="Google / Outlook"
          url={https}
          onCopy={() => copy("https")}
          copied={copied === "https"}
        />
      </div>

      <details className="text-xs text-gray-600">
        <summary className="cursor-pointer font-semibold text-emerald-700 hover:text-emerald-800">
          How to subscribe
        </summary>
        <ul className="mt-2 space-y-1 pl-4">
          <li>
            <strong>Apple Calendar (iPhone/Mac):</strong> tap the Apple
            Calendar URL above and confirm.
          </li>
          <li>
            <strong>Google Calendar:</strong> Settings → Add calendar → From
            URL → paste the Google/Outlook URL.
          </li>
          <li>
            <strong>Outlook:</strong> Add calendar → Subscribe from web →
            paste the URL.
          </li>
        </ul>
      </details>

      <div className="border-t border-gray-100 pt-3">
        {confirmRotate ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-600">
              Old URL stops working. Continue?
            </span>
            <button
              type="button"
              onClick={() => rotate(true)}
              disabled={generating}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {generating ? "Rotating…" : "Yes, rotate"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmRotate(false)}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRotate(true)}
            className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
          >
            Rotate URL (revoke and regenerate)
          </button>
        )}
      </div>
    </div>
  );
}

function UrlRow({
  label,
  url,
  onCopy,
  copied,
}: {
  label: string;
  url: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="mt-1 break-all font-mono text-[11px] text-gray-500">
        {url}
      </p>
    </div>
  );
}

function httpsUrl(appUrl: string, token: string) {
  return `${appUrl}/api/calendar/${token}`;
}

function webcalUrl(appUrl: string, token: string) {
  return `${appUrl.replace(/^https?:/, "webcal:")}/api/calendar/${token}`;
}
