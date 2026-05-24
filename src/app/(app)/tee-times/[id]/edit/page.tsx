import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditForm } from "./edit-form";

export const dynamic = "force-dynamic";

export default async function EditTeeTimePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const teeTime = await prisma.teeTime.findUnique({
    where: { id },
    select: {
      id: true,
      course: true,
      teeOffAt: true,
      partySize: true,
      type: true,
      externalUrl: true,
      signupDeadline: true,
      rangeOpensTime: true,
      isShotgun: true,
      format: true,
      entryFee: true,
      notes: true,
    },
  });
  if (!teeTime) notFound();

  // Convert UTC instant to CT wall-clock string for the form inputs.
  // The form expects YYYY-MM-DD and HH:mm in Central Time.
  const ct = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(teeTime.teeOffAt);
  const get = (t: string) => ct.find((p) => p.type === t)?.value ?? "";
  const initialDate = `${get("year")}-${get("month")}-${get("day")}`;
  const initialTime = `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;

  // Format signupDeadline for datetime-local input (browser-local time).
  // datetime-local needs "YYYY-MM-DDTHH:mm" without timezone suffix.
  let signupDeadlineInput = "";
  if (teeTime.signupDeadline) {
    const dl = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(teeTime.signupDeadline);
    const dlGet = (t: string) => dl.find((p) => p.type === t)?.value ?? "";
    signupDeadlineInput = `${dlGet("year")}-${dlGet("month")}-${dlGet("day")}T${
      dlGet("hour") === "24" ? "00" : dlGet("hour")
    }:${dlGet("minute")}`;
  }

  return (
    <EditForm
      teeTimeId={teeTime.id}
      initialCourse={teeTime.course}
      initialDate={initialDate}
      initialTime={initialTime}
      initialPartySize={teeTime.partySize ?? 4}
      initialNotes={teeTime.notes ?? ""}
      initialType={teeTime.type}
      initialTournament={{
        externalUrl: teeTime.externalUrl ?? "",
        signupDeadline: signupDeadlineInput,
        rangeOpensTime: teeTime.rangeOpensTime ?? "",
        isShotgun: teeTime.isShotgun,
        format: teeTime.format ?? "",
        entryFee: teeTime.entryFee?.toString() ?? "",
      }}
    />
  );
}
