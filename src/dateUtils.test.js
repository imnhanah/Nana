import test from "node:test";
import assert from "node:assert/strict";
import { localDateKey } from "./dateUtils.js";

test("localDateKey preserves the calendar date supplied by the local clock", () => {
  const localMidnight = { getFullYear: () => 2026, getMonth: () => 8, getDate: () => 28 };
  const localMonthStart = { getFullYear: () => 2027, getMonth: () => 0, getDate: () => 1 };
  assert.equal(localDateKey(localMidnight), "2026-09-28");
  assert.equal(localDateKey(localMonthStart), "2027-01-01");
});
