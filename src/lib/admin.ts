import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Authoritative role check — reads from DB, not the JWT.
 * Roles can change while a user is signed in; the JWT only refreshes on re-login.
 */
async function currentDbRole(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return u?.role ?? null;
}

/**
 * Use in server components / route handlers that should only be reachable by admins.
 * Returns the session if the user is an admin; redirects otherwise.
 * - No session → /login
 * - Authenticated but not admin → /tee-times (silent redirect)
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = await currentDbRole(session.user.id);
  if (role !== "ADMIN") redirect("/tee-times");
  return session;
}

/**
 * Boolean check for use in API routes (where we want to return a JSON 403, not redirect).
 */
export async function isAdmin() {
  const session = await auth();
  if (!session) return false;
  const role = await currentDbRole(session.user.id);
  return role === "ADMIN";
}

/**
 * Read once at module load. Parsing on every check is unnecessary — the env
 * doesn't change at runtime, and the list is tiny.
 */
const PROTECTED_USER_IDS: ReadonlySet<string> = new Set(
  (process.env.PROTECTED_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

/**
 * Protected users can't be demoted from ADMIN or deleted by anyone — including
 * themselves and other admins. Configured via PROTECTED_USER_IDS env var.
 * Use this as a last-resort guard on irrevocable actions in admin endpoints.
 */
export function isProtectedUserId(id: string): boolean {
  return PROTECTED_USER_IDS.has(id);
}
