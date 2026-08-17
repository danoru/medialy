import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toMediaItemDTO } from "@/lib/media";
import { VISIBLE_MEDIA_TYPES, visibleMediaTypeFilter } from "@/lib/media-types";
import type {
  DataHealthReport,
  FollowCompatibility,
  GenreInsight,
  InsightMomentumGenre,
  MediaTypeGenreInsights,
} from "@/lib/types";
import { normalizeComparableTitle } from "@/lib/text-normalization";
import { getCurrentUserId } from "@/lib/user";
import { mergeUserMedia, userMediaSelect } from "@/lib/db/user-media";
import { LEAN_MEDIA_WITH_TAXONOMY_SELECT } from "@/lib/db/media-select";
import { getCatalogWithUser } from "@/lib/db/catalog";
import { getFollowingIds, getUserProfiles } from "@/lib/social/follows";
import { calculateRatingCompatibility } from "@/lib/scoring/compatibility";
import { bayesianShrunkMean } from "@/lib/scoring/affinity";
import { TOP_RANKING } from "@/lib/scoring/config";

const SCORE_BANDS = [
  { label: "9 - 10", min: 9, max: 10 },
  { label: "7 - 8", min: 7, max: 8.999 },
  { label: "5 - 6", min: 5, max: 6.999 },
  { label: "3 - 4", min: 3, max: 4.999 },
  { label: "1 - 2", min: 0, max: 2.999 },
] as const;

export async function getGenreInsights(
  userId?: string | null,
): Promise<GenreInsight[]> {
  const resolvedUserId =
    userId === undefined ? await getCurrentUserId() : userId;
  const insightsByType = await getGenreInsightsByMediaType(resolvedUserId);
  const totalItems = insightsByType.reduce(
    (sum, entry) => sum + entry.totalCount,
    0,
  );
  const genres = new Map<
    string,
    {
      count: number;
      completedCount: number;
      ratedCount: number;
      weightedScoreTotal: number;
    }
  >();

  for (const entry of insightsByType) {
    for (const genre of entry.genres) {
      const current = genres.get(genre.name) ?? {
        count: 0,
        completedCount: 0,
        ratedCount: 0,
        weightedScoreTotal: 0,
      };
      current.count += genre.count;
      current.completedCount += genre.completedCount;
      current.ratedCount += genre.ratedCount;
      current.weightedScoreTotal += genre.averageScore * genre.ratedCount;
      genres.set(genre.name, current);
    }
  }

  return [...genres.entries()]
    .map(([name, genre]) => ({
      name,
      count: genre.count,
      completedCount: genre.completedCount,
      ratedCount: genre.ratedCount,
      averageScore:
        genre.ratedCount > 0 ? genre.weightedScoreTotal / genre.ratedCount : 0,
      share: totalItems > 0 ? Math.round((genre.count / totalItems) * 100) : 0,
      needsData: genre.count < 2 || genre.ratedCount < 2,
    }))
    .sort(compareGenreInsights);
}

export async function getGenreInsightsByMediaType(
  userId?: string | null,
): Promise<MediaTypeGenreInsights[]> {
  const resolvedUserId =
    userId === undefined ? await getCurrentUserId() : userId;

  // Shares the dashboard's cached catalog read. The old archive filter (no
  // UserMedia row, or one that isn't archived) is just `!isArchived` once the
  // per-user fields are merged on.
  const catalog = await getCatalogWithUser(resolvedUserId);
  const items =
    resolvedUserId == null
      ? catalog
      : catalog.filter((item) => !item.isArchived);
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 90);

  // Source counts for consensus shrinkage. A bare groupBy over the whole table
  // is smaller on the wire than sending every catalog id up as an `IN` list.
  const sourceCountRows = await prisma.externalRating.groupBy({
    by: ["mediaId"],
    _count: { _all: true },
  });
  const sourceCountByMediaId = new Map(
    sourceCountRows.map((row) => [row.mediaId, row._count._all]),
  );

  return VISIBLE_MEDIA_TYPES.map((mediaType) => {
    const typeItems = items.filter((item) => item.mediaType === mediaType);
    const context = buildInsightsRankingContext(typeItems, sourceCountByMediaId);
    const ratedItems = typeItems
      .map((item) => ({ item, score: mediaQualityScore(item, context) }))
      .filter(
        (entry): entry is { item: (typeof typeItems)[number]; score: number } =>
          typeof entry.score === "number",
      );
    const completedCount = typeItems.filter(
      (item) => item.status === "COMPLETED",
    ).length;
    const averageScore =
      ratedItems.length > 0
        ? ratedItems.reduce((sum, entry) => sum + entry.score, 0) /
          ratedItems.length
        : 0;
    const genres = buildGenreInsights(typeItems, recentCutoff, context);

    return {
      mediaType,
      totalCount: typeItems.length,
      completedCount,
      ratedCount: ratedItems.length,
      averageScore: roundScore(averageScore),
      coverage: percentage(ratedItems.length, typeItems.length),
      completedRatio: percentage(completedCount, typeItems.length),
      genres,
      scoreBands: buildScoreBands(ratedItems.map((entry) => entry.score)),
      risingGenres: buildRisingGenres(genres),
      standoutTitles: ratedItems
        .sort((first, second) => {
          const scoreDelta = second.score - first.score;
          if (scoreDelta !== 0) return scoreDelta;
          return first.item.title.localeCompare(second.item.title);
        })
        .slice(0, 6)
        .map(({ item, score }) => ({
          id: item.id,
          title: item.title,
          mediaType: item.mediaType,
          releaseYear: item.releaseDate?.getUTCFullYear() ?? null,
          posterUrl: item.posterUrl,
          score: roundScore(score),
          genres: item.genres
            .map((entry) => entry.genre.name)
            .sort((first, second) => first.localeCompare(second)),
        })),
    };
  });
}

function buildGenreInsights(
  items: Array<{
    id: string;
    status: string;
    updatedAt: Date;
    genres: Array<{ genre: { name: string } }>;
    computedConsensusScore: number | null;
    computedPersonalScore: number | null;
    personalRating?: number | null;
    comparisonCount?: number;
  }>,
  recentCutoff: Date,
  context: InsightsRankingContext,
) {
  const genres = new Map<
    string,
    {
      count: number;
      completedCount: number;
      ratedCount: number;
      scoreTotal: number;
      recentRatedCount: number;
      recentScoreTotal: number;
    }
  >();

  for (const item of items) {
    const score = mediaQualityScore(item, context);
    const isCompleted = item.status === "COMPLETED";
    const isRecent = item.updatedAt >= recentCutoff;

    for (const entry of item.genres) {
      const current = genres.get(entry.genre.name) ?? {
        count: 0,
        completedCount: 0,
        ratedCount: 0,
        scoreTotal: 0,
        recentRatedCount: 0,
        recentScoreTotal: 0,
      };
      current.count += 1;
      if (isCompleted) current.completedCount += 1;
      if (score != null) {
        current.ratedCount += 1;
        current.scoreTotal += score;
        if (isRecent) {
          current.recentRatedCount += 1;
          current.recentScoreTotal += score;
        }
      }
      genres.set(entry.genre.name, current);
    }
  }

  return [...genres.entries()]
    .map(([name, genre]) => ({
      name,
      count: genre.count,
      completedCount: genre.completedCount,
      ratedCount: genre.ratedCount,
      averageScore:
        genre.ratedCount > 0
          ? roundScore(genre.scoreTotal / genre.ratedCount)
          : 0,
      recentAverageScore:
        genre.recentRatedCount > 0
          ? roundScore(genre.recentScoreTotal / genre.recentRatedCount)
          : 0,
      recentRatedCount: genre.recentRatedCount,
      share: percentage(genre.count, items.length),
      needsData: genre.count < 2 || genre.ratedCount < 2,
    }))
    .filter((genre) => genre.count > 0)
    .sort(compareGenreInsights);
}

function buildScoreBands(scores: number[]) {
  return SCORE_BANDS.map((band) => {
    const count = scores.filter(
      (score) => score >= band.min && score <= band.max,
    ).length;
    return {
      label: band.label,
      count,
      share: percentage(count, scores.length),
    };
  });
}

function buildRisingGenres(
  genres: Array<
    GenreInsight & { recentAverageScore: number; recentRatedCount: number }
  >,
): InsightMomentumGenre[] {
  return genres
    .filter((genre) => genre.ratedCount > 0 && genre.recentRatedCount > 0)
    .map((genre) => ({
      name: genre.name,
      averageScore: genre.averageScore,
      recentAverageScore: genre.recentAverageScore,
      momentum: roundScore(genre.recentAverageScore - genre.averageScore),
      ratedCount: genre.ratedCount,
      recentRatedCount: genre.recentRatedCount,
    }))
    .sort((first, second) => {
      const momentumDelta = second.momentum - first.momentum;
      if (momentumDelta !== 0) return momentumDelta;
      const recentDelta = second.recentRatedCount - first.recentRatedCount;
      if (recentDelta !== 0) return recentDelta;
      return second.recentAverageScore - first.recentAverageScore;
    })
    .slice(0, 5);
}

function percentage(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

type InsightsRankingContext = {
  globalPersonalMean: number;
  globalConsensusMean: number;
  sourceCountByMediaId: Map<string, number>;
};

function buildInsightsRankingContext(
  items: Array<{
    computedConsensusScore: number | null;
    computedPersonalScore: number | null;
  }>,
  sourceCountByMediaId: Map<string, number>,
): InsightsRankingContext {
  let consensusSum = 0;
  let consensusCount = 0;
  let personalSum = 0;
  let personalCount = 0;
  for (const item of items) {
    if (typeof item.computedConsensusScore === "number") {
      consensusSum += item.computedConsensusScore;
      consensusCount += 1;
    }
    if (typeof item.computedPersonalScore === "number") {
      personalSum += item.computedPersonalScore;
      personalCount += 1;
    }
  }
  return {
    globalConsensusMean:
      consensusCount > 0 ? consensusSum / consensusCount : TOP_RANKING.fallbackPrior,
    globalPersonalMean:
      personalCount > 0 ? personalSum / personalCount : TOP_RANKING.fallbackPrior,
    sourceCountByMediaId,
  };
}

function mediaQualityScore(
  item: {
    id?: string;
    computedConsensusScore: number | null;
    computedPersonalScore: number | null;
    personalRating?: number | null;
    comparisonCount?: number;
  },
  context: InsightsRankingContext,
) {
  const scoreParts: number[] = [];

  if (typeof item.computedConsensusScore === "number") {
    // Default to 1 source if we don't have a count — consensus existing means
    // at least one source produced it.
    const sources = Math.max(
      (item.id ? context.sourceCountByMediaId.get(item.id) : undefined) ?? 0,
      1,
    );
    scoreParts.push(
      bayesianShrunkMean(
        item.computedConsensusScore,
        sources,
        context.globalConsensusMean,
        TOP_RANKING.shrinkageK.source,
      ),
    );
  }
  if (typeof item.computedPersonalScore === "number") {
    // Evidence: each pairwise comparison counts as one unit; a present
    // explicit rating contributes 3 units (matches the first real confidence
    // bucket in PAIRWISE.confidenceBuckets).
    const evidence =
      (item.comparisonCount ?? 0) + (item.personalRating != null ? 3 : 0);
    scoreParts.push(
      bayesianShrunkMean(
        item.computedPersonalScore,
        evidence,
        context.globalPersonalMean,
        TOP_RANKING.shrinkageK.personal,
      ),
    );
  }

  if (scoreParts.length === 0) return null;
  return scoreParts.reduce((sum, score) => sum + score, 0) / scoreParts.length;
}

function compareGenreInsights(first: GenreInsight, second: GenreInsight) {
  return (
    second.averageScore - first.averageScore ||
    second.ratedCount - first.ratedCount ||
    second.count - first.count ||
    first.name.localeCompare(second.name)
  );
}

export async function getDataHealthReport(
  userId?: string | null,
): Promise<DataHealthReport> {
  const resolvedUserId =
    userId === undefined ? await getCurrentUserId() : userId;
  const archivedFilter =
    resolvedUserId == null
      ? {}
      : {
          OR: [
            { userMedia: { none: { userId: resolvedUserId } } },
            { userMedia: { some: { userId: resolvedUserId, isArchived: false } } },
          ],
        };
  const rawItems = await prisma.mediaItem.findMany({
    where: {
      mediaType: visibleMediaTypeFilter(),
      ...archivedFilter,
    },
    select: {
      ...LEAN_MEDIA_WITH_TAXONOMY_SELECT,
      ...userMediaSelect(resolvedUserId),
    },
    orderBy: { title: "asc" },
  });

  const dtos = rawItems.map((item) => toMediaItemDTO(mergeUserMedia(item)));
  const duplicateGroups = new Map<string, typeof dtos>();

  for (const item of dtos) {
    const year = item.releaseDate
      ? new Date(item.releaseDate).getFullYear()
      : "unknown";
    const key = `${normalizeComparableTitle(item.title)}::${item.mediaType}::${year}`;
    duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), item]);
  }

  return {
    missingGenres: dtos.filter((item) => item.genres.length === 0),
    missingDates: dtos.filter((item) => !item.releaseDate),
    missingPosters: dtos.filter((item) => !item.posterUrl),
    lowComparisonItems: dtos.filter((item) => item.comparisonCount < 3),
    duplicateCandidates: [...duplicateGroups.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([key, group]) => ({ key, items: group })),
  };
}

export type DataHealthCounts = {
  missingGenres: number;
  missingDates: number;
  missingPosters: number;
  lowComparisonItems: number;
  duplicateCandidates: number;
};

/**
 * Just the five data-health tallies — for the dashboard and profile, which only
 * read `.length` of each list.
 *
 * `getDataHealthReport` hydrates the entire catalog with genres/tags/userMedia
 * joins to produce these counts; that full report is only needed by the
 * data-health page. Here we use `count` aggregates for four of the metrics and
 * a thin title-only scan for the duplicate grouping (which needs JS title
 * normalization and so can't be a pure SQL count) — no relation joins.
 */
export async function getDataHealthCounts(
  userId?: string | null,
): Promise<DataHealthCounts> {
  const resolvedUserId =
    userId === undefined ? await getCurrentUserId() : userId;
  const base: Prisma.MediaItemWhereInput = {
    mediaType: visibleMediaTypeFilter(),
    ...(resolvedUserId == null
      ? {}
      : {
          OR: [
            { userMedia: { none: { userId: resolvedUserId } } },
            { userMedia: { some: { userId: resolvedUserId, isArchived: false } } },
          ],
        }),
  };

  // "Low comparison" means the viewer's own comparisonCount < 3, and a missing
  // UserMedia row counts as 0 (< 3). So: everything active EXCEPT items this
  // user has already compared 3+ times. Anonymous viewers have no rows, so
  // every item qualifies (base alone).
  const lowComparisonWhere: Prisma.MediaItemWhereInput =
    resolvedUserId == null
      ? base
      : {
          ...base,
          NOT: {
            userMedia: {
              some: { userId: resolvedUserId, comparisonCount: { gte: 3 } },
            },
          },
        };

  const [missingGenres, missingDates, missingPosters, lowComparisonItems, dupRows] =
    await Promise.all([
      prisma.mediaItem.count({ where: { ...base, genres: { none: {} } } }),
      prisma.mediaItem.count({ where: { ...base, releaseDate: null } }),
      prisma.mediaItem.count({ where: { ...base, posterUrl: null } }),
      prisma.mediaItem.count({ where: lowComparisonWhere }),
      prisma.mediaItem.findMany({
        where: base,
        select: { title: true, mediaType: true, releaseDate: true },
      }),
    ]);

  const dupGroups = new Map<string, number>();
  for (const item of dupRows) {
    const year = item.releaseDate
      ? new Date(item.releaseDate).getFullYear()
      : "unknown";
    const key = `${normalizeComparableTitle(item.title)}::${item.mediaType}::${year}`;
    dupGroups.set(key, (dupGroups.get(key) ?? 0) + 1);
  }
  let duplicateCandidates = 0;
  for (const count of dupGroups.values()) {
    if (count > 1) duplicateCandidates += 1;
  }

  return {
    missingGenres,
    missingDates,
    missingPosters,
    lowComparisonItems,
    duplicateCandidates,
  };
}

/**
 * Compatibility with each user the viewer follows.
 *
 * This only needs the rating-compatibility numbers, so it does NOT call the
 * full `getUserOverlap` per follow — that fans out ~5 queries each (shared
 * watchlist, watch-next titles, shared genres) whose results this panel throws
 * away. Instead we load the viewer's rated rows once and every followed user's
 * rated rows in a single `in` query, then pair them up in memory. N follows go
 * from ~5N queries to a flat 3 (profiles + viewer + all targets). The richer
 * `getUserOverlap` still backs the per-user detail pages.
 */
export async function getFollowCompatibility(
  userId?: string | null,
): Promise<FollowCompatibility[]> {
  const resolvedUserId =
    userId === undefined ? await getCurrentUserId() : userId;
  if (resolvedUserId == null) return [];

  const followingIds = (await getFollowingIds(resolvedUserId)).filter(
    (id) => id !== resolvedUserId,
  );
  if (followingIds.length === 0) return [];

  const ratedVisible = {
    isArchived: false,
    personalRating: { not: null },
    media: { mediaType: visibleMediaTypeFilter() },
  } as const;

  const [profiles, viewerRows, targetRows] = await Promise.all([
    getUserProfiles(followingIds),
    prisma.userMedia.findMany({
      where: { userId: resolvedUserId, ...ratedVisible },
      select: { mediaId: true, personalRating: true },
    }),
    prisma.userMedia.findMany({
      where: { userId: { in: followingIds }, ...ratedVisible },
      select: { userId: true, mediaId: true, personalRating: true },
    }),
  ]);

  const viewerRatingByMedia = new Map(
    viewerRows.map((row) => [row.mediaId, row.personalRating as number]),
  );
  const targetRowsByUser = new Map<
    string,
    Array<{ mediaId: string; personalRating: number }>
  >();
  for (const row of targetRows) {
    const list = targetRowsByUser.get(row.userId) ?? [];
    list.push({ mediaId: row.mediaId, personalRating: row.personalRating as number });
    targetRowsByUser.set(row.userId, list);
  }

  return followingIds.map((targetId) => {
    const pairs: Array<{ viewerRating: number; otherRating: number }> = [];
    for (const row of targetRowsByUser.get(targetId) ?? []) {
      const viewerRating = viewerRatingByMedia.get(row.mediaId);
      if (viewerRating != null) {
        pairs.push({ viewerRating, otherRating: row.personalRating });
      }
    }
    const compat = calculateRatingCompatibility(pairs);
    const profile = profiles.get(targetId);
    return {
      userId: targetId,
      displayName: profile?.displayName ?? "Someone",
      image: profile?.image ?? null,
      avatarColor: profile?.avatarColor ?? null,
      overlapCount: compat.overlapCount,
      compatibilityScore: compat.compatibilityScore,
      averageDistance: compat.averageDistance,
      explanation: buildCompatibilityExplanation(
        compat.overlapCount,
        compat.compatibilityScore,
        compat.averageDistance,
      ),
    };
  });
}

function buildCompatibilityExplanation(
  overlapCount: number,
  compatibilityScore: number,
  averageDistance: number | null,
) {
  if (overlapCount === 0 || averageDistance === null) {
    return "Add ratings for media you have also rated to calculate compatibility.";
  }
  if (overlapCount < 3) {
    return `Based on ${overlapCount} shared rating${overlapCount === 1 ? "" : "s"}; add more overlap for a steadier signal.`;
  }
  if (compatibilityScore >= 80)
    return "Your ratings are usually close on shared media.";
  if (compatibilityScore >= 55)
    return "Your ratings overlap moderately with some taste differences.";
  return "Your shared ratings often diverge, which can make their favorites useful contrast picks.";
}
