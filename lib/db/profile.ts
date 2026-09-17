import type { MediaType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFollowCompatibility } from "@/lib/insights";
import { VISIBLE_MEDIA_TYPES, visibleMediaTypeFilter } from "@/lib/media-types";
import {
  buildRatingHistogram,
  lensShares,
  mergeActivity,
  monthYearLabel,
  pct,
  RANKED_COMPARISON_TARGET,
  topGenres,
  type LensShare,
  type ProfileActivity,
  type ProfileTile,
  type RatingHistogram,
} from "@/lib/profile";
import {
  getFollowingIds,
  getUserProfiles,
  type PublicUserProfile,
} from "@/lib/social/follows";
import { requireUser, userInitial } from "@/lib/user";

/**
 * Everything on the Profile page is about the signed-in user: their library
 * (the `UserMedia` rows they own), their comparisons, their follows and their
 * notes. Nothing here scans the shared catalog — that keeps Neon egress
 * proportional to one person's activity, not the whole library.
 */

const FAVORITES_SHOWN = 4;
const ACTIVITY_SHOWN = 5;
const TOP_SHOWN = 10;
const FOLLOWING_SHOWN = 5;
const NOTES_SHOWN = 3;

const tileSelect = {
  id: true,
  title: true,
  mediaType: true,
  posterUrl: true,
  releaseDate: true,
} as const;

export type ProfileRanked = { media: ProfileTile; score: number | null };

/**
 * Everything the page's media-type switcher drives. Each panel that shows
 * titles is scoped here, so flipping to TV changes the whole page, not just
 * the banner.
 */
export type ProfileTypeSection = {
  mediaType: MediaType;
  /** Your highest-scored title of this type, or null before any rating. */
  hero: ProfileRanked | null;
  topItems: ProfileRanked[];
  favorites: ProfileTile[];
  recentActivity: ProfileActivity[];
  ratings: RatingHistogram;
};

export type ProfileData = {
  user: {
    displayName: string;
    initial: string;
    avatarColor: string | null;
    image: string | null;
    memberSince: string;
  };
  counts: {
    watched: number;
    /** Completed titles whose `completedAt` falls in the current year. */
    thisYear: number;
    rated: number;
    /** Titles with enough comparisons to hold a place in your ranking. */
    ranked: number;
    /** Every pairwise comparison you have made. */
    compared: number;
  };
  byType: ProfileTypeSection[];
  taste: {
    lenses: LensShare[];
    mediaMix: Array<{ mediaType: MediaType; count: number; share: number }>;
    totalTracked: number;
    topGenres: string[];
  };
  friends: {
    followingCount: number;
    followersCount: number;
    following: PublicUserProfile[];
    topMatch: {
      userId: string;
      displayName: string;
      image: string | null;
      avatarColor: string | null;
      compatibilityScore: number;
      overlapCount: number;
    } | null;
  };
  notes: {
    total: number;
    recent: Array<{
      id: string;
      body: string;
      updatedAt: Date;
      media: ProfileTile;
    }>;
  };
};

export async function getProfileData(): Promise<ProfileData> {
  const user = await requireUser("/profile");
  const mediaType = visibleMediaTypeFilter();

  const [
    libraryRows,
    recentComparisons,
    lensCounts,
    comparisonCount,
    followingIds,
    followersCount,
    compatibility,
    notesTotal,
    recentNotes,
  ] = await Promise.all([
    prisma.userMedia.findMany({
      where: {
        userId: user.id,
        isArchived: false,
        media: { mediaType },
        OR: [
          { status: { not: "UNTRACKED" } },
          { personalRating: { not: null } },
          { comparisonCount: { gt: 0 } },
          { isFavorite: true },
        ],
      },
      select: {
        status: true,
        personalRating: true,
        computedPersonalScore: true,
        pairwiseScore: true,
        comparisonCount: true,
        isFavorite: true,
        updatedAt: true,
        completedAt: true,
        media: {
          select: {
            ...tileSelect,
            computedConsensusScore: true,
            genres: { select: { genre: { select: { name: true } } } },
          },
        },
      },
    }),
    Promise.all(
      VISIBLE_MEDIA_TYPES.map((type) =>
        prisma.pairwiseComparison.findMany({
          where: { userId: user.id, winner: { mediaType: type } },
          orderBy: { createdAt: "desc" },
          take: ACTIVITY_SHOWN,
          select: {
            id: true,
            createdAt: true,
            context: true,
            winner: { select: tileSelect },
            loser: { select: tileSelect },
          },
        }),
      ),
    ),
    prisma.pairwiseComparison.groupBy({
      by: ["context"],
      where: { userId: user.id, winner: { mediaType } },
      _count: { _all: true },
    }),
    prisma.pairwiseComparison.count({
      where: { userId: user.id, winner: { mediaType } },
    }),
    getFollowingIds(user.id),
    prisma.userFollow.count({ where: { followingId: user.id } }),
    getFollowCompatibility(user.id),
    prisma.note.count({ where: { userId: user.id } }),
    prisma.note.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: NOTES_SHOWN,
      select: {
        id: true,
        body: true,
        updatedAt: true,
        media: { select: tileSelect },
      },
    }),
  ]);

  const library = libraryRows.map((row) => ({
    ...row,
    media: {
      id: row.media.id,
      title: row.media.title,
      mediaType: row.media.mediaType,
      posterUrl: row.media.posterUrl,
      releaseDate: row.media.releaseDate,
    } satisfies ProfileTile,
    consensus: row.media.computedConsensusScore,
    genres: row.media.genres.map((entry) => entry.genre.name),
  }));

  // Counts
  // "This year" only counts dated completions: rows finished before the
  // completion date existed, or marked "not sure", are honest zeros here.
  const completed = library.filter((row) => row.status === "COMPLETED");
  const thisYear = new Date().getUTCFullYear();
  const counts = {
    watched: completed.length,
    thisYear: completed.filter(
      (row) => row.completedAt?.getUTCFullYear() === thisYear,
    ).length,
    rated: library.filter((row) => row.personalRating != null).length,
    ranked: library.filter(
      (row) => row.comparisonCount >= RANKED_COMPARISON_TARGET,
    ).length,
    compared: comparisonCount,
  };

  // Per-type panels. The ranking is your personal score — the refined score
  // where one exists (comparisons already feed it), else the raw rating — so
  // it is the same number the badge shows and it moves as you compare more.
  const byType: ProfileTypeSection[] = VISIBLE_MEDIA_TYPES.map((type, index) => {
    const rows = library.filter((row) => row.media.mediaType === type);
    const topItems = rows
      .map((row) => ({
        media: row.media,
        score: row.computedPersonalScore ?? row.personalRating ?? null,
        pairwiseScore: row.pairwiseScore,
      }))
      .filter((entry): entry is typeof entry & { score: number } => entry.score != null)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.pairwiseScore - a.pairwiseScore ||
          a.media.title.localeCompare(b.media.title),
      )
      .slice(0, TOP_SHOWN)
      .map(({ media, score }) => ({ media, score }));
    return {
      mediaType: type,
      hero: topItems[0] ?? null,
      topItems,
      favorites: rows
        .filter((row) => row.isFavorite)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, FAVORITES_SHOWN)
        .map((row) => row.media),
      recentActivity: mergeActivity(
        rows,
        recentComparisons[index] ?? [],
        ACTIVITY_SHOWN,
      ),
      ratings: buildRatingHistogram(
        rows.map((row) => ({
          rating: row.personalRating,
          consensus: row.consensus,
        })),
      ),
    };
  });

  // Taste
  const mixCounts = new Map<MediaType, number>();
  for (const row of library) {
    mixCounts.set(
      row.media.mediaType,
      (mixCounts.get(row.media.mediaType) ?? 0) + 1,
    );
  }
  const taste = {
    lenses: lensShares(
      lensCounts.map((group) => ({
        context: group.context,
        count: group._count._all,
      })),
    ),
    mediaMix: VISIBLE_MEDIA_TYPES.map((type) => ({
      mediaType: type,
      count: mixCounts.get(type) ?? 0,
      share: pct(mixCounts.get(type) ?? 0, library.length),
    })).filter((entry) => entry.count > 0),
    totalTracked: library.length,
    topGenres: topGenres(library),
  };

  // Friends
  const followingProfiles = await getUserProfiles(
    followingIds.slice(0, FOLLOWING_SHOWN),
  );
  const topMatch =
    compatibility
      .filter((entry) => entry.overlapCount > 0)
      .sort(
        (a, b) =>
          b.compatibilityScore - a.compatibilityScore ||
          b.overlapCount - a.overlapCount,
      )[0] ?? null;

  return {
    user: {
      displayName: user.displayName,
      initial: userInitial(user.displayName),
      avatarColor: user.avatarColor,
      image: user.image,
      memberSince: monthYearLabel(user.createdAt),
    },
    counts,
    byType,
    taste,
    friends: {
      followingCount: followingIds.length,
      followersCount,
      following: followingIds
        .slice(0, FOLLOWING_SHOWN)
        .map((id) => followingProfiles.get(id))
        .filter((profile): profile is PublicUserProfile => Boolean(profile)),
      topMatch: topMatch
        ? {
            userId: topMatch.userId,
            displayName: topMatch.displayName,
            image: topMatch.image,
            avatarColor: topMatch.avatarColor,
            compatibilityScore: topMatch.compatibilityScore,
            overlapCount: topMatch.overlapCount,
          }
        : null,
    },
    notes: { total: notesTotal, recent: recentNotes },
  };
}
