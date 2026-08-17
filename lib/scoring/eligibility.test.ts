import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXCLUDED_STATUSES,
  isEligibleForRecommendation,
  matchesRecommendationEligibility,
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

  describe("matchesRecommendationEligibility", () => {
    // The in-memory filter stands in for the SQL one whenever the catalog is
    // read through the shared cached fetch, so it has to agree with it clause
    // for clause. These pin the equivalences the query builder encodes.
    const merged = {
      status: "UNTRACKED" as const,
      isArchived: false,
      personalRating: null as number | null,
      releaseDate: null as Date | null,
    };

    it("admits an untouched item (the SQL `userMedia: none` branch)", () => {
      expect(
        matchesRecommendationEligibility(merged, { userId: "u1" }),
      ).toBe(true);
    });

    it("excludes each default-excluded status", () => {
      for (const status of DEFAULT_EXCLUDED_STATUSES) {
        expect(
          matchesRecommendationEligibility(
            { ...merged, status },
            { userId: "u1" },
          ),
        ).toBe(false);
      }
    });

    it("honours the per-status opt-ins, but never for NOT_INTERESTED", () => {
      expect(
        matchesRecommendationEligibility(
          { ...merged, status: "COMPLETED" },
          { userId: "u1", includeCompleted: true },
        ),
      ).toBe(true);
      expect(
        matchesRecommendationEligibility(
          { ...merged, status: "NOT_INTERESTED" },
          {
            userId: "u1",
            includeCompleted: true,
            includeInProgress: true,
            includeDropped: true,
          },
        ),
      ).toBe(false);
    });

    it("excludes archived and already-rated items unless opted in", () => {
      expect(
        matchesRecommendationEligibility(
          { ...merged, isArchived: true },
          { userId: "u1" },
        ),
      ).toBe(false);
      expect(
        matchesRecommendationEligibility(
          { ...merged, personalRating: 7 },
          { userId: "u1" },
        ),
      ).toBe(false);
      expect(
        matchesRecommendationEligibility(
          { ...merged, personalRating: 7 },
          { userId: "u1", includeRated: true },
        ),
      ).toBe(true);
    });

    it("uses the query's date boundary: today in, tomorrow out", () => {
      // `startOfToday` works in local time, so build the fixtures the same way
      // rather than in UTC — otherwise this passes or fails by timezone.
      const now = new Date(2026, 7, 17, 12, 0);
      const laterToday = new Date(2026, 7, 17, 23, 0);
      const tomorrow = new Date(2026, 7, 18, 0, 30);

      // Released later the same day — the SQL filter admits this (it compares
      // against the start of tomorrow), so this one must too.
      expect(
        matchesRecommendationEligibility(
          { ...merged, releaseDate: laterToday },
          { userId: "u1", now },
        ),
      ).toBe(true);
      expect(
        matchesRecommendationEligibility(
          { ...merged, releaseDate: tomorrow },
          { userId: "u1", now },
        ),
      ).toBe(false);
      expect(
        matchesRecommendationEligibility(
          { ...merged, releaseDate: tomorrow },
          { userId: "u1", now, includeUpcoming: true },
        ),
      ).toBe(true);
    });

    it("applies only the date rule when no user is given", () => {
      const now = new Date("2026-08-17T12:00:00.000Z");
      expect(
        matchesRecommendationEligibility(
          { ...merged, status: "COMPLETED", isArchived: true, personalRating: 9 },
          { now },
        ),
      ).toBe(true);
    });

    it("accepts ISO strings, as cached catalog rows carry", () => {
      const now = new Date(2026, 7, 17, 12, 0);
      const tomorrow = new Date(2026, 7, 18, 0, 30);
      expect(
        matchesRecommendationEligibility(
          { ...merged, releaseDate: tomorrow.toISOString() },
          { userId: "u1", now },
        ),
      ).toBe(false);
    });
  });

  it("personalScoreTrust treats expected vs experienced differently", () => {
    expect(personalScoreTrustForStatus("COMPLETED", true)).toBe(1);
    expect(personalScoreTrustForStatus("WATCHLIST", true)).toBe(0.25);
    expect(personalScoreTrustForStatus("WATCHLIST", false)).toBe(0);
  });
});
