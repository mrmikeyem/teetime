import "server-only";
import { NextResponse } from "next/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { WheelPlayer, WheelSettings } from "@/lib/sim-wheel";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Sim access is a per-user flag (default on), read from the DB at check time
 * like roles are — never from the JWT. Returns null when the viewer can't
 * use /sim.
 */
export async function getSimViewer() {
  const session = await auth();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, simAccess: true, simTheme: true },
  });
  if (!user || !user.simAccess) return null;
  return { ...user, isAdmin: user.role === "ADMIN" };
}

/** API-route guard: the viewer, or a JSON error response to return as-is. */
export async function requireSimApi(opts: { admin?: boolean } = {}) {
  const viewer = await getSimViewer();
  if (!viewer) {
    return { error: NextResponse.json({ error: "Not allowed" }, { status: 403 }) };
  }
  if (opts.admin && !viewer.isAdmin) {
    return { error: NextResponse.json({ error: "Admins only" }, { status: 403 }) };
  }
  return { viewer };
}

export async function getSimSettings(db: Db = prisma): Promise<WheelSettings> {
  const s = await db.simSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
  return {
    courseLimit: s.courseLimit,
    tallyEnabled: s.tallyEnabled,
    tallyMode: s.tallyMode,
    tallyMultiplier: Number(s.tallyMultiplier),
  };
}

const playerInclude = {
  user: { select: { name: true } },
  guest: { select: { name: true } },
  list: {
    orderBy: { position: "asc" },
    include: { course: true },
  },
} satisfies Prisma.SimPlayerInclude;

type PlayerRow = Prisma.SimPlayerGetPayload<{ include: typeof playerInclude }>;

export function playerName(p: {
  user: { name: string } | null;
  guest: { name: string } | null;
}): string {
  return p.user?.name ?? p.guest?.name ?? "(unknown)";
}

async function loadPlayerRows(db: Db): Promise<PlayerRow[]> {
  return db.simPlayer.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "asc" },
    include: playerInclude,
  });
}

/** Active players in the engine's shape (server-side wheel recompute). */
export async function loadWheelPlayers(db: Db = prisma): Promise<WheelPlayer[]> {
  const rows = await loadPlayerRows(db);
  return rows.map(toWheelPlayer);
}

function toWheelPlayer(p: PlayerRow): WheelPlayer {
  return {
    id: p.id,
    name: playerName(p),
    checked: p.checked,
    list: p.list.map((e) => ({
      entryId: e.id,
      courseId: e.courseId,
      courseName: e.course.name,
      tally: e.tally,
    })),
  };
}

/** Everything the /sim page renders, serialized for the client. */
export async function getSimHub() {
  const [rows, settings, plays, users] = await Promise.all([
    loadPlayerRows(prisma),
    getSimSettings(),
    prisma.simPlay.findMany({
      orderBy: { playedAt: "desc" },
      include: {
        course: true,
        players: {
          include: {
            player: {
              include: {
                user: { select: { name: true } },
                guest: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    // Candidates for "add player": registered members not already playing.
    prisma.user.findMany({
      where: { NOT: { name: { contains: "@" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, simPlayer: { select: { archivedAt: true } } },
    }),
  ]);

  // Most recent play per course — "Last played" on the result card.
  const lastPlayed: Record<string, string> = {};
  for (const p of plays) {
    if (!lastPlayed[p.courseId]) lastPlayed[p.courseId] = p.playedAt.toISOString();
  }

  return {
    settings,
    players: rows.map((p) => ({
      ...toWheelPlayer(p),
      isGuest: !!p.guestId,
      list: p.list.map((e) => ({
        entryId: e.id,
        courseId: e.courseId,
        courseName: e.course.name,
        tally: e.tally,
        apiId: e.course.apiId,
        location: [e.course.city, e.course.state].filter(Boolean).join(", "),
      })),
    })),
    plays: plays.map((p) => ({
      id: p.id,
      courseId: p.courseId,
      courseName: p.course.name,
      apiId: p.course.apiId,
      location: [p.course.city, p.course.state].filter(Boolean).join(", "),
      city: p.course.city,
      state: p.course.state,
      country: p.course.country,
      playedAt: p.playedAt.toISOString(),
      dateOnly: p.dateOnly,
      source: p.source,
      tee: p.teeName
        ? {
            name: p.teeName,
            rating: p.teeRating != null ? Number(p.teeRating) : null,
            slope: p.teeSlope,
            yards: p.teeYards,
          }
        : null,
      comment: p.comment ?? "",
      suggesters: p.players
        .filter((x) => x.suggested)
        .map((x) => ({ playerId: x.playerId, name: playerName(x.player) })),
      players: p.players
        .filter((x) => x.played)
        .map((x) => ({ playerId: x.playerId, name: playerName(x.player) })),
    })),
    lastPlayed,
    memberCandidates: users
      .filter((u) => !u.simPlayer || u.simPlayer.archivedAt)
      .map((u) => ({ id: u.id, name: u.name })),
  };
}

export type SimHubData = Awaited<ReturnType<typeof getSimHub>>;

export type CourseInput = {
  name: string;
  apiId?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

/** Parse a course payload from a request body; null if there's no name. */
export function parseCourseInput(raw: unknown): CourseInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  // GolfCourseAPI ids are opaque strings now ("3j4b4ar8"); the old app's
  // numeric ids survive as strings ("24469") and are served from cache.
  const apiId =
    typeof r.apiId === "string" || typeof r.apiId === "number" ? String(r.apiId).trim().toLowerCase() : "";
  return {
    name,
    apiId: /^[A-Za-z0-9]{1,32}$/.test(apiId) ? apiId : null,
    city: str(r.city),
    state: str(r.state),
    country: str(r.country),
  };
}

/**
 * The canonical course for a name/API pick: match on apiId first, then on a
 * case-insensitive name (preferring the linked course), else create it.
 * `unlinked` forces an unlinked course — the play-log "unlink" escape hatch
 * for a wrong database link.
 */
export async function findOrCreateCourse(
  db: Db,
  input: CourseInput,
  opts: { unlinked?: boolean } = {}
) {
  if (opts.unlinked) {
    const plain = await db.simCourse.findFirst({
      where: { apiId: null, name: { equals: input.name, mode: "insensitive" } },
    });
    return plain ?? db.simCourse.create({ data: { name: input.name } });
  }
  if (input.apiId) {
    const existing = await db.simCourse.findUnique({ where: { apiId: input.apiId } });
    if (existing) return existing;
    return db.simCourse.create({
      data: {
        name: input.name,
        apiId: input.apiId,
        city: input.city ?? null,
        state: input.state ?? null,
        country: input.country ?? null,
      },
    });
  }
  const byName = await db.simCourse.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
    orderBy: { apiId: { sort: "asc", nulls: "last" } },
  });
  if (byName) return byName;
  return db.simCourse.create({ data: { name: input.name } });
}

export type TeeInput = {
  name: string;
  rating: number | null;
  slope: number | null;
  yards: number | null;
} | null;

export function parseTee(raw: unknown): TeeInput {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;
  const num = (v: unknown) => {
    const n = Number(v);
    return v != null && v !== "" && Number.isFinite(n) ? n : null;
  };
  const slope = num(r.slope);
  const yards = num(r.yards);
  return {
    name,
    rating: num(r.rating),
    slope: slope != null ? Math.round(slope) : null,
    yards: yards != null ? Math.round(yards) : null,
  };
}

export function teeColumns(tee: TeeInput) {
  return {
    teeName: tee?.name ?? null,
    teeRating: tee?.rating ?? null,
    teeSlope: tee?.slope ?? null,
    teeYards: tee?.yards ?? null,
  };
}
