import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATALOG_CACHE_TAG, CATALOG_REVALIDATE_SECONDS } from "@/lib/cache";
import {
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

/**
 * Per media type. The dashboard lists only the nearest few but plots every
 * release inside `UPCOMING_HORIZON_DAYS` on a strip, so the query has to reach
 * past the visible rows. The window stays unbounded on purpose — a library
 * whose next release is beyond the horizon still gets rows to show.
 */
export const DASHBOARD_UPCOMING_TAKE = 24;

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
  /**
   * Avg of `computedPersonalScore` (Refined) across non-archived users who
   * gave this item an explicit personal rating. Pairwise comparisons made
   * without a personal rating don't contribute — a pure-Elo opinion isn't a
   * grounded enough signal to feed the community average.
   */
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
 * `computedPersonalScore` (Refined) across users who gave the item an
 * explicit rating — no viewer-specific score, no archive state, no affinity.
 * Per-user signals belong on Tonight's Pick / Up Next.
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

/**
 * The raw cross-user aggregates behind the ranking context (community averages,
 * external-source counts, two global priors). Split out and cached because the
 * result is a serializable, viewer-independent snapshot that changes slowly —
 * see lib/cache.ts. The `Map`-shaped {@link OverallTopRankingContext} is
 * assembled from this outside the cache (Maps don't survive JSON serialization).
 */
const getRawRankingAggregates = unstable_cache(
  async () => {
    const [
      overallCommunityRatings,
      overallConsensusSourceCounts,
      globalCommunityAggregate,
      globalConsensusAggregate,
    ] = await Promise.all([
      prisma.userMedia.groupBy({
        by: ["mediaId"],
        where: { isArchived: false, personalRating: { not: null } },
        _avg: { computedPersonalScore: true },
        _count: { computedPersonalScore: true },
      }),
      prisma.externalRating.groupBy({
        by: ["mediaId"],
        _count: { _all: true },
      }),
      prisma.userMedia.aggregate({
        where: { isArchived: false, personalRating: { not: null } },
        _avg: { computedPersonalScore: true },
      }),
      prisma.mediaItem.aggregate({
        where: { computedConsensusScore: { not: null } },
        _avg: { computedConsensusScore: true },
      }),
    ]);
    return {
      overallCommunityRatings,
      overallConsensusSourceCounts,
      globalCommunityMean:
        globalCommunityAggregate._avg.computedPersonalScore ?? null,
      globalConsensusMean:
        globalConsensusAggregate._avg.computedConsensusScore ?? null,
    };
  },
  ["overall-ranking-aggregates"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] },
);

export async function buildOverallTopRankingContext(): Promise<OverallTopRankingContext> {
  const {
    overallCommunityRatings,
    overallConsensusSourceCounts,
    globalCommunityMean: rawCommunityMean,
    globalConsensusMean: rawConsensusMean,
  } = await getRawRankingAggregates();

  const communityByMediaId = new Map<string, CommunityRatingEvidence>();
  for (const row of overallCommunityRatings) {
    if (row._avg.computedPersonalScore != null) {
      communityByMediaId.set(row.mediaId, {
        average: row._avg.computedPersonalScore,
        voters: row._count.computedPersonalScore,
      });
    }
  }
  const consensusByMediaId = new Map<string, ConsensusEvidence>();
  for (const row of overallConsensusSourceCounts) {
    consensusByMediaId.set(row.mediaId, { sources: row._count._all });
  }
  const globalCommunityMean = rawCommunityMean ?? TOP_RANKING.fallbackPrior;
  const globalConsensusMean = rawConsensusMean ?? TOP_RANKING.fallbackPrior;

  return {
    communityByMediaId,
    consensusByMediaId,
    globalCommunityMean,
    globalConsensusMean,
  };
}

export function getDashboardOverallTopItemsByMediaType(
  items: MediaItemDTO[],
  context: OverallTopRankingContext,
  limit = 10,
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
      .slice(0, limit),
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
  const withUserAndTaxonomy = {
    genres: { include: { genre: true } },
    tags: { include: { tag: true } },
    ...userMediaInclude(userId),
  } as const;
  const mergeAll = <
    T extends { userMedia: Parameters<typeof mergeUserMedia>[0]["userMedia"] },
  >(
    rows: T[],
  ) => rows.map(mergeUserMedia);

  const [
    recommendations,
    genreInsights,
    mediaTypeCounts,
    followCompatibility,
    followingCount,
    upcomingItemsByMediaType,
    overallTopItems,
    topRankingContext,
  ] = await Promise.all([
    getRecommendations(),
    getGenreInsightsByMediaType(),
    prisma.mediaItem.groupBy({
      by: ["mediaType"],
      where: { mediaType: visibleMediaTypeFilter(), ...activeForUser },
      _count: { _all: true },
      orderBy: { mediaType: "asc" },
    }),
    getFollowCompatibility(userId),
    user
      ? prisma.userFollow.count({ where: { followerId: userId } })
      : Promise.resolve(0),
    Promise.all(
      VISIBLE_MEDIA_TYPES.map(async (mediaType) => ({
        mediaType,
        items: await prisma.mediaItem.findMany({
          where: { ...getDashboardUpcomingWhere(today), mediaType },
          include: withUserAndTaxonomy,
          orderBy: dashboardUpcomingOrderBy,
          take: DASHBOARD_UPCOMING_TAKE,
        }),
      })),
    ),
    // Overall Top 10 candidate pool is intentionally global — no
    // `activeForUser` filter, so the viewer's archive state can't shape it.
    prisma.mediaItem.findMany({
      where: { mediaType: visibleMediaTypeFilter() },
      include: withUserAndTaxonomy,
    }),
    buildOverallTopRankingContext(),
  ]);

  const mergedOverallTopItems = mergeAll(overallTopItems);
  const mergedUpcomingByType = upcomingItemsByMediaType.map((entry) => ({
    mediaType: entry.mediaType,
    items: mergeAll(entry.items),
  }));

  const topItemsByMediaType = getDashboardOverallTopItemsByMediaType(
    mergedOverallTopItems.map(toMediaItemDTO),
    topRankingContext,
  );
  const tonightPicksByMediaType =
    getDashboardTonightPicksByMediaType(recommendations);

  return {
    userName: user?.displayName ?? null,
    topItemsByMediaType,
    recommendations: recommendations.slice(0, 18),
    tonightPicksByMediaType,
    genreInsights,
    mediaTypeCounts: mediaTypeCounts.map((entry) => ({
      mediaType: entry.mediaType,
      count: entry._count._all,
    })),
    upcomingItemsByMediaType: mergedUpcomingByType.map((entry) => ({
      mediaType: entry.mediaType,
      items: entry.items.map(toMediaItemDTO),
    })),
    followCompatibility: followCompatibility.slice(0, 5),
    followingCount,
  };
}
