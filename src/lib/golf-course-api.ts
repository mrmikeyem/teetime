import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * GolfCourseAPI (golfcourseapi.com) client for the sim wheel: course search
 * and tee/rating details. Details are cached in `golf_course_cache` (course
 * data barely changes). Search results only carry tee COUNTS
 * (`tees: { male: 8 }`), so they're never cached.
 *
 * Without GOLFCOURSE_API_KEY, search reports "not configured" and details
 * fall back to whatever is cached.
 *
 * Ids (API v1.3 spec): opaque 8-char lowercase strings ("7k2m9qb4"). The
 * old app linked courses by the API's former numeric ids, which no longer
 * resolve — those LEGACY ids ("24469") are served from the imported cache,
 * never refetched. Auth is `Authorization: Bearer <key>` (the spec's
 * preferred scheme; `Key <key>` is legacy).
 */

const BASE = "https://api.golfcourseapi.com/v1";
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type ApiTee = {
  tee_name: string;
  course_rating?: number | null;
  slope_rating?: number | null;
  total_yards?: number | null;
  number_of_holes?: number | null;
  par_total?: number | null;
};

export type ApiCourse = {
  id: string | number;
  club_name?: string;
  course_name?: string;
  location?: { city?: string; state?: string; country?: string; address?: string };
  tees?: { male?: ApiTee[]; female?: ApiTee[] };
};

export type CourseSearchResult = {
  apiId: string;
  /** "Club - Course" when they differ (the old app's display name rule). */
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
};

export class GolfApiNotConfigured extends Error {}

function apiKey(): string {
  const key = process.env.GOLFCOURSE_API_KEY;
  if (!key) throw new GolfApiNotConfigured("Course search isn't set up yet.");
  return key;
}

export function displayName(c: ApiCourse): string {
  const club = c.club_name?.trim();
  const course = c.course_name?.trim();
  if (club && course && club !== course) return `${club} - ${course}`;
  return club || course || `Course ${c.id}`;
}

function toResult(c: ApiCourse): CourseSearchResult {
  return {
    apiId: String(c.id).toLowerCase(),
    name: displayName(c),
    city: c.location?.city || null,
    state: c.location?.state || null,
    country: c.location?.country || null,
  };
}

async function cachePut(course: ApiCourse) {
  const payload = course as unknown as Prisma.InputJsonValue;
  const apiId = String(course.id).toLowerCase();
  await prisma.golfCourseCache.upsert({
    where: { apiId },
    create: { apiId, payload },
    update: { payload, fetchedAt: new Date() },
  });
}

export async function searchCourses(query: string): Promise<CourseSearchResult[]> {
  const res = await fetch(
    `${BASE}/search?search_query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${apiKey()}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`GolfCourseAPI search failed (${res.status})`);
  const data = (await res.json()) as { courses?: ApiCourse[] };
  const courses = (data.courses ?? []).filter((c) => c.id != null && c.id !== "");
  return courses.map(toResult);
}

/** A pre-v1 numeric id from the old app (current ids are 8 chars). */
export function isLegacyApiId(apiId: string): boolean {
  return /^\d{1,7}$/.test(apiId);
}

/** Course details, cache-first; stale or missing → refetch when possible. */

export async function getCourseDetails(apiId: string): Promise<ApiCourse | null> {
  const cached = await prisma.golfCourseCache.findUnique({ where: { apiId } });
  const fresh = cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS;
  if (cached && (fresh || isLegacyApiId(apiId) || !process.env.GOLFCOURSE_API_KEY)) {
    return cached.payload as unknown as ApiCourse;
  }
  try {
    if (isLegacyApiId(apiId)) return null;
    const res = await fetch(`${BASE}/courses/${encodeURIComponent(apiId)}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`GolfCourseAPI details failed (${res.status})`);
    const data = (await res.json()) as { course?: ApiCourse } & ApiCourse;
    const course = data.course ?? data;
    if (!Array.isArray(course.tees?.male) && !Array.isArray(course.tees?.female)) {
      throw new Error("GolfCourseAPI details had no tee sets");
    }
    await cachePut(course);
    return course;
  } catch (err) {
    // Serve stale over nothing.
    if (cached) return cached.payload as unknown as ApiCourse;
    if (err instanceof GolfApiNotConfigured) return null;
    throw err;
  }
}
