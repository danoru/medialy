import { MediaType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  leanCreditsSelect,
  leanGenreSelect,
  leanTagSelect,
} from "@/lib/db/media-select";
import { AFFINITY_TUNING } from "@/lib/scoring/config";
import { saturate } from "@/lib/scoring/affinity";
import { calculateMedialyMatch } from "@/lib/scoring/medialyMatch";
import {
  getAffinityMaps,
  buildContributorDetail,
  getFollowedUserRatingsByMedia,
  getFollowerCompatibilityMap,
  computeFriendSignal,
} from "@/lib/recommendations";

/**
 * Single-item Medialy Match summary for the media detail page. Distinct from
 * `getRecommendations`, which only scores items the viewer hasn't consumed —
 * here we want to explain the match for *any* item (including ones already
 * watched/in the library).
 */
export type SimilarTitleGroup = {
  /** Facet name shared by these titles, e.g. "Roguelike" or "Action". */
  facet: string;
  /** "subgenre" or "genre" — drives copy phrasing. */
  facetKind: "subgenre" | "genre";
  titles: string[];
};

export type MediaItemMatchSummary = {
  score: number;
  /** Groups of highly-rated titles sharing a subgenre/genre with this item. */
  similarTitleGroups: SimilarTitleGroup[];
  /** "Director X — you rated Y 9/10" or null when no contributor match. */
  contributorReason: string | null;
};

export async function getMediaItemMatch(
  mediaId: string,
  userId: string | null,
): Promise<MediaItemMatchSummary | null> {
  if (!userId) return null;

  const item = await prisma.mediaItem.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      mediaType: true,
      computedConsensusScore: true,
      genres: leanGenreSelect,
      tags: { where: { tag: { status: "APPROVED" } }, ...leanTagSelect },
      credits: leanCreditsSelect,
    },
  });
  if (!item) return null;

  // These three reads are independent — the affinity pool, the followed-user
  // ratings for this item, and the similar-title groups — so fire them together
  // instead of serially. `followerCompatibility` alone depends on the followed
  // ratings, so it stays sequential after them.
  const subgenreNames = item.tags
    .filter((entry) => entry.tag.category === "SUBGENRE")
    .map((entry) => entry.tag.name);

  const [affinity, followedRatingsByMedia, similarTitleGroups] =
    await Promise.all([
      getAffinityMaps(userId, { excludeMediaId: mediaId }),
      getFollowedUserRatingsByMedia(userId, [mediaId]),
      findSimilarTitleGroups(userId, {
        id: item.id,
        mediaType: item.mediaType,
        genres: item.genres.map((entry) => entry.genre.name),
        subgenres: subgenreNames,
      }),
    ]);

  const genreRaw = item.genres.reduce(
    (total, entry) => total + (affinity.genres.get(entry.genre.name) ?? 0),
    0,
  );
  const tagRaw = item.tags.reduce(
    (total, entry) => total + (affinity.tags.get(entry.tag.name) ?? 0),
    0,
  );
  const contributorRaw = item.credits.reduce(
    (total, entry) =>
      total + (affinity.contributors.get(entry.contributor.id)?.weight ?? 0),
    0,
  );

  // Friend signal computed the same way `getRecommendations` does so the
  // detail-page Medialy Match matches the dashboard/recommendations number.
  // friendAffinity carries 30% of the weight; passing 0 here would understate
  // the score for items rated by followed users. `followedRatingsByMedia` was
  // loaded above; only the compatibility map depends on it.
  const followerCompatibility = await getFollowerCompatibilityMap(
    userId,
    followedRatingsByMedia,
  );
  const friendSignal = computeFriendSignal(
    followedRatingsByMedia.get(mediaId) ?? [],
    followerCompatibility,
  );

  const match = calculateMedialyMatch({
    genreAffinity: saturate(genreRaw, AFFINITY_TUNING.saturationK.genre),
    tagAffinity: saturate(tagRaw, AFFINITY_TUNING.saturationK.tag),
    contributorAffinity: saturate(
      contributorRaw,
      AFFINITY_TUNING.saturationK.contributor,
    ),
    friendAffinity: friendSignal.value,
    consensusScore: item.computedConsensusScore,
  });

  const contributorReason =
    buildContributorDetail(
      item.credits.map((credit) => ({
        contributor: { id: credit.contributor.id },
        role: credit.role,
      })),
      affinity,
      item.mediaType,
    ) ?? null;

  // `similarTitleGroups` was loaded in the parallel batch above.
  return {
    score: match.score,
    similarTitleGroups,
    contributorReason,
  };
}

const MAX_GROUPS = 3;
const MAX_TITLES_PER_GROUP = 3;

async function findSimilarTitleGroups(
  userId: string,
  reference: {
    id: string;
    mediaType: string;
    genres: string[];
    subgenres: string[];
  },
): Promise<
  Array<{
    facet: string;
    facetKind: "subgenre" | "genre";
    titles: string[];
  }>
> {
  if (reference.genres.length === 0 && reference.subgenres.length === 0) {
    return [];
  }
  const rated = await prisma.userMedia.findMany({
    where: {
      userId,
      isArchived: false,
      mediaId: { not: reference.id },
      media: {
        mediaType: reference.mediaType as MediaType,
        OR: [
          { genres: { some: { genre: { name: { in: reference.genres } } } } },
          {
            tags: {
              some: {
                tag: {
                  status: "APPROVED",
                  category: "SUBGENRE",
                  name: { in: reference.subgenres },
                },
              },
            },
          },
        ],
      },
      OR: [
        { personalRating: { gte: 8 } },
        { computedPersonalScore: { gte: 8 } },
      ],
    },
    select: {
      computedPersonalScore: true,
      personalRating: true,
      media: {
        select: {
          title: true,
          genres: leanGenreSelect,
          tags: { where: { tag: { status: "APPROVED" } }, ...leanTagSelect },
        },
      },
    },
    take: 120,
  });

  type Entry = {
    title: string;
    rating: number;
    subgenres: Set<string>;
    genres: Set<string>;
  };
  const entries: Entry[] = rated
    .map((row) => ({
      title: row.media.title,
      rating: row.computedPersonalScore ?? row.personalRating ?? 0,
      genres: new Set(row.media.genres.map((entry) => entry.genre.name)),
      subgenres: new Set(
        row.media.tags
          .filter((entry) => entry.tag.category === "SUBGENRE")
          .map((entry) => entry.tag.name),
      ),
    }))
    .sort((a, b) => b.rating - a.rating);

  type Bucket = {
    facet: string;
    facetKind: "subgenre" | "genre";
    titles: string[];
  };
  const buckets: Bucket[] = [];
  const usedTitles = new Set<string>();

  // Subgenres first (more specific), then genres as fallback.
  const facets: Array<{ name: string; kind: "subgenre" | "genre" }> = [
    ...reference.subgenres.map((name) => ({
      name,
      kind: "subgenre" as const,
    })),
    ...reference.genres.map((name) => ({ name, kind: "genre" as const })),
  ];

  for (const facet of facets) {
    if (buckets.length >= MAX_GROUPS) break;
    const matching = entries.filter((entry) => {
      if (usedTitles.has(entry.title)) return false;
      return facet.kind === "subgenre"
        ? entry.subgenres.has(facet.name)
        : entry.genres.has(facet.name);
    });
    if (matching.length === 0) continue;
    const titles: string[] = [];
    for (const entry of matching) {
      if (titles.length >= MAX_TITLES_PER_GROUP) break;
      titles.push(entry.title);
      usedTitles.add(entry.title);
    }
    buckets.push({ facet: facet.name, facetKind: facet.kind, titles });
  }

  return buckets;
}
