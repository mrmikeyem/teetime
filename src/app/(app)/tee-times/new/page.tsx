import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewTeeTimePage } from "./new-form";

export const dynamic = "force-dynamic";

export default async function NewTeeTimeServerPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [user, venues] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { weeknightDefault: true, weekendDefault: true },
    }),
    prisma.simVenue.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        hostUserId: true,
        standingTime: true,
        host: { select: { name: true } },
      },
    }),
  ]);

  return (
    <NewTeeTimePage
      defaults={{
        weeknight: user?.weeknightDefault ?? null,
        weekend: user?.weekendDefault ?? null,
      }}
      venues={venues.map((v) => ({
        id: v.id,
        name: v.name,
        hostUserId: v.hostUserId,
        hostName: v.host?.name ?? null,
        standingTime: v.standingTime,
      }))}
    />
  );
}
