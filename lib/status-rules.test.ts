import { describe, expect, it } from "vitest";
import { statusAfterRating } from "@/lib/status-rules";

describe("statusAfterRating", () => {
  it("promotes not-yet-started statuses to COMPLETED", () => {
    expect(statusAfterRating("UNTRACKED")).toBe("COMPLETED");
    expect(statusAfterRating("WATCHLIST")).toBe("COMPLETED");
    expect(statusAfterRating("BACKLOG")).toBe("COMPLETED");
  });

  it("leaves a show you're part-way through alone", () => {
    // The whole point of the rule: rating episode 3 of a series must not
    // silently mark the series finished.
    expect(statusAfterRating("IN_PROGRESS")).toBeNull();
    expect(statusAfterRating("PAUSED")).toBeNull();
  });

  it("leaves other deliberate choices alone", () => {
    expect(statusAfterRating("DROPPED")).toBeNull();
    expect(statusAfterRating("NOT_INTERESTED")).toBeNull();
  });

  it("is a no-op for something already completed", () => {
    expect(statusAfterRating("COMPLETED")).toBeNull();
  });
});
