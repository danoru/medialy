import type { ContributorKind, CreditRole, MediaType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildOverallTopRankingContext,
  dashboardQualityScore,
  type OverallTopRankingContext,
} from "@/lib/db/dashboard";
import { CREDIT_ROLES_BY_MEDIA_TYPE } from "@/lib/credits";
import {
  getPromotedDiscoverTagsForMediaType,
  isDiscoverSubgenreForGenre,
} from "@/lib/taxonomy";

/** The headline contributor for a card — director / creator / studio. */
export type CanonLeadCredit = { role: CreditRole; name: string };

/** How many entries a Canon list (overall or per-genre) shows. */
export const CANON_LIMIT = 50;
/** How many items each genre shelf previews on the overview. */
export const CANON_SHELF_SIZE = 12;
/** A genre needs at least this many scored items to earn a shelf. */
export const CANON_SHELF_MIN_ITEMS = 4;

/** Display + grouping fields for one ranked item, score attached. */
export type CanonItem = {
  id: string;
  title: string;
  mediaType: MediaType;
  posterUrl: string | null;
  year: number | null;
  /** Primary genres plus any promoted discover tags treated as genres. */
  genres: string[];
  /** Approved, discoverable SUBGENRE tag names allowed for this media type. */
  subgenres: string[];
  /** Headline contributor (director/creator/studio), if known. */
  leadCredit: CanonLeadCredit | null;
  /** Objective quality score (0–10), same scale as the dashboard Overall Top. */
  score: number;
  /** Total evidence backing the score; breaks ties between equal scores. */
  evidence: number;
};

/** Pre-score candidate — everything {@link CanonItem} needs minus the score. */
export type CanonCandidate = Omit<CanonItem, "score" | "evidence"> & {
  computedConsensusScore: number | null;
};

export type CanonGenreShelf = {
  genre: string;
  items: CanonItem[];
  total: number;
};

export type CanonData =
  | {
      mode: "overall";
      overall: CanonItem[];
      shelves: CanonGenreShelf[];
    }
  | {
      mode: "genre";
      genre: string;
      subgenre: string | null;
      subgenres: string[];
      items: CanonItem[];
    };

/**
 * Same ordering the dashboard's Overall Top uses: quality desc, then total
 * evidence desc (broader sample wins a tie), then title for stability.
 */
export function compareCanonItems(a: CanonItem, b: CanonItem) {
  const scoreDelta = b.score - a.score;
  if (scoreDelta !== 0) return scoreDelta;
  const evidenceDelta = b.evidence - a.evidence;
  if (evidenceDelta !== 0) return evidenceDelta;
  return a.title.localeCompare(b.title);
}

/**
 * Scores every candidate via {@link dashboardQualityScore}, drops items with
 * no objective signal (no community rating and no consensus), and returns the
 * rest sorted by {@link compareCanonItems}.
 */
export function rankCanonItems(
  candidates: CanonCandidate[],
  context: OverallTopRankingContext,
): CanonItem[] {
  return candidates
    .flatMap((candidate) => {
      const ranked = dashboardQualityScore(
        candidate.computedConsensusScore,
        context.communityByMediaId.get(candidate.id),
        context.consensusByMediaId.get(candidate.id),
        context.globalCommunityMean,
        context.globalConsensusMean,
      );
      if (ranked == null) return [];
      return [
        {
          id: candidate.id,
          title: candidate.title,
          mediaType: candidate.mediaType,
          posterUrl: candidate.posterUrl,
          year: candidate.year,
          genres: candidate.genres,
          subgenres: candidate.subgenres,
          leadCredit: candidate.leadCredit,
          score: ranked.score,
          evidence: ranked.evidence,
        },
      ];
    })
    .sort(compareCanonItems);
}

/**
 * Groups a ranked list into per-genre shelves. Each item appears under every
 * genre it belongs to. Genres below `minItems` are skipped; shelves are sorted
 * by total scored items desc, then genre name.
 */
export function buildGenreShelves(
  ranked: CanonItem[],
  { shelfSize, minItems }: { shelfSize: number; minItems: number },
): CanonGenreShelf[] {
  const byGenre = new Map<string, CanonItem[]>();
  for (const item of ranked) {
    for (const genre of item.genres) {
      const current = byGenre.get(genre) ?? [];
      current.push(item);
      byGenre.set(genre, current);
    }
  }

  return [...byGenre.entries()]
    .filter(([, items]) => items.length >= minItems)
    .map(([genre, items]) => ({
      genre,
      items: items.slice(0, shelfSize),
      total: items.length,
    }))
    .sort(
      (first, second) =>
        second.total - first.total || first.genre.localeCompare(second.genre),
    );
}

/** Ranked items in `genre`, optionally narrowed to a `subgenre` tag. */
export function itemsForGenre(
  ranked: CanonItem[],
  genre: string,
  subgenre?: string | null,
): CanonItem[] {
  return ranked.filter(
    (item) =>
      item.genres.includes(genre) &&
      (!subgenre || item.subgenres.includes(subgenre)),
  );
}

/**
 * Subgenre filter options for a genre: the subgenre tags present on its items
 * that the taxonomy recognises for this media type + genre, ordered by how
 * many items carry them.
 */
export function subgenreOptions(
  ranked: CanonItem[],
  mediaType: MediaType,
  genre: string,
): string[] {
  const counts = new Map<string, number>();
  for (const item of ranked) {
    if (!item.genres.includes(genre)) continue;
    for (const subgenre of item.subgenres) {
      if (!isDiscoverSubgenreForGenre(mediaType, genre, subgenre)) continue;
      counts.set(subgenre, (counts.get(subgenre) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(
      (first, second) =>
        second[1] - first[1] || first[0].localeCompare(second[0]),
    )
    .map(([name]) => name)
    .slice(0, 18);
}

type CanonPoolRow = {
  id: string;
  title: string;
  mediaType: MediaType;
  posterUrl: string | null;
  releaseDate: Date | null;
  computedConsensusScore: number | null;
  genres: { genre: { name: string } }[];
  tags: {
    tag: {
      name: string;
      status: string;
      category: string;
      discoverable: boolean;
      mediaTypesJson: string | null;
    };
  }[];
  credits?: {
    role: CreditRole;
    order: number;
    contributor: { name: string; kind: ContributorKind };
  }[];
};

/**
 * The headline credit for a card: the first non-ACTOR role the media type
 * recognises (director / creator / developer), with up to two names joined.
 */
export function pickLeadCredit(
  mediaType: MediaType,
  credits: NonNullable<CanonPoolRow["credits"]>,
): CanonLeadCredit | null {
  for (const role of CREDIT_ROLES_BY_MEDIA_TYPE[mediaType]) {
    if (role === "ACTOR") continue;
    const names = credits
      .filter((credit) => credit.role === role)
      .sort((first, second) => first.order - second.order)
      .map((credit) => credit.contributor.name);
    if (names.length > 0) {
      return { role, name: names.slice(0, 2).join(", ") };
    }
  }
  return null;
}

function tagAllowsMediaType(mediaTypesJson: string | null, mediaType: MediaType) {
  if (!mediaTypesJson) return true;
  try {
    const mediaTypes = JSON.parse(mediaTypesJson);
    return Array.isArray(mediaTypes) && mediaTypes.includes(mediaType);
  } catch {
    return false;
  }
}

/** Turns a raw pool row into a scoring candidate (genre universe matches Discover). */
export function toCanonCandidate(
  row: CanonPoolRow,
  mediaType: MediaType,
): CanonCandidate {
  const genres = new Set(row.genres.map((entry) => entry.genre.name));

  // Promote the same discover tags Discover treats as genre-level lanes.
  const promoted = new Map(
    getPromotedDiscoverTagsForMediaType(mediaType).map((name) => [
      name.toLowerCase(),
      name,
    ]),
  );
  const subgenres: string[] = [];
  for (const entry of row.tags) {
    const tag = entry.tag;
    if (tag.status !== "APPROVED") continue;
    const canonical = promoted.get(tag.name.toLowerCase());
    if (canonical) genres.add(canonical);
    if (
      tag.category === "SUBGENRE" &&
      tag.discoverable &&
      tagAllowsMediaType(tag.mediaTypesJson, mediaType)
    ) {
      subgenres.push(tag.name);
    }
  }

  return {
    id: row.id,
    title: row.title,
    mediaType: row.mediaType,
    posterUrl: row.posterUrl,
    year: row.releaseDate ? new Date(row.releaseDate).getFullYear() : null,
    genres: [...genres],
    subgenres,
    leadCredit: pickLeadCredit(mediaType, row.credits ?? []),
    computedConsensusScore: row.computedConsensusScore,
  };
}

/**
 * Loads the Canon for a media type. The candidate pool is global (no archive
 * filter) so the ranking is the same for every viewer, matching the dashboard
 * Overall Top. With `genre` set it returns the deep per-genre list; otherwise
 * the overview (top overall + per-genre shelves).
 */
export async function getCanonData({
  type,
  genre,
  subgenre,
}: {
  type: MediaType;
  genre?: string | null;
  subgenre?: string | null;
}): Promise<CanonData> {
  const [pool, context] = await Promise.all([
    prisma.mediaItem.findMany({
      where: { mediaType: type },
      select: {
        id: true,
        title: true,
        mediaType: true,
        posterUrl: true,
        releaseDate: true,
        computedConsensusScore: true,
        genres: { select: { genre: { select: { name: true } } } },
        tags: {
          select: {
            tag: {
              select: {
                name: true,
                status: true,
                category: true,
                discoverable: true,
                mediaTypesJson: true,
              },
            },
          },
        },
        credits: {
          select: {
            role: true,
            order: true,
            contributor: { select: { name: true, kind: true } },
          },
          orderBy: { order: "asc" },
        },
      },
    }),
    buildOverallTopRankingContext(),
  ]);

  const ranked = rankCanonItems(
    pool.map((row) => toCanonCandidate(row, type)),
    context,
  );

  if (genre) {
    return {
      mode: "genre",
      genre,
      subgenre: subgenre ?? null,
      subgenres: subgenreOptions(ranked, type, genre),
      items: itemsForGenre(ranked, genre, subgenre).slice(0, CANON_LIMIT),
    };
  }

  return {
    mode: "overall",
    overall: ranked.slice(0, CANON_LIMIT),
    shelves: buildGenreShelves(ranked, {
      shelfSize: CANON_SHELF_SIZE,
      minItems: CANON_SHELF_MIN_ITEMS,
    }),
  };
}
