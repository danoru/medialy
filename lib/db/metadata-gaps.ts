import type { CreditRole, MediaType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CREDIT_ROLES_BY_MEDIA_TYPE } from "@/lib/credits";
import { MAX_GENRES_PER_ITEM } from "@/lib/data/genre";
import { getGenresForMediaType, normalizeGenreName } from "@/lib/taxonomy";
import { normalizeComparableTitle } from "@/lib/text-normalization";

/**
 * Catalog checks for missing or suspect metadata, behind the admin Data Health
 * page.
 *
 * Every check is a `where` clause, so the page asks Postgres for a count per
 * check and one page of rows for the open check — never the whole catalog
 * with its relations (see the Neon egress budget in lib/cache.ts). Rows come
 * back most-tracked first, so the titles people actually look at get fixed
 * first.
 */

export const METADATA_GAP_PAGE_SIZE = 50;

export type MetadataGapKey =
  | "missing-genres"
  | "one-genre"
  | "invalid-genre"
  | "too-many-genres"
  | `missing-${Lowercase<CreditRole>}`
  | "missing-date"
  | "missing-poster"
  | "missing-description"
  | "missing-critic-score";

export type MetadataGapCheck = {
  key: MetadataGapKey;
  label: string;
  description: string;
  /** Which section of the checklist the check sits in. */
  group: "genres" | "credits" | "details";
};

const CREDIT_LABEL: Record<CreditRole, string> = {
  DIRECTOR: "director",
  CREATOR: "creator",
  DEVELOPER: "developer",
  PUBLISHER: "publisher",
  ACTOR: "cast",
};

/** Genre names a title of this type may carry. */
export function validGenresFor(mediaType: MediaType): string[] {
  return getGenresForMediaType(mediaType).filter(
    (genre) => normalizeGenreName(genre, mediaType) === genre,
  );
}

/** The checks that apply to a media type, in display order. */
export function metadataGapChecks(mediaType: MediaType): MetadataGapCheck[] {
  const hasGenres = validGenresFor(mediaType).length > 0;
  const genreChecks: MetadataGapCheck[] = hasGenres
    ? [
        {
          key: "missing-genres",
          label: "No genres",
          description: "Titles with no genre at all.",
          group: "genres",
        },
        {
          key: "one-genre",
          label: "Only one genre",
          description:
            "A single genre is often a partial import; most titles carry two or three.",
          group: "genres",
        },
        {
          key: "invalid-genre",
          label: "Genre not valid for this type",
          description:
            "Carries a genre outside this type's list, such as a game genre on a film.",
          group: "genres",
        },
        {
          key: "too-many-genres",
          label: `More than ${MAX_GENRES_PER_ITEM} genres`,
          description: `Titles over the ${MAX_GENRES_PER_ITEM}-genre limit, usually from an older import.`,
          group: "genres",
        },
      ]
    : [];
  const creditChecks = CREDIT_ROLES_BY_MEDIA_TYPE[mediaType].map(
    (role): MetadataGapCheck => ({
      key: `missing-${role.toLowerCase() as Lowercase<CreditRole>}`,
      label: `No ${CREDIT_LABEL[role]}`,
      description: `Titles with no ${CREDIT_LABEL[role]} credited.`,
      group: "credits",
    }),
  );
  const detailChecks: MetadataGapCheck[] = [
    {
      key: "missing-date",
      label: "No release date",
      description: "Undated titles drop out of year filters and Upcoming.",
      group: "details",
    },
    {
      key: "missing-poster",
      label: "No poster",
      description: "Shown as a blank tile everywhere.",
      group: "details",
    },
    {
      key: "missing-description",
      label: "No description",
      description: "The detail page has no synopsis.",
      group: "details",
    },
    {
      key: "missing-critic-score",
      label: "No critic score",
      description:
        "No external ratings, so the Medialy score rests on user ratings alone.",
      group: "details",
    },
  ];
  return [...genreChecks, ...creditChecks, ...detailChecks];
}

export function isMetadataGapKey(
  mediaType: MediaType,
  value: string | null | undefined,
): value is MetadataGapKey {
  return metadataGapChecks(mediaType).some((check) => check.key === value);
}

async function gapWhere(
  mediaType: MediaType,
  key: MetadataGapKey,
): Promise<Prisma.MediaItemWhereInput> {
  const base = { mediaType };
  const creditRole = CREDIT_ROLE_BY_KEY.get(key);
  if (creditRole) return { ...base, credits: { none: { role: creditRole } } };

  switch (key) {
    case "missing-genres":
      return { ...base, genres: { none: {} } };
    // Prisma can't count a relation inside a `where`, so the two count-based
    // genre checks resolve ids with a GROUP BY first.
    case "one-genre":
      return {
        ...base,
        id: { in: await genreCountIds(mediaType, { equals: 1 }) },
      };
    case "too-many-genres":
      return {
        ...base,
        id: { in: await genreCountIds(mediaType, { gt: MAX_GENRES_PER_ITEM }) },
      };
    case "invalid-genre":
      return {
        ...base,
        genres: {
          some: { genre: { name: { notIn: validGenresFor(mediaType) } } },
        },
      };
    case "missing-date":
      return { ...base, releaseDate: null };
    case "missing-poster":
      return { ...base, OR: [{ posterUrl: null }, { posterUrl: "" }] };
    case "missing-description":
      return { ...base, OR: [{ description: null }, { description: "" }] };
    case "missing-critic-score":
      return { ...base, computedConsensusScore: null };
    default:
      return base;
  }
}

const CREDIT_ROLE_BY_KEY = new Map<string, CreditRole>(
  (Object.keys(CREDIT_LABEL) as CreditRole[]).map((role) => [
    `missing-${role.toLowerCase()}`,
    role,
  ]),
);

async function genreCountIds(
  mediaType: MediaType,
  count: { equals: number } | { gt: number },
): Promise<string[]> {
  const rows = await prisma.mediaGenre.groupBy({
    by: ["mediaId"],
    where: { media: { mediaType } },
    having: { mediaId: { _count: count } },
  });
  return rows.map((row) => row.mediaId);
}

/** One count per check for a media type. */
export async function getMetadataGapCounts(
  mediaType: MediaType,
): Promise<Record<string, number>> {
  const checks = metadataGapChecks(mediaType);
  const counts = await Promise.all(
    checks.map(async (check) =>
      prisma.mediaItem.count({ where: await gapWhere(mediaType, check.key) }),
    ),
  );
  return Object.fromEntries(
    checks.map((check, index) => [check.key, counts[index]]),
  );
}

export type MetadataGapRow = Awaited<
  ReturnType<typeof getMetadataGapItems>
>["items"][number];

/**
 * One page of titles failing a check, with just enough context to judge them
 * at a glance: year, poster, current genres and credits.
 */
export async function getMetadataGapItems(
  mediaType: MediaType,
  key: MetadataGapKey,
  page = 1,
) {
  const where = await gapWhere(mediaType, key);
  const total = await prisma.mediaItem.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / METADATA_GAP_PAGE_SIZE));
  // A stale link past the end (items got fixed) lands on the last page.
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const items = await prisma.mediaItem.findMany({
    where,
    select: {
      id: true,
      title: true,
      releaseDate: true,
      posterUrl: true,
      genres: { select: { genre: { select: { name: true } } } },
      credits: {
        select: {
          role: true,
          contributor: { select: { name: true } },
        },
        orderBy: { order: "asc" },
        take: 6,
      },
      _count: { select: { userMedia: true } },
    },
    orderBy: [{ userMedia: { _count: "desc" } }, { title: "asc" }],
    skip: (safePage - 1) * METADATA_GAP_PAGE_SIZE,
    take: METADATA_GAP_PAGE_SIZE,
  });
  return { total, page: safePage, pageCount, items };
}

export type DuplicateCandidateGroup = {
  key: string;
  title: string;
  year: number | null;
  items: Array<{ id: string; title: string }>;
};

/**
 * Same normalized title, type and year. Needs JS title normalization, so it
 * reads titles for one media type — three narrow columns, no relations.
 */
export async function getDuplicateCandidates(
  mediaType: MediaType,
): Promise<DuplicateCandidateGroup[]> {
  const rows = await prisma.mediaItem.findMany({
    where: { mediaType },
    select: { id: true, title: true, releaseDate: true },
    orderBy: { title: "asc" },
  });
  const groups = new Map<string, DuplicateCandidateGroup>();
  for (const row of rows) {
    const year = row.releaseDate ? row.releaseDate.getUTCFullYear() : null;
    const key = `${normalizeComparableTitle(row.title)}::${year ?? "unknown"}`;
    const group = groups.get(key) ?? { key, title: row.title, year, items: [] };
    group.items.push({ id: row.id, title: row.title });
    groups.set(key, group);
  }
  return [...groups.values()].filter((group) => group.items.length > 1);
}
