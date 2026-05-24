import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewTeeTimePage } from "./new-form";

export const dynamic = "force-dynamic";

export default async function NewTeeTimeServerPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { weeknightDefault: true, weekendDefault: true },
  });

  return (
    <NewTeeTimePage
      defaults={{
        weeknight: user?.weeknightDefault ?? null,
        weekend: user?.weekendDefault ?? null,
      }}
    />
  );
}
