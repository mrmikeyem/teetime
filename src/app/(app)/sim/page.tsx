import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSimHub, getSimViewer } from "@/lib/sim";
import { AutoRefresh } from "../tee-times/auto-refresh";
import { simFontVariables } from "./fonts";
import { SimHub } from "./sim-hub";
import { simTheme } from "./themes";
import "./sim.css";

export const dynamic = "force-dynamic";

export const metadata = { title: "Golf Course Wheel · Tee Time Tracker" };

export default async function SimPage() {
  // Pages gate themselves (the middleware doesn't redirect): no session →
  // /login; signed in without sim access → back to the tee-time list.
  if (!(await auth())) redirect("/login");
  const viewer = await getSimViewer();
  if (!viewer) redirect("/tee-times");

  const data = await getSimHub();

  return (
    <>
      <SimHub
        data={data}
        isAdmin={viewer.isAdmin}
        viewerId={viewer.id}
        initialTheme={simTheme(viewer.simTheme).id}
        fontClassName={simFontVariables}
      />
      <AutoRefresh />
    </>
  );
}
