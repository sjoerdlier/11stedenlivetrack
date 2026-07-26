import type { Metadata } from "next";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { CHECKIN_COOKIE, isAuthorized } from "@/lib/checkinAuth";
import { loadLegs, type Leg } from "@/lib/legs";
import { parseRouteSlug, routeConfig, socialMetadata } from "@/lib/routes";
import InvoerClient from "./InvoerClient";

// The page itself can't be ISR-cached: it reads the PIN-session cookie to
// decide whether to show the gate or the form, which is per-visitor by
// definition — caching that would leak one visitor's authorized view to
// everyone else, or serve a stale gate to someone who just entered the PIN.
// The legs lookup below is unrelated to that cookie (same public schedule
// data as `/`), so it still gets the same 20s data cache even though the
// route as a whole stays dynamic.
export const dynamic = "force-dynamic";

interface InvoerPageProps {
  searchParams: Promise<{ route?: string }>;
}

export async function generateMetadata({ searchParams }: InvoerPageProps): Promise<Metadata> {
  const { route } = await searchParams;
  const config = routeConfig(parseRouteSlug(route));
  return socialMetadata(
    `Invoer — ${config.pageTitle}`,
    `Check-in invoeren voor de ${config.routeDescription}`,
  );
}

const getCachedLegs = unstable_cache(loadLegs, ["legs"], { revalidate: 20 });

export default async function InvoerPage({ searchParams }: InvoerPageProps) {
  const { route } = await searchParams;
  const activeRoute = parseRouteSlug(route);
  const cookieStore = await cookies();
  const authorized = isAuthorized(cookieStore.get(CHECKIN_COOKIE)?.value);

  // The PIN gate itself doesn't need legs data — if Supabase hiccups, the
  // fallback tool should still let someone in rather than crash on load.
  let legs: Leg[] = [];
  let legsError: string | null = null;
  try {
    legs = await getCachedLegs(activeRoute);
  } catch (err) {
    legsError = err instanceof Error ? err.message : "Kon legs niet laden.";
  }

  return (
    <InvoerClient
      activeRoute={activeRoute}
      initialAuthorized={authorized}
      legs={legs}
      legsError={legsError}
    />
  );
}
