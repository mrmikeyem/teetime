import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * GolfCourseAPI (golfcourseapi.com) client for the sim wheel: course search
 * and tee/rating details. Details are cached in `golf_course_cache` (course
 * data barely changes); search results carry full course payloads too, so
 * every search warms the cache for free.
 *
 * Without GOLFCOURSE_API_KEY, search reports "not configured" and details
 * fall back to whatever is cached — the imported cache covers every course
 * the old app had linked.
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
  id: number;
  club_name?: string;
  course_name?: string;
  location?: { city?: string; state?: string; country?: string; address?: string };
  tees?: { male?: ApiTee[]; female?: ApiTee[] };
};

export type CourseSearchResult = {
  apiId: number;
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
    apiId: c.id,
    name: displayName(c),
    city: c.location?.city || null,
    state: c.location?.state || null,
    country: c.location?.country || null,
  };
}

async function cachePut(course: ApiCourse) {
  const payload = course as unknown as Prisma.InputJsonValue;
  await prisma.golfCourseCache.upsert({
    where: { apiId: course.id },
    create: { apiId: course.id, payload },
    update: { payload, fetchedAt: new Date() },
  });
}

export async function searchCourses(query: string): Promise<CourseSearchResult[]> {
  const res = await fetch(
    `${BASE}/search?search_query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Key ${apiKey()}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`GolfCourseAPI search failed (${res.status})`);
  const data = (await res.json()) as { courses?: ApiCourse[] };
  const courses = (data.courses ?? []).filter((c) => typeof c.id === "number");
  await Promise.allSettled(courses.filter((c) => c.tees).map(cachePut));
  return courses.map(toResult);
}

/** Course details, cache-first; stale or missing → refetch when possible. */
export async function getCourseDetails(apiId: number): Promise<ApiCourse | null> {
  const cached = await prisma.golfCourseCache.findUnique({ where: { apiId } });
  const fresh = cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS;
  if (cached && (fresh || !process.env.GOLFCOURSE_API_KEY)) {
    return cached.payload as unknown as ApiCourse;
  }
  try {
    const res = await fetch(`${BASE}/courses/${apiId}`, {
      headers: { Authorization: `Key ${apiKey()}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`GolfCourseAPI details failed (${res.status})`);
    const data = (await res.json()) as { course?: ApiCourse } & ApiCourse;
    const course = data.course ?? data;
    await cachePut(course);
    return course;
  } catch (err) {
    // Serve stale over nothing.
    if (cached) return cached.payload as unknown as ApiCourse;
    if (err instanceof GolfApiNotConfigured) return null;
    throw err;
  }
}
