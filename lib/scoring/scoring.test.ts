import { describe, expect, it } from "vitest";
import { applyEloResult, kFactor } from "@/lib/scoring";

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
});
