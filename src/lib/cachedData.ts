import { unstable_cache } from "next/cache";
import { loadCheckins } from "./checkins";
import { loadLivePositions } from "./livePositions";

// Shared between page.tsx (the initial SSR render) and /api/poll (AppShell's
// lightweight background refresh — see AppShell.tsx's poll effect) so both
// read from the same cache bucket instead of each maintaining their own
// unstable_cache instance keyed identically. Same 20s revalidate window as
// page.tsx's other cached loaders, and for the same reason: a poll should
// never pay for its own uncached Supabase round-trip.
export const getCachedCheckins = unstable_cache(loadCheckins, ["checkins"], { revalidate: 20 });
export const getCachedLivePositions = unstable_cache(loadLivePositions, ["live_positions"], { revalidate: 20 });
