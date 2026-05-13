import { prisma } from "@/lib/prisma";
import { toMediaItemDTO } from "@/lib/media";
import { isVisibleMediaType, visibleMediaTypeFilter } from "@/lib/media-types";
import type {
  DataHealthReport,
  FriendCompatibility,
  GenreInsight,
} from "@/lib/types";
import { normalizeName } from "@/lib/validation";

export async function getGenreInsights(): Promise<GenreInsight[]> {
  const [totalItems, genres] = await Promise.all([
    prisma.mediaItem.count({
      where: { isArchived: false, mediaType: visibleMediaTypeFilter() },
    }),
    prisma.genre.findMany({
      include: {
        media: {
          include: {
            media: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return genres
    .map((genre) => {
      const active = genre.media
        .map((entry) => entry.media)
        .filter(
          (item) => !item.isArchived && isVisibleMediaType(item.mediaType),
        );
      const completed = active.filter((item) => item.status === "COMPLETED");
      const averageScore =
        completed.length > 0
          ? completed.reduce((sum, item) => sum + item.pairwiseScore, 0) /
            completed.length
          : 0;

      return {
        name: genre.name,
        count: active.length,
        completedCount: completed.length,
        averageScore,
        share:
          totalItems > 0 ? Math.round((active.length / totalItems) * 100) : 0,
        needsData: active.length < 2 || completed.length === 0,
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore || b.count - a.count);
}

export async function getDataHealthReport(): Promise<DataHealthReport> {
  const items = await prisma.mediaItem.findMany({
    where: { isArchived: false, mediaType: visibleMediaTypeFilter() },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
    },
    orderBy: { title: "asc" },
  });

  const dtos = items.map(toMediaItemDTO);
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
    missingDates: dtos.filter(
      (item) => !item.releaseDate && !item.upcomingDate,
    ),
    lowComparisonItems: dtos.filter((item) => item.comparisonCount < 3),
    duplicateCandidates: [...duplicateGroups.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([key, group]) => ({ key, items: group })),
  };
}

function normalizeComparableTitle(title: string) {
  return normalizeName(title)
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/^an?\s+/, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getFriendCompatibility(): Promise<FriendCompatibility[]> {
  const friends = await prisma.friend.findMany({
    include: {
      ratings: {
        where: { media: { mediaType: visibleMediaTypeFilter() } },
        include: { media: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return friends.map((friend) => {
    const overlapping = friend.ratings.filter(
      (rating) =>
        rating.rating !== null && rating.media.personalRating !== null,
    );
    const distance = overlapping.reduce(
      (sum, rating) =>
        sum +
        Math.abs((rating.rating ?? 0) - (rating.media.personalRating ?? 0)),
      0,
    );
    const averageDistance =
      overlapping.length > 0 ? distance / overlapping.length : null;
    const compatibilityScore =
      averageDistance === null
        ? 0
        : Math.max(0, Math.round(100 - averageDistance * 12));

    return {
      friendId: friend.id,
      friendName: friend.name,
      overlapCount: overlapping.length,
      compatibilityScore,
      averageDistance,
      explanation: buildCompatibilityExplanation(
        overlapping.length,
        compatibilityScore,
        averageDistance,
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
