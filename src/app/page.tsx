import AppShell from "@/components/AppShell";
import { loadRoute } from "@/lib/gpx";
import { loadLegs } from "@/lib/legs";
import { loadCheckins } from "@/lib/checkins";
import { buildLegSegments } from "@/lib/segments";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { points, start } = loadRoute();
  const [legs, checkins] = await Promise.all([loadLegs(), loadCheckins()]);
  const legSegments = buildLegSegments(points, legs);

  return <AppShell start={start} legSegments={legSegments} checkins={checkins} />;
}
