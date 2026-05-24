import "server-only";
import { TeeTimeType, TournamentFormat } from "@prisma/client";
import { Prisma } from "@prisma/client";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const URL_RE = /^https?:\/\//i;
const VALID_FORMATS = new Set<string>(Object.values(TournamentFormat));

export type ParsedTournamentFields = {
  type: TeeTimeType;
  name: string | null;
  teamSize: number | null;
  externalUrl: string | null;
  signupDeadline: Date | null;
  rangeOpensTime: string | null;
  isShotgun: boolean;
  format: TournamentFormat | null;
  entryFee: Prisma.Decimal | null;
};

export type TournamentParseError = { error: string };

export function parseTournamentFields(
  body: Record<string, unknown>
): ParsedTournamentFields | TournamentParseError {
  // Type: default TEE_TIME
  let type: TeeTimeType = TeeTimeType.TEE_TIME;
  if (body.type === "TOURNAMENT") type = TeeTimeType.TOURNAMENT;
  else if (body.type && body.type !== "TEE_TIME") {
    return { error: "Invalid type" };
  }

  // Non-tournaments get null for everything else; ignore stray fields.
  if (type !== TeeTimeType.TOURNAMENT) {
    return {
      type,
      name: null,
      teamSize: null,
      externalUrl: null,
      signupDeadline: null,
      rangeOpensTime: null,
      isShotgun: false,
      format: null,
      entryFee: null,
    };
  }

  // Tournament name — required
  let name: string | null = null;
  if (body.name == null || typeof body.name !== "string" || !body.name.trim()) {
    return { error: "Tournament name is required" };
  }
  name = body.name.trim();

  // Team size — required, 2-5
  let teamSize: number | null = null;
  if (body.teamSize == null || body.teamSize === "") {
    return { error: "Team size is required" };
  }
  const n =
    typeof body.teamSize === "number"
      ? body.teamSize
      : typeof body.teamSize === "string"
      ? Number(body.teamSize)
      : NaN;
  if (!Number.isInteger(n) || n < 2 || n > 5) {
    return { error: "Team size must be 2, 3, 4, or 5" };
  }
  teamSize = n;

  // External URL
  let externalUrl: string | null = null;
  if (body.externalUrl != null && body.externalUrl !== "") {
    if (typeof body.externalUrl !== "string") {
      return { error: "Invalid URL" };
    }
    const s = body.externalUrl.trim();
    if (s !== "") {
      if (!URL_RE.test(s)) {
        return { error: "URL must start with http:// or https://" };
      }
      externalUrl = s;
    }
  }

  // Signup deadline (full datetime — comes from datetime-local input)
  let signupDeadline: Date | null = null;
  if (body.signupDeadline != null && body.signupDeadline !== "") {
    if (typeof body.signupDeadline !== "string") {
      return { error: "Invalid signup deadline" };
    }
    const d = new Date(body.signupDeadline);
    if (isNaN(d.getTime())) {
      return { error: "Invalid signup deadline" };
    }
    signupDeadline = d;
  }

  // Range opens time (HH:MM, same day as tee-off)
  let rangeOpensTime: string | null = null;
  if (body.rangeOpensTime != null && body.rangeOpensTime !== "") {
    if (
      typeof body.rangeOpensTime !== "string" ||
      !TIME_RE.test(body.rangeOpensTime)
    ) {
      return { error: "Range opens time must be in HH:MM 24-hour format" };
    }
    rangeOpensTime = body.rangeOpensTime;
  }

  // Shotgun
  const isShotgun = !!body.isShotgun;

  // Format
  let format: TournamentFormat | null = null;
  if (body.format != null && body.format !== "") {
    if (typeof body.format !== "string" || !VALID_FORMATS.has(body.format)) {
      return { error: "Invalid format" };
    }
    format = body.format as TournamentFormat;
  }

  // Entry fee (Decimal up to 2 places)
  let entryFee: Prisma.Decimal | null = null;
  if (body.entryFee != null && body.entryFee !== "") {
    const raw =
      typeof body.entryFee === "number"
        ? body.entryFee.toString()
        : typeof body.entryFee === "string"
        ? body.entryFee.trim()
        : null;
    if (raw == null || !/^\d+(\.\d{1,2})?$/.test(raw)) {
      return { error: "Entry fee must be a number with up to 2 decimals" };
    }
    entryFee = new Prisma.Decimal(raw);
  }

  return {
    type,
    name,
    teamSize,
    externalUrl,
    signupDeadline,
    rangeOpensTime,
    isShotgun,
    format,
    entryFee,
  };
}
