import { describe, expect, it } from "vitest";
import { applyEloResult, kFactor } from "@/lib/scoring";
import {
  effectiveRating,
  expectedWinProbabilityFromPriors,
} from "@/lib/scoring/pairwise";

describe("pairwise scoring", () => {
  it("moves points from loser to winner", () => {
    const result = applyEloResult({
      winnerScore: 1000,
      loserScore: 1000,
      winnerComparisonCount: 0,
      loserComparisonCount: 0,
    });

    expect(result.winnerScore).toBeGreaterThan(1000);
    expect(result.loserScore).toBeLessThan(1000);
  });

  it("moves more points when an underdog wins", () => {
    const even = applyEloResult({
      winnerScore: 1000,
      loserScore: 1000,
      winnerComparisonCount: 0,
      loserComparisonCount: 0,
    });
    const upset = applyEloResult({
      winnerScore: 900,
      loserScore: 1200,
      winnerComparisonCount: 0,
      loserComparisonCount: 0,
    });

    expect(upset.winnerDelta).toBeGreaterThan(even.winnerDelta);
  });

  it("decreases k-factor as comparison count increases", () => {
    expect(kFactor(0)).toBeGreaterThan(kFactor(10));
    expect(kFactor(10)).toBeGreaterThan(kFactor(30));
  });

  it("returns the expected win probability used by applyEloResult", () => {
    const result = applyEloResult({
      winnerScore: 1000,
      loserScore: 1000,
      winnerComparisonCount: 0,
      loserComparisonCount: 0,
    });
    expect(result.expectedWinnerWinProb).toBeCloseTo(0.5, 2);
  });
});

describe("blended Elo prior", () => {
  it("collapses to pairwise-only when no rating or consensus is present", () => {
    const rating = effectiveRating({ pairwiseScore: 1000 });
    // 1000 (neutral) normalizes between 750-1250 to 50/100 → 5/10.
    expect(rating).toBeCloseTo(5, 1);
  });

  it("favors explicit rating over pairwise when both exist", () => {
    const lowRatedHighElo = effectiveRating({
      personalRating: 5,
      pairwiseScore: 1300,
    });
    const highRatedLowElo = effectiveRating({
      personalRating: 9,
      pairwiseScore: 900,
    });
    expect(highRatedLowElo).toBeGreaterThan(lowRatedHighElo);
  });

  it("treats a low-rated win over a high-rated item as an upset", () => {
    const expected = expectedWinProbabilityFromPriors(
      { personalRating: 6, pairwiseScore: 1000 },
      { personalRating: 10, pairwiseScore: 1000 },
    );
    // The 6-rated winner was expected to lose; probability < 0.5
    expect(expected).toBeLessThan(0.4);

    const upset = applyEloResult({
      winnerScore: 1000,
      loserScore: 1000,
      winnerComparisonCount: 0,
      loserComparisonCount: 0,
      expectedWinnerWinProb: expected,
    });
    const even = applyEloResult({
      winnerScore: 1000,
      loserScore: 1000,
      winnerComparisonCount: 0,
      loserComparisonCount: 0,
    });
    // The pure-Elo result expects 50/50, so this should swing harder.
    expect(upset.winnerDelta).toBeGreaterThan(even.winnerDelta);
  });
});
