import { describe, expect, it } from "vitest";
import {
  getRecommendationReleaseDateWhere,
  isRecommendationEligibleStatus,
  recommendationPersonalScoreTrust,
  recommendationStatusSignal,
} from "@/lib/recommendations";

describe("recommendation status policy", () => {
  it("excludes statuses that represent already active or finished media", () => {
    expect(isRecommendationEligibleStatus("IN_PROGRESS")).toBe(false);
    expect(isRecommendationEligibleStatus("COMPLETED")).toBe(false);
  });

  it("keeps paused items eligible but excludes dropped ones by default", () => {
    expect(isRecommendationEligibleStatus("PAUSED")).toBe(true);
    expect(isRecommendationEligibleStatus("DROPPED")).toBe(false);
  });

  it("treats status as a binary eligibility filter, not a continuous score signal", () => {
    // recommendationStatusSignal is a deprecated shim — every status returns 0
    // so callers can't accidentally bias rankings while migrating.
    expect(recommendationStatusSignal("UNTRACKED")).toBe(0);
    expect(recommendationStatusSignal("WATCHLIST")).toBe(0);
    expect(recommendationStatusSignal("BACKLOG")).toBe(0);
  });

  it("trusts incomplete personal scores less than completed scores", () => {
    expect(recommendationPersonalScoreTrust("COMPLETED", true)).toBe(1);
    expect(recommendationPersonalScoreTrust("IN_PROGRESS", true)).toBeLessThan(
      1,
    );
    expect(recommendationPersonalScoreTrust("PAUSED", true)).toBeLessThan(
      recommendationPersonalScoreTrust("IN_PROGRESS", true),
    );
    expect(recommendationPersonalScoreTrust("DROPPED", true)).toBeLessThan(
      recommendationPersonalScoreTrust("PAUSED", true),
    );
  });

  it("does not treat queue status as a direct personal-rating signal without an explicit rating", () => {
    expect(recommendationPersonalScoreTrust("UNTRACKED", false)).toBe(0);
    expect(recommendationPersonalScoreTrust("WATCHLIST", false)).toBe(0);
    expect(recommendationPersonalScoreTrust("BACKLOG", false)).toBe(0);
    expect(recommendationPersonalScoreTrust("WATCHLIST", true)).toBeGreaterThan(
      0,
    );
  });
});

describe("recommendation availability policy", () => {
  it("only includes items with no date or a release date before tomorrow", () => {
    const tomorrow = new Date(2026, 4, 15);

    expect(
      getRecommendationReleaseDateWhere(new Date(2026, 4, 14, 15, 30)),
    ).toEqual({
      OR: [{ releaseDate: null }, { releaseDate: { lt: tomorrow } }],
    });
  });
});
