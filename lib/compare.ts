import type { MediaStatus, MediaType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isVisibleMediaType, visibleMediaTypeFilter } from "@/lib/media-types";
import { calculateComparisonRelevance } from "@/lib/scoring/comparisonRelevance";
import { requireUserId } from "@/lib/user";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";

export type ComparisonSelectionItem = {
  id: string;
  mediaType: MediaType;
  status: MediaStatus;
  personalRating: number | null;
  comparisonCount: number;
  pairwiseScore: number;
  releaseDate: Date | string | null;
  posterUrl: string | null;
  genres: Array<{ genre: { name: string } }>;
  tags?: Array<{ tag: { name: string } }>;
};

type PairCandidate<TItem extends ComparisonSelectionItem> = {
  first: TItem;
  second: TItem;
  sharedGenres: number;
  weight: number;
};

export type ComparisonPairOptions = {
  mediaType?: MediaType;
  genre?: string;
  tag?: string;
  focusId?: string;
  skipPairKey?: string;
};

type SelectionOptions = {
  focusId?: string;
  genre?: string;
  currentDate?: Date;
  skipPairKey?: string;
  random?: () => number;
};

// Only media you've actually experienced can be compared — you can't rank
// something you have no opinion on. Anything not in this list (UNTRACKED,
// NOT_INTERESTED, WATCHLIST, BACKLOG, or no UserMedia row at all) is excluded.
const COMPARISON_ELIGIBLE_STATUSES: MediaStatus[] = [
  "COMPLETED",
  "DROPPED",
  "PAUSED",
  "IN_PROGRESS",
];

export async function getComparisonPair(options: ComparisonPairOptions = {}) {
  const userId = await requireUserId("/compare");
  const focusRow = options.focusId
    ? await prisma.mediaItem.findUnique({
        where: { id: options.focusId },
        include: {
          genres: { include: { genre: true } },
          tags: { include: { tag: true } },
          ...userMediaInclude(userId),
        },
      })
    : null;
  const focus = focusRow ? mergeUserMedia(focusRow) : null;

  if (
    focus &&
    (!isVisibleMediaType(focus.mediaType) ||
      !isComparisonEligibleStatus(focus.status) ||
      !isReleasedForComparison(focus.releaseDate))
  )
    return null;

  const mediaType =
    focus?.mediaType ?? options.mediaType ?? (await selectDefaultMediaType(userId));
  if (!mediaType) return null;

  const [items, recentComparisons] = await Promise.all([
    loadComparisonItems(userId, mediaType, options.genre, options.tag),
    prisma.pairwiseComparison.findMany({
      where: { userId },
      select: { winnerId: true, loserId: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  if (focus?.isArchived) return null;

  return selectComparisonPair(items, recentComparisons, {
    focusId: focus?.id,
    genre: options.genre,
    skipPairKey: options.skipPairKey,
  });
}

async function selectDefaultMediaType(userId: string) {
  const groups = await prisma.mediaItem.groupBy({
    by: ["mediaType"],
    where: comparisonEligibleWhere(userId),
    _count: true,
  });
  const eligible = groups.filter((group) => group._count >= 2);

  return eligible.sort((a, b) => b._count - a._count)[0]?.mediaType;
}

async function loadComparisonItems(
  userId: string,
  mediaType: MediaType,
  genre?: string,
  tag?: string,
) {
  const rows = await prisma.mediaItem.findMany({
    where: {
      ...comparisonEligibleWhere(userId),
      mediaType,
      ...(genre ? { genres: { some: { genre: { name: genre } } } } : {}),
      ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
    },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
      ...userMediaInclude(userId),
    },
    orderBy: [{ updatedAt: "asc" }],
    take: 36,
  });
  return rows
    .map(mergeUserMedia)
    .sort(
      (a, b) =>
        a.comparisonCount - b.comparisonCount ||
        a.updatedAt.getTime() - b.updatedAt.getTime(),
    );
}

export function selectComparisonPair<TItem extends ComparisonSelectionItem>(
  items: TItem[],
  recentComparisons: Array<{ winnerId: string; loserId: string }>,
  options: SelectionOptions = {},
) {
  const eligibleItems = items.filter(
    (item) =>
      isComparisonEligibleStatus(item.status) &&
      isReleasedForComparison(item.releaseDate, options.currentDate),
  );
  const focusItem = options.focusId
    ? eligibleItems.find((item) => item.id === options.focusId)
    : null;
  if (options.focusId && !focusItem) return null;
  if (eligibleItems.length < 2) return null;

  const recentKeys = new Set(
    recentComparisons.map((entry) =>
      comparisonKey(entry.winnerId, entry.loserId),
    ),
  );
  if (options.skipPairKey) recentKeys.add(options.skipPairKey);

  const allPairs = buildPairCandidates(
    eligibleItems,
    recentKeys,
    focusItem?.id,
  );
  if (allPairs.length === 0) {
    const fallback = focusItem
      ? eligibleItems.find(
          (item) =>
            item.id !== focusItem.id && item.mediaType === focusItem.mediaType,
        )
      : eligibleItems.find(
          (item) =>
            item.id !== eligibleItems[0].id &&
            item.mediaType === eligibleItems[0].mediaType,
        );
    if (!fallback) return null;
    return [focusItem ?? eligibleItems[0], fallback] as const;
  }

  const sameGenrePairs = allPairs.filter((pair) => pair.sharedGenres > 0);
  const pairPool =
    sameGenrePairs.length >= 2 || options.genre ? sameGenrePairs : allPairs;
  const selected = pickWeighted(
    pairPool.length > 0 ? pairPool : allPairs,
    options.random,
  );

  return [selected.first, selected.second] as const;
}

function buildPairCandidates<TItem extends ComparisonSelectionItem>(
  items: TItem[],
  recentKeys: Set<string>,
  focusId?: string,
): Array<PairCandidate<TItem>> {
  const weightedPairs: Array<PairCandidate<TItem>> = [];

  for (let firstIndex = 0; firstIndex < items.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < items.length;
      secondIndex += 1
    ) {
      const first = items[firstIndex];
      const second = items[secondIndex];
      if (focusId && first.id !== focusId && second.id !== focusId) continue;
      if (first.mediaType !== second.mediaType) continue;
      if (recentKeys.has(comparisonKey(first.id, second.id))) continue;

      const sharedGenres = countSharedGenres(first, second);
      const relevance = calculateComparisonRelevance(first, second);
      const lowDataWeight = Math.max(
        1,
        6 - Math.min(first.comparisonCount, second.comparisonCount),
      );
      const relevanceWeight = Math.max(1, Math.round(relevance * 10));
      const baseWeight = lowDataWeight + relevanceWeight;

      // Genre overlap is the dominant signal: pairs sharing multiple genres are
      // weighted most heavily, a single shared genre moderately, and no overlap
      // falls back to the base relevance/low-data weighting.
      const genreMultiplier = sharedGenres >= 2 ? 8 : sharedGenres === 1 ? 3 : 1;

      // Among eligible pairs, prefer ones we've fully consumed over those we
      // only started, paused, or dropped.
      const consumedCount =
        (first.status === "COMPLETED" ? 1 : 0) +
        (second.status === "COMPLETED" ? 1 : 0);
      const consumedMultiplier =
        consumedCount === 2 ? 3 : consumedCount === 1 ? 1.5 : 1;

      weightedPairs.push({
        first,
        second,
        sharedGenres,
        weight: baseWeight * genreMultiplier * consumedMultiplier,
      });
    }
  }

  return weightedPairs;
}

function countSharedGenres(
  first: ComparisonSelectionItem,
  second: ComparisonSelectionItem,
) {
  const firstGenres = new Set(first.genres.map((entry) => entry.genre.name));
  return second.genres.filter((entry) => firstGenres.has(entry.genre.name))
    .length;
}

export function comparisonKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join("::");
}

export function isComparisonEligibleStatus(status: MediaStatus) {
  return COMPARISON_ELIGIBLE_STATUSES.includes(status);
}

export function isReleasedForComparison(
  releaseDate: Date | string | null,
  currentDate = new Date(),
) {
  if (!releaseDate) return true;
  return new Date(releaseDate).getTime() <= currentDate.getTime();
}

export function comparisonEligibleWhere(userId: string): Prisma.MediaItemWhereInput {
  return {
    mediaType: visibleMediaTypeFilter(),
    AND: [
      { OR: [{ releaseDate: null }, { releaseDate: { lte: new Date() } }] },
    ],
    userMedia: {
      some: {
        userId,
        isArchived: false,
        status: { in: COMPARISON_ELIGIBLE_STATUSES },
      },
    },
  };
}

function pickWeighted<T extends { weight: number }>(
  items: T[],
  random = Math.random,
) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * total;

  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) return item;
  }

  return items[items.length - 1];
}
