import { describe, expect, it } from "vitest";
import { calculateCommunityAverage } from "@/lib/scoring/communityAverage";

describe("calculateCommunityAverage", () => {
  it("returns null score and zero raters when no input", () => {
    expect(calculateCommunityAverage([])).toEqual({ score: null, raterCount: 0 });
  });

  it("ignores users with null computedPersonalScore", () => {
    expect(
      calculateCommunityAverage([
        { computedPersonalScore: null },
        { computedPersonalScore: null },
      ]),
    ).toEqual({ score: null, raterCount: 0 });
  });

  it("returns the arithmetic mean rounded to one decimal", () => {
    expect(
      calculateCommunityAverage([
        { computedPersonalScore: 8 },
        { computedPersonalScore: 6 },
        { computedPersonalScore: 7.4 },
      ]),
    ).toEqual({ score: 7.1, raterCount: 3 });
  });

  it("counts only raters with a numeric score", () => {
    expect(
      calculateCommunityAverage([
        { computedPersonalScore: 9 },
        { computedPersonalScore: null },
        { computedPersonalScore: 5 },
      ]),
    ).toEqual({ score: 7, raterCount: 2 });
  });
});
