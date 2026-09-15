import { describe, expect, it } from "vitest";
import {
  calendarDateToLocal,
  calendarIsoDate,
  calendarMonthKey,
  compactDateLabel,
  formatCalendarDate,
  releaseYearLabel,
} from "./date-labels";

// A release entered as "2026-09-18" is stored as UTC midnight. Every helper
// must render 9/18 even when the process runs west of UTC.
const stored = new Date("2026-09-18");

describe("calendar date helpers", () => {
  it("reads the UTC calendar date, not the local one", () => {
    expect(calendarIsoDate(stored)).toBe("2026-09-18");
    expect(calendarMonthKey(stored)).toBe("2026-09");
    expect(releaseYearLabel(stored)).toBe("2026");
    expect(compactDateLabel(stored)).toBe("Sep 18");
    expect(formatCalendarDate(stored, undefined, "en-US")).toBe("9/18/2026");
  });

  it("re-expresses the stored date as local midnight", () => {
    const local = calendarDateToLocal(stored);
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(8);
    expect(local.getDate()).toBe(18);
    expect(local.getHours()).toBe(0);
  });

  it("handles a New Year's Eve release", () => {
    expect(calendarIsoDate("2026-12-31")).toBe("2026-12-31");
    expect(releaseYearLabel("2026-12-31")).toBe("2026");
  });

  it("returns null/placeholder for invalid input", () => {
    expect(releaseYearLabel(null)).toBeNull();
    expect(compactDateLabel("nope")).toBe("-");
    expect(formatCalendarDate(undefined)).toBeNull();
  });
});
