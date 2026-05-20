import { describe, expect, it } from "vitest";
import {
  calculateComparisonRelevance,
  relevanceToEloWeight,
} from "@/lib/scoring/comparisonRelevance";
import { calculateConsensusScore, normalizeExternalRating } from "./consensus";
import { calculateRatingCompatibility } from "./compatibility";
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

  it("blends multiple sources by trust weight", () => {
    const consensus = calculateConsensusScore(
      [
        { source: "METACRITIC", score: 90, scale: 100 }, // weight 1.0
        { source: "ROTTEN_TOMATOES_AUDIENCE", score: 50, scale: 100 }, // weight 0.55
        { source: "IMDB", score: 70, scale: 100 }, // weight 0.6
      ],
      { mediaType: "MOVIE" },
    );
    expect(consensus.score).not.toBeNull();
    // High-trust Metacritic pulls the mean toward 9.
    expect(consensus.score!).toBeGreaterThan(7);
    expect(consensus.breakdown).toHaveLength(3);
  });

  it("drops sources that don't apply to the media type", () => {
    const consensus = calculateConsensusScore(
      [
        { source: "GOODREADS", score: 4.6, scale: 5 },
        { source: "METACRITIC", score: 88, scale: 100 },
      ],
      { mediaType: "VIDEO_GAME" },
    );
    // Goodreads excluded (BOOK-only), only Metacritic counts.
    expect(consensus.score).toBe(8.8);
    expect(
      consensus.breakdown.find((entry) => entry.source === "GOODREADS")!
        .applicable,
    ).toBe(false);
  });

  it("downweights outliers once we have enough sources", () => {
    const withOutlier = calculateConsensusScore([
      { source: "METACRITIC", score: 80, scale: 100 },
      { source: "IMDB", score: 82, scale: 100 },
      { source: "LETTERBOXD", score: 78, scale: 100 },
      { source: "TMDB", score: 30, scale: 100 }, // wild outlier
    ]);
    expect(withOutlier.score).not.toBeNull();
    // Without trimming, the mean would dip toward the outlier. With trimming
    // applied at N≥4, the score should remain in the 7s.
    expect(withOutlier.score!).toBeGreaterThan(7);
    const outlierEntry = withOutlier.breakdown.find(
      (entry) => entry.source === "TMDB",
    )!;
    expect(outlierEntry.outlierMultiplier).toBeLessThan(1);
  });

  it("decays stale fetches toward the recency floor", () => {
    const ancient = new Date(Date.now() - 1000 * 60 * 60 * 24 * 800); // ~2 years
    const recent = calculateConsensusScore([
      { source: "METACRITIC", score: 80, scale: 100 },
    ]);
    const stale = calculateConsensusScore([
      { source: "METACRITIC", score: 80, scale: 100, fetchedAt: ancient },
    ]);
    expect(stale.confidence).toBeLessThan(recent.confidence);
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

describe("rating compatibility", () => {
  it("keeps the current distance-based compatibility behavior", () => {
    const compatibility = calculateRatingCompatibility([
      { viewerRating: 9, otherRating: 8 },
      { viewerRating: 7, otherRating: 7 },
    ]);

    expect(compatibility.overlapCount).toBe(2);
    expect(compatibility.compatibilityScore).toBe(94);
  });
});

describe("medialy match (taste-only)", () => {
  it("returns a bounded percentage with one explanation per signal", () => {
    const match = calculateMedialyMatch({
      personalScore: 9,
      personalScoreTrust: 1,
      genreAffinity: 80,
      tagAffinity: 50,
      friendAffinity: 70,
      contributorAffinity: 40,
      consensusScore: 8,
    });

    expect(match.score).toBeGreaterThan(0);
    expect(match.score).toBeLessThanOrEqual(100);
    expect(match.explanations).toHaveLength(6);
    expect(match.explanations.every((e) => e.weight > 0 && e.weight <= 1)).toBe(
      true,
    );
  });

  it("dampens personal score for unfinished recommendation candidates", () => {
    const completedTrust = calculateMedialyMatch({
      personalScore: 9,
      personalScoreTrust: 1,
      genreAffinity: 0,
      tagAffinity: 0,
      friendAffinity: 0,
      consensusScore: null,
    });
    const queueTrust = calculateMedialyMatch({
      personalScore: 9,
      personalScoreTrust: 0.25,
      genreAffinity: 0,
      tagAffinity: 0,
      friendAffinity: 0,
      consensusScore: null,
    });

    expect(queueTrust.score).toBeLessThan(completedTrust.score);
  });

  it("uses consensus and friend signals to lift unknown items", () => {
    const weakUnknown = calculateMedialyMatch({
      personalScore: null,
      personalScoreTrust: 0,
      genreAffinity: 0,
      tagAffinity: 0,
      friendAffinity: 0,
      consensusScore: null,
    });
    const supportedUnknown = calculateMedialyMatch({
      personalScore: null,
      personalScoreTrust: 0,
      genreAffinity: 0,
      tagAffinity: 0,
      friendAffinity: 80,
      consensusScore: 9,
    });

    expect(supportedUnknown.score).toBeGreaterThan(weakUnknown.score);
  });

  it("each explanation includes weight, raw value, and contribution", () => {
    const match = calculateMedialyMatch({
      personalScore: 8,
      personalScoreTrust: 1,
      genreAffinity: 50,
      tagAffinity: 0,
      friendAffinity: 0,
      consensusScore: null,
    });

    const personal = match.explanations.find(
      (e) => e.signal === "personalScore",
    );
    expect(personal).toBeDefined();
    expect(personal!.rawValue).toBe(80);
    expect(personal!.contribution).toBe(Math.round(80 * personal!.weight));
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
