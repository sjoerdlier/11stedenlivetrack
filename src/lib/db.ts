import { neon } from "@neondatabase/serverless";

// Vercel's Postgres storage integration (Neon under the hood) injects
// DATABASE_URL automatically once connected in the project's Storage tab —
// no .env.local entry needed beyond what `vercel env pull` gives you
// locally. POSTGRES_URL is the older/legacy name some integration variants
// set instead of (or alongside) DATABASE_URL; falling back to it keeps this
// working either way rather than depending on exactly which name shows up.
export function getSql() {
  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL (of POSTGRES_URL) ontbreekt. Zie .env.example.");
  }
  return neon(connectionString);
}
