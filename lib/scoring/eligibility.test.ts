import { describe, expect, it } from "vitest";
import {
  isEligibleForRecommendation,
  personalScoreTrustForStatus,
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

  it("respects hidden media types", () => {
    expect(
      isEligibleForRecommendation(base, { hiddenMediaTypes: ["MOVIE"] })
        .eligible,
    ).toBe(false);
  });

  it("personalScoreTrust treats expected vs experienced differently", () => {
    expect(personalScoreTrustForStatus("COMPLETED", true)).toBe(1);
    expect(personalScoreTrustForStatus("WATCHLIST", true)).toBe(0.25);
    expect(personalScoreTrustForStatus("WATCHLIST", false)).toBe(0);
  });
});
