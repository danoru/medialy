import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDataHealthReport,
  getFollowCompatibility,
  getGenreInsightsByMediaType,
} from "@/lib/insights";
import { toMediaItemDTO } from "@/lib/media";
import { VISIBLE_MEDIA_TYPES, visibleMediaTypeFilter } from "@/lib/media-types";
import { getRecommendations } from "@/lib/recommendations";
import type { MediaItemDTO } from "@/lib/types";
import { getCurrentUser } from "@/lib/user";
import { startOfToday } from "@/lib/upcoming";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";
import { bayesianShrunkMean } from "@/lib/scoring/affinity";
import { TOP_RANKING } from "@/lib/scoring/config";

export function getDashboardUpcomingWhere(
  today = startOfToday(),
): Prisma.MediaItemWhereInput {
  return {
    mediaType: visibleMediaTypeFilter(),
    releaseDate: { gte: today },
  };
}

export const dashboardUpcomingOrderBy = [
  { releaseDate: "asc" },
  { title: "asc" },
] satisfies Prisma.MediaItemOrderByWithRelationInput[];

type DashboardRecommendationEntry = Awaited<
  ReturnType<typeof getRecommendations>
>[number];

export function getDashboardTopRecommendationsByMediaType(
  recommendations: DashboardRecommendationEntry[],
) {
  return VISIBLE_MEDIA_TYPES.map((mediaType) => ({
    mediaType,
    items: recommendations
      .filter((recommendation) => recommendation.media.mediaType === mediaType)
      .slice(0, 10),
  }));
}

/**
 * Per-item evidence and the global priors needed to shrink it. Computed once
 * per dashboard fetch in `getDashboardData` and threaded into the Top 10 picker.
 */
export type CommunityRatingEvidence = {
  /** Avg of personalRating across non-archived users who rated this item. */
  average: number;
  /** How many users contributed. Drives shrinkage strength. */
  voters: number;
};

export type ConsensusEvidence = {
  /** How many distinct external sources backed `computedConsensusScore`. */
  sources: number;
};

export type OverallTopRankingContext = {
  communityByMediaId: Map<string, CommunityRatingEvidence>;
  consensusByMediaId: Map<string, ConsensusEvidence>;
  globalCommunityMean: number;
  globalConsensusMean: number;
};

/**
 * The Overall Top 10 is intentionally objective: same ranking for every
 * viewer, signed-in or not. It blends external consensus with the average
 * `personalRating` across ALL users — no viewer-specific score, no archive
 * state, no affinity. Per-user signals belong on Tonight's Pick / Up Next.
 *
 * Both sub-scores are Bayesian-shrunk toward their global priors. An item
 * with one 10/10 rating and no critic sources gets pulled toward the mean;
 * an item with broad coverage holds its value. See `TOP_RANKING.shrinkageK`.
 */
export function dashboardQualityScore(
  consensusScore: number | null | undefined,
  community: CommunityRatingEvidence | null | undefined,
  consensus: ConsensusEvidence | null | undefined,
  globalCommunityMean: number,
  globalConsensusMean: number,
): { score: number; evidence: number } | null {
  const parts: number[] = [];
  let totalEvidence = 0;

  if (community && community.voters > 0) {
    parts.push(
      bayesianShrunkMean(
        community.average,
        community.voters,
        globalCommunityMean,
        TOP_RANKING.shrinkageK.user,
      ),
    );
    totalEvidence += community.voters;
  }
  if (typeof consensusScore === "number") {
    // Defensive default: if the consensus score exists, *some* source produced
    // it. Treat unknown counts as 1 so we don't silently substitute the prior.
    const sources = Math.max(consensus?.sources ?? 0, 1);
    parts.push(
      bayesianShrunkMean(
        consensusScore,
        sources,
        globalConsensusMean,
        TOP_RANKING.shrinkageK.source,
      ),
    );
    totalEvidence += sources;
  }
  if (parts.length === 0) return null;
  const score = parts.reduce((total, value) => total + value, 0) / parts.length;
  return { score, evidence: totalEvidence };
}

export function getDashboardOverallTopItemsByMediaType(
  items: MediaItemDTO[],
  context: OverallTopRankingContext,
) {
  return VISIBLE_MEDIA_TYPES.map((mediaType) => ({
    mediaType,
    items: items
      .filter((item) => item.mediaType === mediaType)
      .flatMap((media) => {
        const ranked = dashboardQualityScore(
          media.computedConsensusScore,
          context.communityByMediaId.get(media.id),
          context.consensusByMediaId.get(media.id),
          context.globalCommunityMean,
          context.globalConsensusMean,
        );
        return ranked == null ? [] : [{ media, ...ranked }];
      })
      .sort((first, second) => {
        const scoreDelta = second.score - first.score;
        if (scoreDelta !== 0) return scoreDelta;
        // Items with more total evidence win ties — broader sample is more
        // trustworthy at the same blended score.
        const evidenceDelta = second.evidence - first.evidence;
        if (evidenceDelta !== 0) return evidenceDelta;
        return first.media.title.localeCompare(second.media.title);
      })
      .slice(0, 10),
  }));
}

export function getDashboardTonightPicksByMediaType(
  recommendations: DashboardRecommendationEntry[],
) {
  return VISIBLE_MEDIA_TYPES.map((mediaType) => ({
    mediaType,
    recommendations: recommendations
      .filter((recommendation) => recommendation.media.mediaType === mediaType)
      .slice(0, 5),
  }));
}

export async function getDashboardData() {
  const today = startOfToday();
  const user = await getCurrentUser();
  // Anonymous viewers see a sensible default dashboard built from public
  // signals. We use a sentinel id that never matches any UserMedia row so
  // the per-user joins all collapse to defaults.
  const userId = user?.id ?? "__anonymous__";

  // Item is "active" for this user if either there's no UserMedia row yet
  // (defaults to UNTRACKED + not archived) or the row exists and isn't archived.
  const activeForUser: Prisma.MediaItemWhereInput = {
    OR: [
      { userMedia: { none: { userId } } },
      { userMedia: { some: { userId, isArchived: false } } },
    ],
  };
  const userMediaStatus = (
    statuses: Prisma.EnumMediaStatusFilter["in"],
  ) => ({
    userMedia: { some: { userId, isArchived: false, status: { in: statuses } } },
  });
  const withUserAndTaxonomy = {
    genres: { include: { genre: true } },
    tags: { include: { tag: true } },
    ...userMediaInclude(userId),
  } as const;
  const mergeAll = <T extends { userMedia: Parameters<typeof mergeUserMedia>[0]["userMedia"] }>(
    rows: T[],
  ) => rows.map(mergeUserMedia);

  const [
    totalItems,
    watchlistCount,
    comparisonCount,
    topItems,
    recommendations,
    healthReport,
    genreInsights,
    mediaTypeCounts,
    upcomingItems,
    watchlistItems,
    recentItems,
    followCompatibility,
    followingCount,
    personalTopItemsByMediaType,
    upcomingItemsByMediaType,
    overallTopItems,
    overallCommunityRatings,
    overallConsensusSourceCounts,
    globalCommunityAggregate,
    globalConsensusAggregate,
  ] = await Promise.all([
    prisma.mediaItem.count({
      where: { mediaType: visibleMediaTypeFilter(), ...activeForUser },
    }),
    prisma.mediaItem.count({
      where: {
        mediaType: visibleMediaTypeFilter(),
        ...userMediaStatus(["WATCHLIST", "BACKLOG"]),
      },
    }),
    prisma.pairwiseComparison.count({
      where: { userId, winner: { mediaType: visibleMediaTypeFilter() } },
    }),
    prisma.mediaItem.findMany({
      where: {
        mediaType: visibleMediaTypeFilter(),
        ...userMediaStatus(["COMPLETED"]),
      },
      include: withUserAndTaxonomy,
      take: 50,
    }),
    getRecommendations(),
    getDataHealthReport(),
    getGenreInsightsByMediaType(),
    prisma.mediaItem.groupBy({
      by: ["mediaType"],
      where: { mediaType: visibleMediaTypeFilter(), ...activeForUser },
      _count: { _all: true },
      orderBy: { mediaType: "asc" },
    }),
    prisma.mediaItem.findMany({
      where: getDashboardUpcomingWhere(today),
      include: withUserAndTaxonomy,
      orderBy: dashboardUpcomingOrderBy,
      take: 5,
    }),
    prisma.mediaItem.findMany({
      where: {
        mediaType: visibleMediaTypeFilter(),
        ...userMediaStatus(["WATCHLIST", "BACKLOG"]),
      },
      include: withUserAndTaxonomy,
      take: 50,
    }),
    prisma.mediaItem.findMany({
      where: { mediaType: visibleMediaTypeFilter(), ...activeForUser },
      include: withUserAndTaxonomy,
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
    }),
    getFollowCompatibility(userId),
    user
      ? prisma.userFollow.count({ where: { followerId: userId } })
      : Promise.resolve(0),
    Promise.all(
      VISIBLE_MEDIA_TYPES.map(async (mediaType) => ({
        mediaType,
        items: await prisma.mediaItem.findMany({
          where: { mediaType, ...userMediaStatus(["COMPLETED"]) },
          include: withUserAndTaxonomy,
          take: 50,
        }),
      })),
    ),
    Promise.all(
      VISIBLE_MEDIA_TYPES.map(async (mediaType) => ({
        mediaType,
        items: await prisma.mediaItem.findMany({
          where: { ...getDashboardUpcomingWhere(today), mediaType },
          include: withUserAndTaxonomy,
          orderBy: dashboardUpcomingOrderBy,
          take: 5,
        }),
      })),
    ),
    // Overall Top 10 candidate pool is intentionally global — no
    // `activeForUser` filter, so the viewer's archive state can't shape it.
    prisma.mediaItem.findMany({
      where: { mediaType: visibleMediaTypeFilter() },
      include: withUserAndTaxonomy,
    }),
    prisma.userMedia.groupBy({
      by: ["mediaId"],
      where: { isArchived: false, personalRating: { not: null } },
      _avg: { personalRating: true },
      _count: { personalRating: true },
    }),
    prisma.externalRating.groupBy({
      by: ["mediaId"],
      _count: { _all: true },
    }),
    // Globals used as Bayesian priors. Cheap (single AVG queries) and the
    // values change slowly enough that we don't bother caching.
    prisma.userMedia.aggregate({
      where: { isArchived: false, personalRating: { not: null } },
      _avg: { personalRating: true },
    }),
    prisma.mediaItem.aggregate({
      where: { computedConsensusScore: { not: null } },
      _avg: { computedConsensusScore: true },
    }),
  ]);

  const communityByMediaId = new Map<string, CommunityRatingEvidence>();
  for (const row of overallCommunityRatings) {
    if (row._avg.personalRating != null) {
      communityByMediaId.set(row.mediaId, {
        average: row._avg.personalRating,
        voters: row._count.personalRating,
      });
    }
  }
  const consensusByMediaId = new Map<string, ConsensusEvidence>();
  for (const row of overallConsensusSourceCounts) {
    consensusByMediaId.set(row.mediaId, { sources: row._count._all });
  }
  const globalCommunityMean =
    globalCommunityAggregate._avg.personalRating ?? TOP_RANKING.fallbackPrior;
  const globalConsensusMean =
    globalConsensusAggregate._avg.computedConsensusScore ??
    TOP_RANKING.fallbackPrior;

  // Sort the rows we couldn't sort in SQL (because the score columns live on
  // the joined UserMedia row) by their merged values.
  const sortByPersonalThenPairwise = <
    T extends { computedPersonalScore: number | null; pairwiseScore: number },
  >(
    rows: T[],
  ) =>
    [...rows].sort(
      (a, b) =>
        (b.computedPersonalScore ?? -Infinity) -
          (a.computedPersonalScore ?? -Infinity) ||
        b.pairwiseScore - a.pairwiseScore,
    );

  const mergedTopItems = sortByPersonalThenPairwise(mergeAll(topItems)).slice(
    0,
    10,
  );
  // Watchlist items haven't been watched, so personal/pairwise scores are
  // mostly null or at the default — sort by the Medialy Match score shown in
  // the UI (falling back to consensus) so the top 5 reflect predicted fit.
  const watchlistMatchByMediaId = new Map<string, number>();
  for (const rec of recommendations) {
    watchlistMatchByMediaId.set(rec.media.id, rec.score);
  }
  const mergedWatchlistItems = [...mergeAll(watchlistItems)]
    .sort((a, b) => {
      const aScore =
        watchlistMatchByMediaId.get(a.id) ?? a.computedConsensusScore ?? -Infinity;
      const bScore =
        watchlistMatchByMediaId.get(b.id) ?? b.computedConsensusScore ?? -Infinity;
      return bScore - aScore;
    })
    .slice(0, 5);
  const mergedRecentItems = mergeAll(recentItems);
  const mergedUpcomingItems = mergeAll(upcomingItems);
  const mergedOverallTopItems = mergeAll(overallTopItems);
  const mergedPersonalTopByType = personalTopItemsByMediaType.map((entry) => ({
    mediaType: entry.mediaType,
    items: sortByPersonalThenPairwise(mergeAll(entry.items)).slice(0, 10),
  }));
  const mergedUpcomingByType = upcomingItemsByMediaType.map((entry) => ({
    mediaType: entry.mediaType,
    items: mergeAll(entry.items),
  }));

  const topItemsByMediaType = getDashboardOverallTopItemsByMediaType(
    mergedOverallTopItems.map(toMediaItemDTO),
    {
      communityByMediaId,
      consensusByMediaId,
      globalCommunityMean,
      globalConsensusMean,
    },
  );
  const tonightPicksByMediaType =
    getDashboardTonightPicksByMediaType(recommendations);

  return {
    userName: user?.displayName ?? null,
    totalItems,
    watchlistCount,
    comparisonCount,
    missingMetadataCount:
      healthReport.missingGenres.length +
      healthReport.missingDates.length +
      healthReport.missingPosters.length,
    duplicateCount: healthReport.duplicateCandidates.length,
    topItems: mergedTopItems.map(toMediaItemDTO),
    topItemsByMediaType,
    personalTopItemsByMediaType: mergedPersonalTopByType.map((entry) => ({
      mediaType: entry.mediaType,
      items: entry.items.map(toMediaItemDTO),
    })),
    recommendations: recommendations.slice(0, 18),
    tonightPicksByMediaType,
    genreInsights,
    mediaTypeCounts: mediaTypeCounts.map((entry) => ({
      mediaType: entry.mediaType,
      count: entry._count._all,
    })),
    upcomingItems: mergedUpcomingItems.map(toMediaItemDTO),
    upcomingItemsByMediaType: mergedUpcomingByType.map((entry) => ({
      mediaType: entry.mediaType,
      items: entry.items.map(toMediaItemDTO),
    })),
    watchlistItems: mergedWatchlistItems.map(toMediaItemDTO),
    recentItems: mergedRecentItems.map(toMediaItemDTO),
    followCompatibility: followCompatibility.slice(0, 5),
    followingCount,
    health: {
      missingGenres: healthReport.missingGenres.length,
      missingReleaseDates: healthReport.missingDates.length,
      missingPosters: healthReport.missingPosters.length,
      lowComparisonItems: healthReport.lowComparisonItems.length,
    },
  };
}
