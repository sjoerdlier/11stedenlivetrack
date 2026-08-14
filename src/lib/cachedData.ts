import { unstable_cache } from "next/cache";
import { loadLegs } from "./legs";
import { loadCheckins } from "./checkins";
import { loadLivePositions } from "./livePositions";
import { loadWeather } from "./weather";

// Shared between page.tsx (the initial SSR render), /api/poll (AppShell's
// lightweight background refresh — see AppShell.tsx's poll effect), and
// /update (the AI journal) so all three read from the same cache bucket
// instead of each maintaining their own unstable_cache instance keyed
// identically. Same 20s revalidate window as page.tsx's other cached
// loaders, and for the same reason: a poll should never pay for its own
// uncached Supabase round-trip.
export const getCachedLegs = unstable_cache(loadLegs, ["legs"], { revalidate: 20 });
export const getCachedCheckins = unstable_cache(loadCheckins, ["checkins"], { revalidate: 20 });
export const getCachedLivePositions = unstable_cache(loadLivePositions, ["live_positions"], { revalidate: 20 });
// Open-Meteo, unlike the Supabase reads above, isn't something a viewer's
// own poll should hammer every 20s — weather doesn't change that fast, and
// this is a free API with no key. A much longer window (30 min, within the
// "900-1800s" range other slow-changing context uses) still means everyone
// checking during the event sees the same handful of API calls.
export const getCachedWeather = unstable_cache(loadWeather, ["weather"], { revalidate: 1800 });
