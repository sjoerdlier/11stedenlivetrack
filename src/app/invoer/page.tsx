import { cookies } from "next/headers";
import { CHECKIN_COOKIE, isAuthorized } from "@/lib/checkinAuth";
import { loadLegs, type Leg } from "@/lib/legs";
import InvoerClient from "./InvoerClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invoer — 11Stedentocht",
};

export default async function InvoerPage() {
  const cookieStore = await cookies();
  const authorized = isAuthorized(cookieStore.get(CHECKIN_COOKIE)?.value);

  // The PIN gate itself doesn't need legs data — if Supabase hiccups, the
  // fallback tool should still let someone in rather than crash on load.
  let legs: Leg[] = [];
  let legsError: string | null = null;
  try {
    legs = await loadLegs();
  } catch (err) {
    legsError = err instanceof Error ? err.message : "Kon legs niet laden.";
  }

  return <InvoerClient initialAuthorized={authorized} legs={legs} legsError={legsError} />;
}
