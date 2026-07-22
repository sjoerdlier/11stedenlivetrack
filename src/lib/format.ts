const geplandeTijdFormatter = new Intl.DateTimeFormat("nl-NL", {
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
  return geplandeTijdFormatter.format(date);
}
