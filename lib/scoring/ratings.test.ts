import { describe, expect, it } from "vitest";
import {
  calculateComparisonRelevance,
  relevanceToEloWeight,
} from "@/lib/scoring/comparisonRelevance";
import { calculateConsensusScore, normalizeExternalRating } from "./consensus";
import { calculateFriendCompatibility } from "./compatibility";
import { calculateMedialyMatch } from "./medialyMatch";
import { calculatePersonalScore } from "./personalScore";
import { calculateTaxonomySimilarity } from "./taxonomySimilarity";
import type { ScoredMediaItem } from "./types";

function media(overrides: Partial<ScoredMediaItem> = {}): ScoredMediaItem {
  return {
    mediaType: "MOVIE",
    personalRating: 8,
    pairwiseScore: 1000,
    comparisonCount: 0,
    releaseDate: new Date("2020-01-01T00:00:00.000Z"),
    genres: [{ genre: { name: "Drama" } }],
    ...overrides,
  };
}

describe("personal score", () => {
  it("keeps low-comparison scores close to the explicit rating", () => {
    const score = calculatePersonalScore({
      explicitRating: 9,
      pairwiseScore: 1000,
      comparisonCount: 0,
    });

    expect(score.score).toBeGreaterThan(8.5);
    expect(score.score).toBeLessThan(9);
  });

  it("uses pairwise fallback when explicit rating is missing", () => {
    const score = calculatePersonalScore({
      explicitRating: null,
      pairwiseScore: 1350,
      comparisonCount: 8,
    });

    expect(score.score).toBe(10);
    expect(score.confidence).toBeLessThan(1);
  });
});

describe("consensus score", () => {
  it("normalizes external ratings to ten points", () => {
    expect(
      normalizeExternalRating({ source: "METACRITIC", score: 84, scale: 100 }),
    ).toBe(8.4);
  });

  it("aggregates weighted external ratings", () => {
    const consensus = calculateConsensusScore([
      { source: "METACRITIC", score: 84, scale: 100 },
    ]);

    expect(consensus.score).toBe(8.4);
    expect(consensus.confidence).toBeGreaterThan(0);
  });
});

describe("comparison relevance", () => {
  it("blocks cross-media comparisons", () => {
    expect(
      calculateComparisonRelevance(
        media({ mediaType: "MOVIE" }),
        media({ mediaType: "VIDEO_GAME" }),
      ),
    ).toBe(0);
  });

  it("gives similar same-genre items stronger Elo weight", () => {
    const high = calculateComparisonRelevance(media(), media());
    const low = calculateComparisonRelevance(
      media(),
      media({
        personalRating: 4,
        pairwiseScore: 1350,
        releaseDate: new Date("1980-01-01T00:00:00.000Z"),
        genres: [{ genre: { name: "Comedy" } }],
      }),
    );

    expect(high).toBeGreaterThan(low);
    expect(relevanceToEloWeight(high)).toBeGreaterThan(
      relevanceToEloWeight(low),
    );
  });
});

describe("friend compatibility", () => {
  it("keeps the current distance-based compatibility behavior", () => {
    const compatibility = calculateFriendCompatibility([
      { userRating: 9, friendRating: 8 },
      { userRating: 7, friendRating: 7 },
    ]);

    expect(compatibility.overlapCount).toBe(2);
    expect(compatibility.compatibilityScore).toBe(94);
  });
});

describe("medialy match", () => {
  it("returns a bounded percentage and explainable reasons", () => {
    const match = calculateMedialyMatch({
      personalScore: 9,
      genreAffinity: 80,
      tagAffinity: 50,
      friendAffinity: 70,
      status: 100,
      upcoming: 0,
      consensusScore: 8,
    });

    expect(match.score).toBeGreaterThan(0);
    expect(match.score).toBeLessThanOrEqual(100);
    expect(match.reasons.length).toBeGreaterThan(0);
  });
});

describe("taxonomy similarity", () => {
  it("scores close taxonomy matches high", () => {
    const alien = {
      genres: ["Science Fiction", "Horror"],
      tags: ["Xenomorphs", "Space"],
    };
    const aliens = {
      genres: ["Science Fiction", "Horror", "Action"],
      tags: ["Xenomorphs", "Space Marines"],
    };

    expect(calculateTaxonomySimilarity(alien, aliens).score).toBeGreaterThan(
      50,
    );
  });

  it("keeps Aladdin and Aliens very low despite old broad adventure overlap", () => {
    const aladdin = {
      genres: ["Animation", "Fantasy", "Family"],
      tags: ["Musical", "Fairy Tale", "Disney", "Magic", "Comedy"],
    };
    const aliens = {
      genres: ["Science Fiction", "Horror", "Action"],
      tags: ["Space Marines", "Survival", "Monster", "Xenomorphs"],
    };

    expect(calculateTaxonomySimilarity(aladdin, aliens).score).toBeLessThan(10);
  });

  it("lets niche game tags supplement gameplay genre matches", () => {
    const hades = {
      genres: ["Action"],
      tags: ["Roguelike", "Mythology"],
    };
    const deadCells = {
      genres: ["Action", "Platformer"],
      tags: ["Roguelike", "Metroidvania"],
    };

    expect(calculateTaxonomySimilarity(hades, deadCells).score).toBeGreaterThan(
      30,
    );
  });
});
