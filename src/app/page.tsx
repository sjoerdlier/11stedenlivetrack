import AppShell from "@/components/AppShell";
import { loadRoute } from "@/lib/gpx";
import { loadLegs } from "@/lib/legs";
import { buildLegSegments } from "@/lib/segments";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { points, start } = loadRoute();
  const legs = await loadLegs();
  const legSegments = buildLegSegments(points, legs);

  return <AppShell start={start} legSegments={legSegments} />;
}
