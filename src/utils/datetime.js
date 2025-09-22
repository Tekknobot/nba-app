// src/utils/datetime.js

/** Format an ISO string in the user's local timezone.
 * Example: "Thu · Jan 1, 2026 · 6:00 PM EST"
 */
export function formatISOToLocal(
  iso,
  { withWeekday = true, withTZ = true, hour12 = true } = {}
) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const opts = {
    ...(withWeekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12,
    ...(withTZ ? { timeZoneName: "short" } : {}),
  };

  // Use default locale/timezone
  return new Intl.DateTimeFormat(undefined, opts).format(d).replace(", ", " · ");
}

/** Format an ISO string in a specific IANA timezone (e.g., ET = "America/New_York").
 * Example: "Thu · Jan 1, 2026 · 6:00 PM EST"
 */
export function formatISOInZone(
  iso,
  timeZone = "America/New_York",
  { withWeekday = true, withTZ = true, hour12 = true } = {}
) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const opts = {
    ...(withWeekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12,
    timeZone,
    ...(withTZ ? { timeZoneName: "short" } : {}),
  };

  return new Intl.DateTimeFormat(undefined, opts).format(d).replace(", ", " · ");
}

/** Short variants for tight UI */
export const shortLocal = (iso) =>
  formatISOToLocal(iso, { withWeekday: false, withTZ: false });

export const shortInET = (iso) =>
  formatISOInZone(iso, "America/New_York", { withWeekday: false });

/** Time-only in ET, like "6:00 PM ET" */
export const timeOnlyET = (iso) => {
  const s = formatISOInZone(iso, "America/New_York", {
    withWeekday: false,
    withTZ: true,
  });
  // Keep just "6:00 PM ET" (last part after the last " · ")
  const parts = s.split("·").map((x) => x.trim());
  return parts.length >= 2 ? parts[parts.length - 1] : s;
};

/** Smart label:
 * - If no valid ISO, returns "TBD"
 * - If you want ET league style, set opts.mode = "ET"
 * - Otherwise returns local by default
 */
export function formatGameLabel(iso, opts = { mode: "local" }) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";

  if (opts.mode === "ET") {
    return formatISOInZone(iso, "America/New_York");
  }
  return formatISOToLocal(iso);
}
