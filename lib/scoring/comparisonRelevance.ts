import type { ScoredMediaItem } from "@/lib/scoring/types";
import { COMPARISON_RELEVANCE } from "@/lib/scoring/config";
import { clamp } from "@/lib/scoring/pairwise";

export function calculateComparisonRelevance(
  first: ScoredMediaItem,
  second: ScoredMediaItem,
) {
  if (first.mediaType !== second.mediaType) return 0;

  const genreScore = genreOverlapScore(first, second);
  const tagScore = tagOverlapScore(first, second);
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
  const yearScore = proximityScore(
    yearFromDate(first.releaseDate),
    yearFromDate(second.releaseDate),
    COMPARISON_RELEVANCE.yearMaxDistance,
  );

  return round(
    clamp(
      COMPARISON_RELEVANCE.base +
        genreScore * COMPARISON_RELEVANCE.genre +
        tagScore * COMPARISON_RELEVANCE.tag +
        ratingScore * COMPARISON_RELEVANCE.rating +
        pairwiseScore * COMPARISON_RELEVANCE.pairwise +
        yearScore * COMPARISON_RELEVANCE.year,
      0,
      1,
    ),
  );
}

function tagOverlapScore(first: ScoredMediaItem, second: ScoredMediaItem) {
  const firstTags = new Set((first.tags ?? []).map((entry) => entry.tag.name));
  const secondTags = new Set(
    (second.tags ?? []).map((entry) => entry.tag.name),
  );
  if (firstTags.size === 0 || secondTags.size === 0) return 0;
  const shared = [...firstTags].filter((name) => secondTags.has(name)).length;
  return shared / Math.max(firstTags.size, secondTags.size);
}

export function relevanceToEloWeight(relevance: number) {
  const floor = COMPARISON_RELEVANCE.eloWeightFloor;
  return round(clamp(floor + relevance * (1 - floor), floor, 1));
}

function genreOverlapScore(first: ScoredMediaItem, second: ScoredMediaItem) {
  const firstGenres = new Set(
    (first.genres ?? []).map((entry) => entry.genre.name),
  );
  const secondGenres = new Set(
    (second.genres ?? []).map((entry) => entry.genre.name),
  );
  if (firstGenres.size === 0 || secondGenres.size === 0) return 0;
  const shared = [...firstGenres].filter((name) =>
    secondGenres.has(name),
  ).length;
  return shared / Math.max(firstGenres.size, secondGenres.size);
}

function proximityScore(
  first: number | null | undefined,
  second: number | null | undefined,
  maxDistance: number,
) {
  if (first == null || second == null) return 0;
  return clamp(1 - Math.abs(first - second) / maxDistance, 0, 1);
}

function yearFromDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.getUTCFullYear() : null;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
