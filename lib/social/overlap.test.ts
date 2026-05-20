import { describe, expect, it } from "vitest";
import { getUserOverlap } from "./overlap";

describe("getUserOverlap", () => {
  it("returns a zeroed result when the viewer compares against themself", async () => {
    // Self-overlap is a structural short-circuit — no DB read should happen
    // here, which lets this test run under the lib node env with no Prisma
    // connection.
    const result = await getUserOverlap("user-1", "user-1");

    expect(result).toEqual({
      compatibilityScore: 0,
      overlapCount: 0,
      averageDistance: null,
      sharedCompletedCount: 0,
      watchNextTogether: [],
      topSharedGenres: [],
    });
  });
});
