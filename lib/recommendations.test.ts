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

  it("keeps paused and dropped items eligible but strongly deprioritized", () => {
    expect(isRecommendationEligibleStatus("PAUSED")).toBe(true);
    expect(isRecommendationEligibleStatus("DROPPED")).toBe(true);

    expect(recommendationStatusSignal("PAUSED")).toBeLessThan(
      recommendationStatusSignal("BACKLOG"),
    );
    expect(recommendationStatusSignal("DROPPED")).toBeLessThan(
      recommendationStatusSignal("PAUSED"),
    );
  });

  it("prioritizes unknown-to-you items above known queue items", () => {
    expect(recommendationStatusSignal("UNTRACKED")).toBeGreaterThan(
      recommendationStatusSignal("WATCHLIST"),
    );
    expect(recommendationStatusSignal("WATCHLIST")).toBeGreaterThan(
      recommendationStatusSignal("BACKLOG"),
    );
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
