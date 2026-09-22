import { MediaType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { leanGenreSelect, leanTagSelect } from "@/lib/db/media-select";
import {
  getRecommendationV2Context,
  scoreCatalogItem,
} from "@/lib/recommendations-v2";
import { calibratedMatch } from "@/lib/scoring/calibration";
import { explicitRating, humanReason } from "@/lib/scoring/recommendationV2";

/**
 * Single-item Medialy Match summary for the media detail page. Distinct from
 * `getRecommendations`, which only scores items the viewer hasn't consumed —
 * here we want to explain the match for *any* item (including ones already
 * watched/in the library). Uses the same v2 engine and calibration, with the
 * title itself removed from the viewer's profile so it cannot explain itself.
 */
export type SimilarTitleGroup = {
  /** Facet name shared by these titles, e.g. "Roguelike" or "Action". */
  facet: string;
  /** "subgenre" or "genre" — drives copy phrasing. */
  facetKind: "subgenre" | "genre";
  titles: string[];
};

export type MediaItemMatchSummary = {
  /** Calibrated Match, 0–100. */
  score: number;
  /** Groups of highly-rated titles sharing a subgenre/genre with this item. */
  similarTitleGroups: SimilarTitleGroup[];
  /** "Because you rated X 9/10" or a creator match, or null. */
  contributorReason: string | null;
};

export async function getMediaItemMatch(
  mediaId: string,
  userId: string | null,
): Promise<MediaItemMatchSummary | null> {
  if (!userId) return null;

  const context = await getRecommendationV2Context(userId);
  const item = context.catalog.find((row) => row.id === mediaId);
  if (!item) return null;

  const subgenreNames = item.tags
    .filter(
      (entry) =>
        entry.tag.category === "SUBGENRE" && entry.tag.status === "APPROVED",
    )
    .map((entry) => entry.tag.name);

  const [scored, similarTitleGroups] = await Promise.all([
    Promise.resolve(scoreCatalogItem(context, item)),
    findSimilarTitleGroups(userId, {
      id: item.id,
      mediaType: item.mediaType,
      genres: item.genres.map((entry) => entry.genre.name),
      subgenres: subgenreNames,
    }),
  ]);

  const similarity = scored.explanations.find((e) => e.signal === "similarity");
  const contributor = scored.explanations.find((e) => e.signal === "contributor");
  let contributorReason: string | null = null;
  if (similarity?.because) {
    contributorReason = humanReason(similarity, context.names);
  } else if (contributor && contributor.contribution > 0) {
    contributorReason = humanReason(contributor, context.names);
  }

  return {
    score: calibratedMatch(scored.score),
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
      rating:
        row.computedPersonalScore ?? explicitRating(row.personalRating) ?? 0,
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
