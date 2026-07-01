// Timezone-aware helpers for the attendance auto-clock-out scheduler.
// Sweep times are stored as "HH:MM" wall-clock strings and interpreted in a
// configured IANA timezone (default Africa/Lagos, WAT/UTC+1, no DST).

export const DEFAULT_TZ = "Africa/Lagos";
export const DEFAULT_DAY_SWEEPS = ["17:00", "19:00", "21:00"];
export const DEFAULT_NIGHT_SWEEPS = ["07:30", "08:30"];

export type ShiftType = "day" | "night";
export type ResolvedSchedule = { shiftType: ShiftType; slot: string } | null;

// Offset (localWallTime - UTC) in ms for the given instant in the given tz.
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;
  const asUTC = Date.UTC(
    parseInt(map.year, 10),
    parseInt(map.month, 10) - 1,
    parseInt(map.day, 10),
    hour,
    parseInt(map.minute, 10),
    parseInt(map.second, 10),
  );
  return asUTC - date.getTime();
}

export function partsInTz(date: Date, tz: string) {
  const local = new Date(date.getTime() + tzOffsetMs(date, tz));
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}

// "YYYY-MM-DD" for the given instant in the given tz.
export function localDateStr(date: Date, tz: string): string {
  const p = partsInTz(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// Convert a wall-clock time in tz to the corresponding UTC instant.
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const off = tzOffsetMs(new Date(utcGuess), tz);
  return new Date(utcGuess - off);
}

export function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? "").trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return { h, m: mm };
}

// The next occurrence of a "HH:MM" slot (in tz) at or after `after`.
// Day shift: same-day evening slot. Night shift: a morning slot that has
// already passed on the clock-in day resolves to the next calendar morning.
export function nextOccurrenceOf(slot: string, after: Date, tz: string): Date | null {
  const p = parseHHMM(slot);
  if (!p) return null;
  const lp = partsInTz(after, tz);
  let candidate = zonedWallTimeToUtc(lp.year, lp.month, lp.day, p.h, p.m, tz);
  if (candidate.getTime() < after.getTime()) {
    const nextDay = partsInTz(new Date(candidate.getTime() + 24 * 3600 * 1000), tz);
    candidate = zonedWallTimeToUtc(nextDay.year, nextDay.month, nextDay.day, p.h, p.m, tz);
  }
  return candidate;
}

// Per-field resolution: user override → department → default. A slot is
// required — without one, no auto-clock-out happens for the user.
export function resolveSchedule(
  userShiftType: string | null | undefined,
  userSlot: string | null | undefined,
  deptShiftType: string | null | undefined,
  deptSlot: string | null | undefined,
): ResolvedSchedule {
  const slot = (userSlot && userSlot.trim()) || (deptSlot && deptSlot.trim()) || null;
  if (!slot || !parseHHMM(slot)) return null;
  const raw = (userShiftType && userShiftType.trim()) || (deptShiftType && deptShiftType.trim()) || "day";
  const shiftType: ShiftType = raw === "night" ? "night" : "day";
  return { shiftType, slot };
}

export function computeExpectedClockOut(clockIn: Date, slot: string, tz: string): Date | null {
  return nextOccurrenceOf(slot, clockIn, tz);
}
