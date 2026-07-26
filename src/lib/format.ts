const dutchClockFormatter = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Amsterdam",
});

// Formats a timestamptz string (e.g. from Supabase) as "za 18:32". Falls
// back to the raw value if it isn't a parseable date, so a schema surprise
// shows something on screen instead of crashing the page.
export function formatGeplandeTijd(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dutchClockFormatter.format(date);
}

// Formats a computed timestamp (e.g. an estimated arrival) the same way as
// formatGeplandeTijd, as "za 18:32".
export function formatClockTime(ms: number): string | null {
  if (!Number.isFinite(ms)) return null;
  return dutchClockFormatter.format(new Date(ms));
}

export function googleMapsUrl(lat: number, lon: number): string {
  return `https://maps.google.com/?q=${lat},${lon}`;
}

const paceFormatter = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// Formats a km/u pace as "6,3 km/u", nl-NL style with one decimal.
export function formatPaceKmh(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${paceFormatter.format(value)} km/u`;
}

const kmFormatter = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// Formats a distance as "6,7 km", always one decimal — Postgres numeric
// trims trailing zeros (afstand_km can come back as 9 next to 6.7 in the
// same table), which read as inconsistent side by side without this.
export function formatKm(value: number): string {
  return `${kmFormatter.format(value)} km`;
}

// Formats how long ago `sinceMs` was, relative to `now`, as "zojuist" /
// "12s geleden" / "3 minuten geleden" — for a "laatst bijgewerkt" freshness
// indicator, not a precise duration, so it stays coarse on purpose.
export function formatRelativeTime(sinceMs: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - sinceMs) / 1000));
  if (seconds < 10) return "zojuist";
  if (seconds < 60) return `${seconds}s geleden`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minuut" : "minuten"} geleden`;
}
