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

const dutchDayFormatter = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Amsterdam",
});

// Formats a timestamptz value's calendar day (Europe/Amsterdam) as
// "Zaterdag 29 augustus" — the sticky day-separator label in the schedule.
// nl-NL's "long" weekday/month come back lowercase ("zaterdag augustus"),
// so the leading letter is capitalized to read as a heading. Falls back to
// null for a missing/unparseable value, same contract as formatGeplandeTijd.
export function formatDayLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const label = dutchDayFormatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const dutchDateTimeFormatter = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Amsterdam",
});

// Formats a moment as "za 13 aug, 14:32" — full date context, unlike
// formatGeplandeTijd/formatClockTime (weekday + time only, for moments
// whose day is already implied elsewhere). Used for "gegenereerd op"-style
// timestamps, e.g. the printable schema page's header.
export function formatDateTime(date: Date): string {
  return dutchDateTimeFormatter.format(date);
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

// Formats a schedule delta (see actualProgress.ts's ScheduleDelta) as
// "+7 min" (achter), "−4 min" (voor) or "Op schema". The sign/word already
// carries the meaning on its own — this is deliberately never the *only*
// signal a caller pairs with the --db-signal-*/--db-amber color for the same
// band, so the reading survives without color too.
export function formatScheduleDelta(delta: { minutes: number; band: "voor" | "op" | "achter" }): string {
  if (delta.band === "op") return "Op schema";
  const sign = delta.band === "achter" ? "+" : "−";
  return `${sign}${Math.abs(delta.minutes)} min`;
}

const temperatureFormatter = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });

// Formats a temperature (°C) as "14°C" — whole degrees, nl-NL rounding
// (only matters for the minus-sign placement, which Intl gets right for
// negative values too).
export function formatTemperatureC(value: number): string {
  return `${temperatureFormatter.format(Math.round(value))}°C`;
}

const windFormatter = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 });

// Formats a wind speed (km/u, as Open-Meteo returns it) as "18 km/u wind".
export function formatWindKmh(value: number): string {
  return `${windFormatter.format(Math.round(value))} km/u wind`;
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
