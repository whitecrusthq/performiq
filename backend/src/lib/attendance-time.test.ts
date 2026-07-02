import { test } from "node:test";
import assert from "node:assert/strict";

import {
  resolveSchedule,
  computeExpectedClockOut,
  nextOccurrenceOf,
  DEFAULT_TZ,
} from "./attendance-time.js";

const LAGOS = "Africa/Lagos"; // UTC+1, no DST
const UTC = "UTC";

// ---------------------------------------------------------------------------
// resolveSchedule: precedence chain (per-user override → department → none)
// ---------------------------------------------------------------------------

test("resolveSchedule: per-user override beats department for both slot and shift", () => {
  const r = resolveSchedule("night", "07:30", "day", "17:00");
  assert.deepEqual(r, { shiftType: "night", slot: "07:30" });
});

test("resolveSchedule: per-user slot overrides department slot even when shift comes from department", () => {
  const r = resolveSchedule(null, "18:00", "day", "17:00");
  assert.deepEqual(r, { shiftType: "day", slot: "18:00" });
});

test("resolveSchedule: department values used when user is unset", () => {
  const r = resolveSchedule(null, null, "night", "08:30");
  assert.deepEqual(r, { shiftType: "night", slot: "08:30" });
});

test("resolveSchedule: department slot with unset shift defaults to day", () => {
  const r = resolveSchedule(null, null, null, "17:00");
  assert.deepEqual(r, { shiftType: "day", slot: "17:00" });
});

test("resolveSchedule: no slot from user or department → null (no auto-clock-out)", () => {
  assert.equal(resolveSchedule(null, null, null, null), null);
  assert.equal(resolveSchedule("night", null, "day", null), null);
  assert.equal(resolveSchedule(undefined, undefined, undefined, undefined), null);
});

test("resolveSchedule: blank/whitespace slots are treated as unset", () => {
  assert.equal(resolveSchedule(null, "   ", null, ""), null);
  // user slot blank → falls back to department slot
  assert.deepEqual(resolveSchedule(null, "  ", "day", "17:00"), {
    shiftType: "day",
    slot: "17:00",
  });
});

test("resolveSchedule: invalid slot string → null", () => {
  assert.equal(resolveSchedule(null, "25:00", null, null), null);
  assert.equal(resolveSchedule(null, "noon", null, null), null);
});

test("resolveSchedule: any shift value other than 'night' normalizes to 'day'", () => {
  assert.deepEqual(resolveSchedule("weird", "17:00", null, null), {
    shiftType: "day",
    slot: "17:00",
  });
});

// ---------------------------------------------------------------------------
// computeExpectedClockOut: day shift (same-day rule)
// ---------------------------------------------------------------------------

test("day shift: slot resolves to the same calendar day (UTC)", () => {
  // Clock in 2024-03-10 09:00 UTC, slot 17:00 → 2024-03-10 17:00 UTC
  const clockIn = new Date("2024-03-10T09:00:00Z");
  const exp = computeExpectedClockOut(clockIn, "17:00", UTC, "day");
  assert.equal(exp?.toISOString(), "2024-03-10T17:00:00.000Z");
});

test("day shift: slot already passed at clock-in resolves to the past (anti-gaming)", () => {
  // Clock in 2024-03-10 19:00 UTC, slot 17:00 → 2024-03-10 17:00 UTC (before clock-in)
  const clockIn = new Date("2024-03-10T19:00:00Z");
  const exp = computeExpectedClockOut(clockIn, "17:00", UTC, "day");
  assert.equal(exp?.toISOString(), "2024-03-10T17:00:00.000Z");
  assert.ok(exp!.getTime() < clockIn.getTime());
});

// ---------------------------------------------------------------------------
// computeExpectedClockOut: night shift (next-morning rule)
// ---------------------------------------------------------------------------

test("night shift: evening clock-in resolves to the NEXT morning (UTC)", () => {
  // Clock in 2024-03-10 22:00 UTC, morning slot 07:30 → 2024-03-11 07:30 UTC
  const clockIn = new Date("2024-03-10T22:00:00Z");
  const exp = computeExpectedClockOut(clockIn, "07:30", UTC, "night");
  assert.equal(exp?.toISOString(), "2024-03-11T07:30:00.000Z");
});

test("night shift: early pre-slot morning clock-in resolves to the SAME morning (UTC)", () => {
  // Clock in 2024-03-11 05:00 UTC, morning slot 07:30 → 2024-03-11 07:30 UTC
  const clockIn = new Date("2024-03-11T05:00:00Z");
  const exp = computeExpectedClockOut(clockIn, "07:30", UTC, "night");
  assert.equal(exp?.toISOString(), "2024-03-11T07:30:00.000Z");
});

// ---------------------------------------------------------------------------
// Non-UTC timezone (Africa/Lagos, UTC+1) boundary behavior
// ---------------------------------------------------------------------------

test("Africa/Lagos day shift: wall-clock slot converts to UTC minus 1h", () => {
  // Clock in 2024-03-10 09:00 WAT (= 08:00 UTC), slot 17:00 WAT → 16:00 UTC
  const clockIn = new Date("2024-03-10T08:00:00Z");
  const exp = computeExpectedClockOut(clockIn, "17:00", LAGOS, "day");
  assert.equal(exp?.toISOString(), "2024-03-10T16:00:00.000Z");
});

test("Africa/Lagos night shift: evening clock-in lands on the next morning slot in WAT", () => {
  // Clock in 2024-03-10 22:00 WAT (= 21:00 UTC), morning slot 07:30 WAT
  // → next morning 2024-03-11 07:30 WAT = 06:30 UTC
  const clockIn = new Date("2024-03-10T21:00:00Z");
  const exp = computeExpectedClockOut(clockIn, "07:30", LAGOS, "night");
  assert.equal(exp?.toISOString(), "2024-03-11T06:30:00.000Z");
});

test("Africa/Lagos night shift: clock-in just before local midnight crosses day AND month correctly", () => {
  // Clock in 2024-06-30 23:59 WAT (= 22:59 UTC on 2024-06-30), morning slot 07:30 WAT
  // → next morning 2024-07-01 07:30 WAT = 06:30 UTC on 2024-07-01
  const clockIn = new Date("2024-06-30T22:59:00Z");
  const exp = computeExpectedClockOut(clockIn, "07:30", LAGOS, "night");
  assert.equal(exp?.toISOString(), "2024-07-01T06:30:00.000Z");
});

test("Africa/Lagos night shift: pre-slot early morning (in WAT) stays the same morning", () => {
  // Clock in 2024-03-11 05:00 WAT (= 04:00 UTC), morning slot 07:30 WAT
  // → same morning 2024-03-11 07:30 WAT = 06:30 UTC
  const clockIn = new Date("2024-03-11T04:00:00Z");
  const exp = computeExpectedClockOut(clockIn, "07:30", LAGOS, "night");
  assert.equal(exp?.toISOString(), "2024-03-11T06:30:00.000Z");
});

test("timezone matters: same wall clock and instant yields different UTC across zones", () => {
  const clockIn = new Date("2024-03-10T08:00:00Z");
  const inUtc = computeExpectedClockOut(clockIn, "17:00", UTC, "day");
  const inLagos = computeExpectedClockOut(clockIn, "17:00", LAGOS, "day");
  // Lagos 17:00 (16:00 UTC) is one hour earlier in UTC than UTC 17:00.
  assert.equal(inUtc!.getTime() - inLagos!.getTime(), 60 * 60 * 1000);
});

// ---------------------------------------------------------------------------
// nextOccurrenceOf: direct coverage of the boundary helper
// ---------------------------------------------------------------------------

test("nextOccurrenceOf: at-or-after semantics — exact slot instant returns that instant", () => {
  // 'after' exactly at 07:30 WAT (06:30 UTC) → returns that same instant (not next day)
  const after = new Date("2024-03-11T06:30:00Z");
  const occ = nextOccurrenceOf("07:30", after, LAGOS);
  assert.equal(occ?.toISOString(), "2024-03-11T06:30:00.000Z");
});

test("nextOccurrenceOf: one second past the slot rolls to the next day", () => {
  const after = new Date("2024-03-11T06:30:01Z");
  const occ = nextOccurrenceOf("07:30", after, LAGOS);
  assert.equal(occ?.toISOString(), "2024-03-12T06:30:00.000Z");
});

test("nextOccurrenceOf: invalid slot returns null", () => {
  assert.equal(nextOccurrenceOf("bogus", new Date(), LAGOS), null);
});

// ---------------------------------------------------------------------------
// Guard rails
// ---------------------------------------------------------------------------

test("computeExpectedClockOut: invalid slot returns null for both shifts", () => {
  const clockIn = new Date("2024-03-10T09:00:00Z");
  assert.equal(computeExpectedClockOut(clockIn, "99:99", UTC, "day"), null);
  assert.equal(computeExpectedClockOut(clockIn, "99:99", UTC, "night"), null);
});

test("DEFAULT_TZ is Africa/Lagos", () => {
  assert.equal(DEFAULT_TZ, LAGOS);
});
