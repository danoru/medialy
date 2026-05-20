import { describe, expect, it } from "vitest";
import {
  isEligibleForRecommendation,
  personalScoreTrustForStatus,
  recommendationEligibilityWhere,
} from "@/lib/scoring/eligibility";

const base = {
  status: "UNTRACKED" as const,
  isArchived: false,
  releaseDate: null,
  mediaType: "MOVIE",
};

describe("eligibility", () => {
  it("excludes completed items by default", () => {
    const result = isEligibleForRecommendation({ ...base, status: "COMPLETED" });
    expect(result).toEqual({ eligible: false, reason: "already_completed" });
  });

  it("excludes in-progress items by default", () => {
    expect(
      isEligibleForRecommendation({ ...base, status: "IN_PROGRESS" }).eligible,
    ).toBe(false);
  });

  it("excludes dropped items by default", () => {
    expect(
      isEligibleForRecommendation({ ...base, status: "DROPPED" }).eligible,
    ).toBe(false);
  });

  it("excludes archived items unless opted in", () => {
    expect(
      isEligibleForRecommendation({ ...base, isArchived: true }).eligible,
    ).toBe(false);
    expect(
      isEligibleForRecommendation(
        { ...base, isArchived: true },
        { includeArchived: true },
      ).eligible,
    ).toBe(true);
  });

  it("excludes future releases by default and surfaces detail", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const result = isEligibleForRecommendation({
      ...base,
      releaseDate: future,
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toBe("not_yet_released");
      expect(result.detail).toBe(future.toISOString());
    }
  });

  it("includes future releases when opted into the Coming Soon lane", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    expect(
      isEligibleForRecommendation(
        { ...base, releaseDate: future },
        { includeUpcoming: true },
      ).eligible,
    ).toBe(true);
  });

  it("excludes items the user has already rated", () => {
    const result = isEligibleForRecommendation({ ...base, personalRating: 8 });
    expect(result).toEqual({ eligible: false, reason: "already_rated" });
  });

  it("includes rated items when opted in", () => {
    expect(
      isEligibleForRecommendation(
        { ...base, personalRating: 8 },
        { includeRated: true },
      ).eligible,
    ).toBe(true);
  });

  it("respects hidden media types", () => {
    expect(
      isEligibleForRecommendation(base, { hiddenMediaTypes: ["MOVIE"] })
        .eligible,
    ).toBe(false);
  });

  it("recommendationEligibilityWhere keeps both user-scope and release-date clauses", () => {
    // Regression: both halves used to be spread into the same object, and the
    // second `OR` silently overwrote the first — collapsing the filter to just
    // the release-date check and leaking COMPLETED/rated items into the pool.
    const where = recommendationEligibilityWhere({ userId: "u1" });
    expect(where.AND).toBeDefined();
    const clauses = JSON.stringify(where);
    expect(clauses).toContain("userMedia");
    expect(clauses).toContain("releaseDate");
    expect(clauses).toContain("personalRating");
    expect(clauses).toContain("notIn");
  });

  it("personalScoreTrust treats expected vs experienced differently", () => {
    expect(personalScoreTrustForStatus("COMPLETED", true)).toBe(1);
    expect(personalScoreTrustForStatus("WATCHLIST", true)).toBe(0.25);
    expect(personalScoreTrustForStatus("WATCHLIST", false)).toBe(0);
  });
});
