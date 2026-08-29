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
  // party/legNr/tijdstip/notitie are optional prefill values for a tap-to-fill
  // link (see CheckinForm's `prefill` prop) -- e.g. built from a screenshot
  // someone sends in chat, so opening the link only needs "Opslaan", not
  // retyping the whole form. Absent entirely for the normal, manual-entry
  // flow, which behaves exactly as before.
  searchParams: Promise<{ route?: string; party?: string; legNr?: string; tijdstip?: string; notitie?: string }>;
}

export async function generateMetadata({ searchParams }: InvoerPageProps): Promise<Metadata> {
  const { route } = await searchParams;
  const config = routeConfig(parseRouteSlug(route));
  return {
    ...socialMetadata(
      `Invoer — ${config.pageTitle}`,
      `Check-in invoeren voor de ${config.routeDescription}`,
    ),
    // PIN-gated admin screen — doesn't belong in search results.
    robots: { index: false, follow: false },
  };
}

const getCachedLegs = unstable_cache(loadLegs, ["legs"], { revalidate: 20 });

export default async function InvoerPage({ searchParams }: InvoerPageProps) {
  const { route, party, legNr, tijdstip, notitie } = await searchParams;
  const activeRoute = parseRouteSlug(route);
  const cookieStore = await cookies();
  const authorized = await isAuthorized(cookieStore.get(CHECKIN_COOKIE)?.value);

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
      prefill={{ party, legNr, tijdstip, notitie }}
    />
  );
}
