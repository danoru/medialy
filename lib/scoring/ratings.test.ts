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
import { bayesianShrunkMean, saturate, shrunkContribution } from "./affinity";
import { AFFINITY_TUNING } from "./config";
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
      genreAffinity: 80,
      tagAffinity: 50,
      friendAffinity: 70,
      contributorAffinity: 40,
      consensusScore: 8,
    });

    expect(match.score).toBeGreaterThan(0);
    expect(match.score).toBeLessThanOrEqual(100);
    expect(match.explanations).toHaveLength(5);
    expect(match.explanations.every((e) => e.weight > 0 && e.weight <= 1)).toBe(
      true,
    );
  });

  it("can reach 100% when every taste signal is maxed out", () => {
    const match = calculateMedialyMatch({
      genreAffinity: 100,
      tagAffinity: 100,
      friendAffinity: 100,
      contributorAffinity: 100,
      consensusScore: 10,
    });
    expect(match.score).toBe(100);
  });

  it("uses consensus and friend signals to lift unknown items", () => {
    const weakUnknown = calculateMedialyMatch({
      genreAffinity: 0,
      tagAffinity: 0,
      friendAffinity: 0,
      contributorAffinity: 0,
      consensusScore: null,
    });
    const supportedUnknown = calculateMedialyMatch({
      genreAffinity: 0,
      tagAffinity: 0,
      friendAffinity: 80,
      contributorAffinity: 0,
      consensusScore: 9,
    });

    expect(supportedUnknown.score).toBeGreaterThan(weakUnknown.score);
  });

  it("each explanation includes weight, raw value, and contribution", () => {
    const match = calculateMedialyMatch({
      genreAffinity: 50,
      tagAffinity: 0,
      friendAffinity: 0,
      contributorAffinity: 0,
      consensusScore: null,
    });

    const genre = match.explanations.find((e) => e.signal === "genreAffinity");
    expect(genre).toBeDefined();
    expect(genre!.rawValue).toBe(50);
    expect(genre!.contribution).toBe(Math.round(50 * genre!.weight));
  });
});

describe("affinity shrinkage + saturation", () => {
  const globalMean = 7.5;

  it("returns zero for never-rated features", () => {
    expect(shrunkContribution(undefined, globalMean)).toBe(0);
    expect(shrunkContribution({ sum: 0, count: 0 }, globalMean)).toBe(0);
  });

  it("floors disliked features at zero (no active demotion)", () => {
    const horror = shrunkContribution({ sum: 32, count: 8 }, globalMean); // mean 4
    expect(horror).toBe(0);
  });

  it("rewards small-sample-but-loved over large-sample-mediocre", () => {
    // 2 cyberpunk items both rated 9.5 vs 30 action items averaging just above
    // globalMean. Shrinkage pulls cyberpunk down, but action barely lifts above
    // the pivot, so the loved niche feature still wins.
    const cyberpunk = shrunkContribution({ sum: 19, count: 2 }, globalMean);
    const action = shrunkContribution({ sum: 7.6 * 30, count: 30 }, globalMean);
    expect(cyberpunk).toBeGreaterThan(action);
  });

  it("but shrinkage prevents a single 10/10 from dominating", () => {
    // A single 10/10 should NOT outscore a 30-item bucket averaging 8.3.
    const lucky = shrunkContribution({ sum: 10, count: 1 }, globalMean);
    const drama = shrunkContribution({ sum: 8.3 * 30, count: 30 }, globalMean);
    expect(drama).toBeGreaterThan(lucky);
  });

  it("shrinks small samples more aggressively than large ones", () => {
    // Same mean (9), different sample sizes — shrinkage compresses the small one.
    const tiny = shrunkContribution({ sum: 18, count: 2 }, globalMean);
    const huge = shrunkContribution({ sum: 9 * 50, count: 50 }, globalMean);
    expect(huge).toBeGreaterThan(tiny);
  });

  it("respects the shrinkageK / neutralPivot / scale config", () => {
    // With shrinkageK=5 and globalMean=7.5, a single rating of 10 shrinks to
    // (10 + 5*7.5) / (1 + 5) = 47.5/6 ≈ 7.917. (7.917 − 6.5) * 30 ≈ 42.5.
    const single = shrunkContribution({ sum: 10, count: 1 }, globalMean);
    const expected =
      ((10 + AFFINITY_TUNING.shrinkageK * globalMean) /
        (1 + AFFINITY_TUNING.shrinkageK) -
        AFFINITY_TUNING.neutralPivot) *
      AFFINITY_TUNING.scale;
    expect(single).toBeCloseTo(expected, 5);
  });
});

describe("affinity saturation", () => {
  it("returns zero for non-positive input", () => {
    expect(saturate(0, 60)).toBe(0);
    expect(saturate(-50, 60)).toBe(0);
  });

  it("approaches 100 asymptotically without ever reaching it", () => {
    expect(saturate(10_000, 60)).toBeGreaterThan(99);
    expect(saturate(10_000, 60)).toBeLessThan(100);
  });

  it("maps raw=k to exactly 50 (the half-saturation point)", () => {
    expect(saturate(60, 60)).toBe(50);
    expect(saturate(30, 30)).toBe(50);
  });

  it("compounding: two-feature match beats one-feature match", () => {
    // Single popular genre: lots of mass into one bucket.
    const onePopular = saturate(180, 60);
    // Two niche genres summed: less per-genre, but compounding.
    const twoNiche = saturate(60 + 60, 60);
    // One genre raw=180 still wins (it's a stronger absolute match).
    expect(onePopular).toBeGreaterThan(twoNiche);
    // But two strong genres outscore one strong genre of equal individual weight.
    expect(saturate(60 + 60, 60)).toBeGreaterThan(saturate(60, 60));
  });
});

describe("bayesian shrunk mean", () => {
  const prior = 7.5;

  it("returns the prior when evidence is zero", () => {
    expect(bayesianShrunkMean(10, 0, prior, 3)).toBe(prior);
  });

  it("pulls a 1-vote 10/10 sharply toward the prior", () => {
    // (1*10 + 3*7.5)/(1+3) = 32.5/4 = 8.125
    expect(bayesianShrunkMean(10, 1, prior, 3)).toBeCloseTo(8.125, 5);
  });

  it("barely moves a high-evidence observation", () => {
    const shrunk = bayesianShrunkMean(9, 100, prior, 3);
    expect(shrunk).toBeGreaterThan(8.95);
    expect(shrunk).toBeLessThan(9);
  });

  it("ranks broad-evidence items above thin-evidence outliers", () => {
    // 1 user rating 10 vs 5 users averaging 9 with prior 7.5, k=3.
    const thin = bayesianShrunkMean(10, 1, prior, 3); // ~8.13
    const broad = bayesianShrunkMean(9, 5, prior, 3); // (45+22.5)/8 = 8.44
    expect(broad).toBeGreaterThan(thin);
  });

  it("symmetric: pulls low observations up toward the prior too", () => {
    // 1 vote of 2 → (2 + 22.5)/4 = 6.125, well above the raw 2.
    expect(bayesianShrunkMean(2, 1, prior, 3)).toBeCloseTo(6.125, 5);
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
