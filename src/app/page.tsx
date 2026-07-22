import RouteMapLoader from "@/components/RouteMapLoader";
import { loadRoute } from "@/lib/gpx";
import { loadLegs } from "@/lib/legs";
import { buildLegSegments } from "@/lib/segments";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { points, start } = loadRoute();
  const legs = await loadLegs();
  const legSegments = buildLegSegments(points, legs);

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <RouteMapLoader start={start} legSegments={legSegments} />
    </div>
  );
}
