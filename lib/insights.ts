import { prisma } from "@/lib/prisma";
import { calculateFriendCompatibility } from "@/lib/scoring/compatibility";
import { toMediaItemDTO } from "@/lib/media";
import { VISIBLE_MEDIA_TYPES, visibleMediaTypeFilter } from "@/lib/media-types";
import type {
  DataHealthReport,
  FriendCompatibility,
  GenreInsight,
  InsightMomentumGenre,
  MediaTypeGenreInsights,
} from "@/lib/types";
import { normalizeComparableTitle } from "@/lib/text-normalization";
import { getCurrentUserId } from "@/lib/user";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";

const SCORE_BANDS = [
  { label: "9 - 10", min: 9, max: 10 },
  { label: "7 - 8", min: 7, max: 8.999 },
  { label: "5 - 6", min: 5, max: 6.999 },
  { label: "3 - 4", min: 3, max: 4.999 },
  { label: "1 - 2", min: 0, max: 2.999 },
] as const;

export async function getGenreInsights(): Promise<GenreInsight[]> {
  const insightsByType = await getGenreInsightsByMediaType();
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

export async function getGenreInsightsByMediaType(): Promise<
  MediaTypeGenreInsights[]
> {
  const userId = await getCurrentUserId();
  const rawItems = await prisma.mediaItem.findMany({
    where: {
      mediaType: visibleMediaTypeFilter(),
      OR: [
        { userMedia: { none: { userId } } },
        { userMedia: { some: { userId, isArchived: false } } },
      ],
    },
    include: {
      genres: { include: { genre: true } },
      ...userMediaInclude(userId),
    },
    orderBy: [{ title: "asc" }],
  });
  const items = rawItems.map(mergeUserMedia);
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 90);

  return VISIBLE_MEDIA_TYPES.map((mediaType) => {
    const typeItems = items.filter((item) => item.mediaType === mediaType);
    const ratedItems = typeItems
      .map((item) => ({ item, score: mediaQualityScore(item) }))
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
    const genres = buildGenreInsights(typeItems, recentCutoff);

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
    status: string;
    updatedAt: Date;
    genres: Array<{ genre: { name: string } }>;
    computedConsensusScore: number | null;
    computedPersonalScore: number | null;
  }>,
  recentCutoff: Date,
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
    const score = mediaQualityScore(item);
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

function mediaQualityScore(item: {
  computedConsensusScore: number | null;
  computedPersonalScore: number | null;
}) {
  const scoreParts = [
    item.computedConsensusScore,
    item.computedPersonalScore,
  ].filter((score): score is number => typeof score === "number");

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

export async function getDataHealthReport(): Promise<DataHealthReport> {
  const userId = await getCurrentUserId();
  const rawItems = await prisma.mediaItem.findMany({
    where: {
      mediaType: visibleMediaTypeFilter(),
      OR: [
        { userMedia: { none: { userId } } },
        { userMedia: { some: { userId, isArchived: false } } },
      ],
    },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
      ...userMediaInclude(userId),
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

export async function getFriendCompatibility(): Promise<FriendCompatibility[]> {
  const userId = await getCurrentUserId();
  const friends = await prisma.friend.findMany({
    where: { userId },
    include: {
      ratings: {
        where: { media: { mediaType: visibleMediaTypeFilter() } },
        include: {
          media: {
            include: { userMedia: { where: { userId }, take: 1 } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return friends.map((friend) => {
    const overlapping = friend.ratings.filter((rating) => {
      const ownRating = rating.media.userMedia[0]?.personalRating ?? null;
      return rating.rating !== null && ownRating !== null;
    });
    const compatibility = calculateFriendCompatibility(
      overlapping.map((rating) => ({
        userRating: rating.media.userMedia[0]?.personalRating ?? 0,
        friendRating: rating.rating ?? 0,
      })),
    );

    return {
      friendId: friend.id,
      friendName: friend.name,
      overlapCount: compatibility.overlapCount,
      compatibilityScore: compatibility.compatibilityScore,
      averageDistance: compatibility.averageDistance,
      explanation: buildCompatibilityExplanation(
        compatibility.overlapCount,
        compatibility.compatibilityScore,
        compatibility.averageDistance,
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
