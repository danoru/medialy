import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDataHealthReport,
  getGenreInsightsByMediaType,
} from "@/lib/insights";
import { getFriendCompatibility } from "@/lib/insights";
import { toMediaItemDTO } from "@/lib/media";
import { VISIBLE_MEDIA_TYPES, visibleMediaTypeFilter } from "@/lib/media-types";
import { getRecommendations } from "@/lib/recommendations";
import type { MediaItemDTO } from "@/lib/types";
import { getCurrentUser } from "@/lib/user";
import { startOfToday } from "@/lib/upcoming";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";

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

export function dashboardQualityScore(
  item: Pick<MediaItemDTO, "computedConsensusScore" | "computedPersonalScore">,
) {
  const scoreParts = [
    item.computedConsensusScore,
    item.computedPersonalScore,
  ].filter((score): score is number => typeof score === "number");

  if (scoreParts.length > 0) {
    return (
      scoreParts.reduce((total, score) => total + score, 0) / scoreParts.length
    );
  }

  return null;
}

export function getDashboardOverallTopItemsByMediaType(items: MediaItemDTO[]) {
  return VISIBLE_MEDIA_TYPES.map((mediaType) => ({
    mediaType,
    items: items
      .filter((item) => !item.isArchived && item.mediaType === mediaType)
      .flatMap((media) => {
        const score = dashboardQualityScore(media);
        return score == null ? [] : [{ media, score }];
      })
      .sort((first, second) => {
        const scoreDelta = second.score - first.score;
        if (scoreDelta !== 0) return scoreDelta;
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
    friendCompatibility,
    friendCount,
    personalTopItemsByMediaType,
    upcomingItemsByMediaType,
    overallTopItems,
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
    getFriendCompatibility(),
    prisma.friend.count({ where: { userId } }),
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
    prisma.mediaItem.findMany({
      where: { mediaType: visibleMediaTypeFilter(), ...activeForUser },
      include: withUserAndTaxonomy,
    }),
  ]);

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
  const mergedWatchlistItems = sortByPersonalThenPairwise(
    mergeAll(watchlistItems),
  ).slice(0, 5);
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
    friendCompatibility: friendCompatibility.slice(0, 5),
    friendCount,
    health: {
      missingGenres: healthReport.missingGenres.length,
      missingReleaseDates: healthReport.missingDates.length,
      missingPosters: healthReport.missingPosters.length,
      lowComparisonItems: healthReport.lowComparisonItems.length,
    },
  };
}
