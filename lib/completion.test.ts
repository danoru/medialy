import { describe, expect, it } from "vitest";
import {
  completionFromForm,
  completionPatchForStatus,
  parseCompletedAtInput,
  todayCalendarDate,
  type CompletionFields,
} from "./completion";

// A fixed "now" used across tests: local Sep 15, 2026, well after midnight,
// so any accidental local/UTC slip would show up as Sep 14 or Sep 16.
const now = new Date(2026, 8, 15, 12, 0);
const TODAY_ISO = "2026-09-15T00:00:00.000Z";

const noDate: CompletionFields = { completedAt: null, completedAtUnsure: false };

describe("todayCalendarDate", () => {
  it("returns UTC midnight of the local calendar date of `now`", () => {
    const result = todayCalendarDate(new Date(2026, 8, 15, 23, 30));
    expect(result.toISOString()).toBe(TODAY_ISO);
  });
});

describe("completionPatchForStatus", () => {
  it("stamps today when entering COMPLETED with no existing date or flag", () => {
    const patch = completionPatchForStatus("WATCHLIST", "COMPLETED", noDate, now);
    expect(patch).toEqual({
      completedAt: todayCalendarDate(now),
      completedAtUnsure: false,
    });
  });

  it("does nothing entering COMPLETED when a date already exists", () => {
    const existing: CompletionFields = {
      completedAt: new Date(Date.UTC(2026, 0, 1)),
      completedAtUnsure: false,
    };
    expect(completionPatchForStatus("WATCHLIST", "COMPLETED", existing, now)).toEqual({});
  });

  it("does nothing entering COMPLETED when completedAtUnsure is already true", () => {
    const existing: CompletionFields = { completedAt: null, completedAtUnsure: true };
    expect(completionPatchForStatus("WATCHLIST", "COMPLETED", existing, now)).toEqual({});
  });

  it("clears date and flag leaving COMPLETED for UNTRACKED when a date is set", () => {
    const existing: CompletionFields = {
      completedAt: new Date(Date.UTC(2026, 0, 1)),
      completedAtUnsure: false,
    };
    expect(completionPatchForStatus("COMPLETED", "UNTRACKED", existing, now)).toEqual({
      completedAt: null,
      completedAtUnsure: false,
    });
  });

  it("clears date and flag leaving COMPLETED for UNTRACKED when the unsure flag is set", () => {
    const existing: CompletionFields = { completedAt: null, completedAtUnsure: true };
    expect(completionPatchForStatus("COMPLETED", "UNTRACKED", existing, now)).toEqual({
      completedAt: null,
      completedAtUnsure: false,
    });
  });

  it("clears date and flag leaving COMPLETED for DROPPED when a date is set", () => {
    const existing: CompletionFields = {
      completedAt: new Date(Date.UTC(2026, 0, 1)),
      completedAtUnsure: false,
    };
    expect(completionPatchForStatus("COMPLETED", "DROPPED", existing, now)).toEqual({
      completedAt: null,
      completedAtUnsure: false,
    });
  });

  it("clears date and flag leaving COMPLETED for DROPPED when the unsure flag is set", () => {
    const existing: CompletionFields = { completedAt: null, completedAtUnsure: true };
    expect(completionPatchForStatus("COMPLETED", "DROPPED", existing, now)).toEqual({
      completedAt: null,
      completedAtUnsure: false,
    });
  });

  it("does nothing leaving COMPLETED when neither a date nor the flag is set", () => {
    expect(completionPatchForStatus("COMPLETED", "UNTRACKED", noDate, now)).toEqual({});
    expect(completionPatchForStatus("COMPLETED", "DROPPED", noDate, now)).toEqual({});
  });

  it("does nothing when staying COMPLETED", () => {
    const existing: CompletionFields = {
      completedAt: new Date(Date.UTC(2026, 0, 1)),
      completedAtUnsure: false,
    };
    expect(completionPatchForStatus("COMPLETED", "COMPLETED", existing, now)).toEqual({});
  });

  it("does nothing for a transition unrelated to COMPLETED", () => {
    expect(completionPatchForStatus("WATCHLIST", "IN_PROGRESS", noDate, now)).toEqual({});
  });
});

describe("parseCompletedAtInput", () => {
  it("treats null, undefined, and blank strings as null", () => {
    expect(parseCompletedAtInput(null, now)).toBeNull();
    expect(parseCompletedAtInput(undefined, now)).toBeNull();
    expect(parseCompletedAtInput("", now)).toBeNull();
    expect(parseCompletedAtInput("   ", now)).toBeNull();
  });

  it("parses a valid ISO date into UTC midnight of that day", () => {
    const parsed = parseCompletedAtInput("2026-09-01", now);
    expect(parsed?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("rejects an impossible calendar date", () => {
    expect(parseCompletedAtInput("2026-02-30", now)).toBeUndefined();
  });

  it("rejects a non-ISO format", () => {
    expect(parseCompletedAtInput("09/01/2026", now)).toBeUndefined();
  });

  it("rejects unparseable text", () => {
    expect(parseCompletedAtInput("not a date", now)).toBeUndefined();
  });

  it("rejects a date after today", () => {
    expect(parseCompletedAtInput("2026-09-16", now)).toBeUndefined();
  });

  it("accepts today itself", () => {
    const parsed = parseCompletedAtInput("2026-09-15", now);
    expect(parsed?.toISOString()).toBe(TODAY_ISO);
  });
});

describe("completionFromForm", () => {
  it("lets 'not sure' win even when a valid date is also provided", () => {
    expect(
      completionFromForm({ completedAt: "2026-09-01", unsure: true }, now),
    ).toEqual({ completedAt: null, completedAtUnsure: true });
  });

  it("accepts a valid date", () => {
    const result = completionFromForm({ completedAt: "2026-09-01", unsure: false }, now);
    expect(result).toEqual({
      completedAt: new Date(Date.UTC(2026, 8, 1)),
      completedAtUnsure: false,
    });
  });

  it("treats a blank date with no flag as undated", () => {
    expect(completionFromForm({ completedAt: "", unsure: false }, now)).toEqual({
      completedAt: null,
      completedAtUnsure: false,
    });
  });

  it("returns an error for an invalid date", () => {
    const result = completionFromForm({ completedAt: "not a date", unsure: false }, now);
    expect(result).toHaveProperty("error");
    expect(typeof (result as { error: string }).error).toBe("string");
  });

  it("returns an error for a future date", () => {
    const result = completionFromForm({ completedAt: "2026-09-16", unsure: false }, now);
    expect(result).toHaveProperty("error");
    expect(typeof (result as { error: string }).error).toBe("string");
  });
});
