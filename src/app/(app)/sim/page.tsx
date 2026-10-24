import { redirect } from "next/navigation";
import { getSimHub, getSimViewer } from "@/lib/sim";
import { AutoRefresh } from "../tee-times/auto-refresh";
import { simFontVariables } from "./fonts";
import { SimHub } from "./sim-hub";
import { simTheme } from "./themes";
import "./sim.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "Golf Course Wheel · Tee Time Tracker" };

export default async function SimPage() {
  // Middleware guarantees a session; sim access is a per-user flag.
  const viewer = await getSimViewer();
  if (!viewer) redirect("/tee-times");

  const data = await getSimHub();

  return (
    <>
      <SimHub
        data={data}
        isAdmin={viewer.isAdmin}
        initialTheme={simTheme(viewer.simTheme).id}
        fontClassName={simFontVariables}
      />
      <AutoRefresh />
    </>
  );
}
