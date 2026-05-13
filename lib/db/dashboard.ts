import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDataHealthReport, getGenreInsights } from "@/lib/insights";
import { getFriendCompatibility } from "@/lib/insights";
import { toMediaItemDTO } from "@/lib/media";
import { VISIBLE_MEDIA_TYPES, visibleMediaTypeFilter } from "@/lib/media-types";
import { getRecommendations } from "@/lib/recommendations";
import { startOfToday } from "@/lib/upcoming";

export function getDashboardUpcomingWhere(
  today = startOfToday(),
): Prisma.MediaItemWhereInput {
  return {
    isArchived: false,
    mediaType: visibleMediaTypeFilter(),
    upcomingDate: { gte: today },
  };
}

export const dashboardUpcomingOrderBy = [
  { upcomingDate: "asc" },
  { title: "asc" },
] satisfies Prisma.MediaItemOrderByWithRelationInput[];

export async function getDashboardData() {
  const today = startOfToday();

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
    topItemsByMediaType,
    upcomingItemsByMediaType,
  ] = await Promise.all([
    prisma.mediaItem.count({
      where: { isArchived: false, mediaType: visibleMediaTypeFilter() },
    }),
    prisma.mediaItem.count({
      where: {
        isArchived: false,
        mediaType: visibleMediaTypeFilter(),
        status: { in: ["WATCHLIST", "BACKLOG"] },
      },
    }),
    prisma.pairwiseComparison.count({
      where: { winner: { mediaType: visibleMediaTypeFilter() } },
    }),
    prisma.mediaItem.findMany({
      where: {
        isArchived: false,
        mediaType: visibleMediaTypeFilter(),
        status: "COMPLETED",
      },
      include: {
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
      },
      orderBy: [{ pairwiseScore: "desc" }],
      take: 10,
    }),
    getRecommendations(5),
    getDataHealthReport(),
    getGenreInsights(),
    prisma.mediaItem.groupBy({
      by: ["mediaType"],
      where: { isArchived: false, mediaType: visibleMediaTypeFilter() },
      _count: { _all: true },
      orderBy: { mediaType: "asc" },
    }),
    prisma.mediaItem.findMany({
      where: getDashboardUpcomingWhere(today),
      include: {
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
      },
      orderBy: dashboardUpcomingOrderBy,
      take: 5,
    }),
    prisma.mediaItem.findMany({
      where: {
        isArchived: false,
        mediaType: visibleMediaTypeFilter(),
        status: { in: ["WATCHLIST", "BACKLOG"] },
      },
      include: {
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
      },
      orderBy: [{ pairwiseScore: "desc" }],
      take: 5,
    }),
    prisma.mediaItem.findMany({
      where: { isArchived: false, mediaType: visibleMediaTypeFilter() },
      include: {
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 5,
    }),
    getFriendCompatibility(),
    prisma.friend.count(),
    Promise.all(
      VISIBLE_MEDIA_TYPES.map(async (mediaType) => ({
        mediaType,
        items: await prisma.mediaItem.findMany({
          where: {
            isArchived: false,
            mediaType,
            status: "COMPLETED",
          },
          include: {
            genres: { include: { genre: true } },
            tags: { include: { tag: true } },
          },
          orderBy: [{ pairwiseScore: "desc" }],
          take: 10,
        }),
      })),
    ),
    Promise.all(
      VISIBLE_MEDIA_TYPES.map(async (mediaType) => ({
        mediaType,
        items: await prisma.mediaItem.findMany({
          where: {
            ...getDashboardUpcomingWhere(today),
            mediaType,
          },
          include: {
            genres: { include: { genre: true } },
            tags: { include: { tag: true } },
          },
          orderBy: dashboardUpcomingOrderBy,
          take: 5,
        }),
      })),
    ),
  ]);

  return {
    totalItems,
    watchlistCount,
    comparisonCount,
    missingMetadataCount:
      healthReport.missingGenres.length + healthReport.missingDates.length,
    duplicateCount: healthReport.duplicateCandidates.length,
    topItems: topItems.map(toMediaItemDTO),
    topItemsByMediaType: topItemsByMediaType.map((entry) => ({
      mediaType: entry.mediaType,
      items: entry.items.map(toMediaItemDTO),
    })),
    recommendations,
    genreInsights: genreInsights.slice(0, 8),
    mediaTypeCounts: mediaTypeCounts.map((entry) => ({
      mediaType: entry.mediaType,
      count: entry._count._all,
    })),
    upcomingItems: upcomingItems.map(toMediaItemDTO),
    upcomingItemsByMediaType: upcomingItemsByMediaType.map((entry) => ({
      mediaType: entry.mediaType,
      items: entry.items.map(toMediaItemDTO),
    })),
    watchlistItems: watchlistItems.map(toMediaItemDTO),
    recentItems: recentItems.map(toMediaItemDTO),
    friendCompatibility: friendCompatibility.slice(0, 5),
    friendCount,
    health: {
      missingGenres: healthReport.missingGenres.length,
      missingReleaseDates: healthReport.missingDates.length,
      lowComparisonItems: healthReport.lowComparisonItems.length,
    },
  };
}
