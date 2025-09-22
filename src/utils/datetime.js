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

// Force a time-only label with AM/PM (12-hour). Supports ET or local.
// Usage examples:
//   formatGameLabel(iso)                               -> "7:30 PM"
//   formatGameLabel(iso, { mode: "ET" })               -> "7:30 PM EST"
//   formatGameLabel(iso, { mode: "local", withTZ: true }) -> "7:30 PM PDT"
export function formatGameLabel(
  iso,
  { mode = "local", withTZ = false, uppercaseAmPm = true } = {}
) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";

  const timeZone = mode === "ET" ? "America/New_York" : undefined;

  // Build parts so we can normalize the AM/PM casing and control TZ text.
  const parts = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,            // force 12-hour so we always get AM/PM
    ...(timeZone ? { timeZone } : {}),
    ...(withTZ ? { timeZoneName: "short" } : {}),
  }).formatToParts(d);

  let hour = "", minute = "", dayPeriod = "", tz = "";
  for (const p of parts) {
    if (p.type === "hour") hour = p.value;
    else if (p.type === "minute") minute = p.value;
    else if (p.type === "dayPeriod") dayPeriod = p.value;
    else if (p.type === "timeZoneName") tz = p.value;
  }

  // Normalize "p.m." / "PM" variants
  if (uppercaseAmPm && dayPeriod) {
    dayPeriod = dayPeriod.replace(/\./g, "").toUpperCase(); // "p.m." -> "PM"
  }

  const core = `${hour}:${minute} ${dayPeriod}`.trim();
  return withTZ && tz ? `${core} ${tz}` : core;
}


/** Time-only in local timezone, e.g. "6:00 PM" */
export function timeOnlyLocal(iso, { withTZ = false, hour12 = true } = {}) {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";

  const opts = {
    hour: "numeric",
    minute: "2-digit",
    hour12,
    ...(withTZ ? { timeZoneName: "short" } : {}),
  };

  return new Intl.DateTimeFormat(undefined, opts).format(d);
}
