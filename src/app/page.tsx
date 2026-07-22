import { unstable_cache } from "next/cache";
import AppShell from "@/components/AppShell";
import { loadRoute } from "@/lib/gpx";
import { loadLegs } from "@/lib/legs";
import { loadCheckins } from "@/lib/checkins";
import { buildLegSegments } from "@/lib/segments";

// Route-level ISR (dropping force-dynamic, adding `revalidate`) was tried
// first but rejected: without force-dynamic, Next tries to prerender this
// page at *build* time, which means a deploy now depends on Supabase being
// reachable during the build step — a brief Supabase hiccup at exactly the
// wrong moment would fail the whole build, a failure mode that never
// existed with force-dynamic. That's too much risk for a live event
// tracker to take on for a caching win.
//
// unstable_cache gets most of the benefit without that risk: it caches
// independently of the route's rendering mode, so the route keeps
// rendering per-request (safe, same reliability as before) while repeat
// requests within the window share one Supabase read instead of each
// paying for their own. There's also no client-side polling today — a
// viewer only sees new check-ins by reloading — so a 20s cache window
// costs nothing perceptible against that baseline.
export const dynamic = "force-dynamic";

const getCachedLegs = unstable_cache(loadLegs, ["legs"], { revalidate: 20 });
const getCachedCheckins = unstable_cache(loadCheckins, ["checkins"], { revalidate: 20 });

export default async function Home() {
  const { points, start } = loadRoute();
  const [legs, checkins] = await Promise.all([getCachedLegs(), getCachedCheckins()]);
  const legSegments = buildLegSegments(points, legs);

  return <AppShell start={start} legSegments={legSegments} checkins={checkins} />;
}
