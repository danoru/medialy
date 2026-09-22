import type { ScoredMediaItem } from "@/lib/scoring/types";
import { COMPARISON_RELEVANCE } from "@/lib/scoring/config";
import { clamp } from "@/lib/scoring/pairwise";
import {
  facetSimilarity,
  type FeatureRarity,
  type SimilarityItem,
} from "@/lib/scoring/similarity";

/**
 * How worthwhile it is to pit two titles against each other in /compare.
 * Alike titles (same director, subgenre, era, leads) make for a meaningful
 * head-to-head; so do titles the viewer rates about the same. The alikeness
 * half is the shared facet similarity from `lib/scoring/similarity.ts`.
 */
export function calculateComparisonRelevance(
  first: ScoredMediaItem,
  second: ScoredMediaItem,
  rarity: FeatureRarity = new Map(),
) {
  if (first.mediaType !== second.mediaType) return 0;

  const alike = facetSimilarity(
    toSimilarityItem(first),
    toSimilarityItem(second),
    rarity,
  ).score;
  const ratingScore = proximityScore(
    first.personalRating,
    second.personalRating,
    COMPARISON_RELEVANCE.ratingMaxDistance,
  );
  const pairwiseScore = proximityScore(
    first.pairwiseScore,
    second.pairwiseScore,
    COMPARISON_RELEVANCE.pairwiseMaxDistance,
  );

  return round(
    clamp(
      COMPARISON_RELEVANCE.base +
        alike * COMPARISON_RELEVANCE.similarity +
        ratingScore * COMPARISON_RELEVANCE.rating +
        pairwiseScore * COMPARISON_RELEVANCE.pairwise,
      0,
      1,
    ),
  );
}

function toSimilarityItem(item: ScoredMediaItem): SimilarityItem {
  return {
    genres: item.genres ?? [],
    tags: item.tags ?? [],
    credits: item.credits ?? [],
    releaseDate: item.releaseDate,
  };
}

export function relevanceToEloWeight(relevance: number) {
  const floor = COMPARISON_RELEVANCE.eloWeightFloor;
  return round(clamp(floor + relevance * (1 - floor), floor, 1));
}

function proximityScore(
  first: number | null | undefined,
  second: number | null | undefined,
  maxDistance: number,
) {
  if (first == null || second == null) return 0;
  return clamp(1 - Math.abs(first - second) / maxDistance, 0, 1);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
