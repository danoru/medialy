import { describe, expect, it } from "vitest";
import {
  computeFriendSignal,
  followerOpinion,
  followerWeight,
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

describe("friend signal", () => {
  const rated = (userId: string, rating: number | null, status = "COMPLETED") => ({
    userId,
    rating,
    status,
  });
  const trust = (entries: Array<[string, number, number]>) =>
    new Map(
      entries.map(([userId, compatibility, overlap]) => [
        userId,
        { compatibility, overlap },
      ]),
    );

  it("lets a fully trusted friend who loved the title reach the top of the 0–100 range", () => {
    const { value } = computeFriendSignal(
      [rated("a", 10)],
      trust([["a", 100, 100]]),
    );
    // weight ≈ 0.95 after overlap shrinkage, evidence ≈ 0.49 with one friend.
    expect(value).toBeGreaterThan(45);
    expect(followerOpinion(rated("a", 10))).toBe(100);
  });

  it("does not let compatibility cancel out when only one friend contributes", () => {
    const aligned = computeFriendSignal(
      [rated("a", 9)],
      trust([["a", 100, 40]]),
    ).value;
    const mismatched = computeFriendSignal(
      [rated("a", 9)],
      trust([["a", 20, 40]]),
    ).value;
    expect(aligned).toBeGreaterThan(mismatched * 1.5);
  });

  it("shrinks compatibility toward neutral when there is little shared history", () => {
    // 100% compatibility on one shared title is worth far less than on twenty.
    expect(followerWeight({ compatibility: 100, overlap: 1 })).toBeLessThan(
      0.6,
    );
    expect(followerWeight({ compatibility: 100, overlap: 20 })).toBeGreaterThan(
      0.85,
    );
    expect(followerWeight(undefined)).toBe(0.5);
  });

  it("treats finishing or watchlisting without a rating as weak interest, never as a rating", () => {
    expect(followerOpinion(rated("a", null, "COMPLETED"))).toBeLessThan(20);
    expect(followerOpinion(rated("a", null, "WATCHLIST"))).toBeLessThan(
      followerOpinion(rated("a", null, "COMPLETED")),
    );
    expect(followerOpinion(rated("a", null, "UNTRACKED"))).toBe(0);
    // A rating stands alone; completion is not stacked on top of it.
    expect(followerOpinion(rated("a", 7, "COMPLETED"))).toBe(40);
  });

  it("treats a rating at the neutral point or below as no endorsement", () => {
    expect(followerOpinion(rated("a", 5))).toBe(0);
    expect(followerOpinion(rated("a", 3))).toBe(0);
  });

  it("grows with more agreeing friends rather than averaging them away", () => {
    const one = computeFriendSignal(
      [rated("a", 9)],
      trust([["a", 90, 20]]),
    ).value;
    const three = computeFriendSignal(
      [rated("a", 9), rated("b", 9), rated("c", 9)],
      trust([
        ["a", 90, 20],
        ["b", 90, 20],
        ["c", 90, 20],
      ]),
    ).value;
    expect(three).toBeGreaterThan(one);
    expect(three).toBeLessThanOrEqual(100);
  });
});
