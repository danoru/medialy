import type { ScoredMediaItem } from "@/lib/scoring/types";
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
    4,
  );
  const pairwiseScore = proximityScore(
    first.pairwiseScore,
    second.pairwiseScore,
    500,
  );
  const yearScore = proximityScore(
    yearFromDate(first.releaseDate),
    yearFromDate(second.releaseDate),
    30,
  );

  return round(
    clamp(
      0.25 +
        genreScore * 0.35 +
        tagScore * 0.08 +
        ratingScore * 0.2 +
        pairwiseScore * 0.1 +
        yearScore * 0.05,
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
  return round(clamp(0.35 + relevance * 0.65, 0.35, 1));
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
