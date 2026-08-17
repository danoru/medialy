import { cache } from "react";
import { unstable_cache } from "next/cache";
import type {
  ContributorKind,
  CreditRole,
  MediaType,
  TagCategory,
  TagStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CATALOG_CACHE_TAG,
  FULL_CATALOG_REVALIDATE_SECONDS,
} from "@/lib/cache";
import { VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import { LEAN_MEDIA_WITH_CREDITS_SELECT } from "@/lib/db/media-select";
import { DEFAULT_USER_MEDIA, type UserMediaFields } from "@/lib/db/user-media";

/**
 * The shared catalog read.
 *
 * The dashboard used to scan the whole `MediaItem` table three times per render
 * — once for the Overall Top pool, once for recommendations, once for genre
 * insights — each with its own relation joins. The rows are identical every
 * time; only the per-viewer `UserMedia` join and the `where` filters differed.
 *
 * So we split the read in two:
 *
 *  - the catalog *shape* (titles, taxonomy, credits, consensus scores) is the
 *    same for every viewer, so it's fetched once and cached across requests via
 *    `unstable_cache`, exactly like `getCanonData` in `@/lib/db/canon`;
 *  - the viewer's own `UserMedia` rows are fetched separately, per request and
 *    uncached, so status/rating/archive edits are never stale.
 *
 * Callers that previously issued their own filtered `findMany` now filter the
 * merged rows in JS. That keeps steady-state catalog egress at roughly one lean
 * scan per `FULL_CATALOG_REVALIDATE_SECONDS`, no matter how many pages are
 * viewed — see that constant for why this window is longer than Canon's.
 *
 * Staleness bound: shared catalog *metadata* edits (a retitled item, a new
 * poster, changed genres) can take up to the revalidate window to appear on
 * pages that read through here. That's the same trade Canon and the ranking
 * aggregates already make. Personal data is never cached.
 *
 * ## Why the payload is stored normalized, one entry per media type
 *
 * `unstable_cache` refuses entries over 2 MB, and it fails *loudly but
 * harmlessly* — the read still returns rows, the write is dropped, so the cache
 * silently never hits and you get an unhandled rejection per request. The
 * denormalized catalog encodes to ~2.1 MB, just over the line.
 *
 * Two things keep entries well clear of it. Tag and contributor records repeat
 * across thousands of rows, so they're stored once in a dictionary and
 * referenced by name/id (~30% smaller). And each media type is its own entry, so
 * a growing movie library can't drag the other types over the limit with it.
 * `expandCatalogEntry` rebuilds the nested shape on read.
 */

type CachedTag = {
  name: string;
  status: TagStatus;
  category: TagCategory;
  discoverable: boolean;
  mediaTypesJson: string | null;
  countryCode: string | null;
};

type CachedContributor = {
  id: string;
  name: string;
  kind: ContributorKind;
};

/** `[role, order, contributorId]` — positional to keep the payload small. */
type CachedCredit = [CreditRole, number, string];

type CachedCatalogEntry = {
  tags: CachedTag[];
  contributors: CachedContributor[];
  items: Array<{
    id: string;
    title: string;
    originalTitle: string | null;
    mediaType: MediaType;
    releaseDate: string | null;
    posterUrl: string | null;
    externalUrl: string | null;
    computedConsensusScore: number | null;
    consensusConfidence: number;
    updatedAt: string;
    g: string[];
    t: string[];
    c: CachedCredit[];
  }>;
};

/** A catalog row in the shape callers consume — nested relations, real dates. */
export type CatalogItem = {
  id: string;
  title: string;
  originalTitle: string | null;
  mediaType: MediaType;
  releaseDate: Date | null;
  posterUrl: string | null;
  externalUrl: string | null;
  computedConsensusScore: number | null;
  consensusConfidence: number;
  updatedAt: Date;
  genres: Array<{ genre: { name: string } }>;
  tags: Array<{ tag: CachedTag }>;
  credits: Array<{
    role: CreditRole;
    order: number;
    contributor: CachedContributor;
  }>;
};

/** A catalog row with the viewer's per-user fields flattened on top. */
export type CatalogItemWithUser = CatalogItem & UserMediaFields;

/**
 * Viewer-independent and cached across requests. Nothing user-scoped may enter
 * this function — the cache key is the media type and nothing else.
 */
const getCachedCatalogEntry = unstable_cache(
  async (mediaType: MediaType): Promise<CachedCatalogEntry> => {
    const rows = await prisma.mediaItem.findMany({
      where: { mediaType },
      select: LEAN_MEDIA_WITH_CREDITS_SELECT,
      orderBy: [{ title: "asc" }],
    });

    const tags = new Map<string, CachedTag>();
    const contributors = new Map<string, CachedContributor>();
    const items = rows.map((row) => {
      for (const entry of row.tags) {
        if (!tags.has(entry.tag.name)) tags.set(entry.tag.name, entry.tag);
      }
      for (const entry of row.credits) {
        if (!contributors.has(entry.contributor.id)) {
          contributors.set(entry.contributor.id, entry.contributor);
        }
      }
      return {
        id: row.id,
        title: row.title,
        originalTitle: row.originalTitle,
        mediaType: row.mediaType,
        releaseDate: row.releaseDate ? row.releaseDate.toISOString() : null,
        posterUrl: row.posterUrl,
        externalUrl: row.externalUrl,
        computedConsensusScore: row.computedConsensusScore,
        consensusConfidence: row.consensusConfidence,
        updatedAt: row.updatedAt.toISOString(),
        g: row.genres.map((entry) => entry.genre.name),
        t: row.tags.map((entry) => entry.tag.name),
        c: row.credits.map(
          (entry) =>
            [entry.role, entry.order, entry.contributor.id] as CachedCredit,
        ),
      };
    });

    return {
      tags: [...tags.values()],
      contributors: [...contributors.values()],
      items,
    };
  },
  ["catalog-items"],
  { revalidate: FULL_CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] },
);

/** Rebuilds the nested, date-typed rows from a compact cache entry. */
function expandCatalogEntry(entry: CachedCatalogEntry): CatalogItem[] {
  const tagsByName = new Map(entry.tags.map((tag) => [tag.name, tag]));
  const contributorsById = new Map(
    entry.contributors.map((contributor) => [contributor.id, contributor]),
  );

  return entry.items.map((item) => ({
    id: item.id,
    title: item.title,
    originalTitle: item.originalTitle,
    mediaType: item.mediaType,
    releaseDate: item.releaseDate ? new Date(item.releaseDate) : null,
    posterUrl: item.posterUrl,
    externalUrl: item.externalUrl,
    computedConsensusScore: item.computedConsensusScore,
    consensusConfidence: item.consensusConfidence,
    updatedAt: new Date(item.updatedAt),
    genres: item.g.map((name) => ({ genre: { name } })),
    tags: item.t.flatMap((name) => {
      const tag = tagsByName.get(name);
      return tag ? [{ tag }] : [];
    }),
    credits: item.c.flatMap(([role, order, contributorId]) => {
      const contributor = contributorsById.get(contributorId);
      return contributor ? [{ role, order, contributor }] : [];
    }),
  }));
}

/** Every visible-type catalog row, memoized for the life of the request. */
export const getCatalogItems = cache(async (): Promise<CatalogItem[]> => {
  const entries = await Promise.all(
    VISIBLE_MEDIA_TYPES.map((mediaType) => getCachedCatalogEntry(mediaType)),
  );
  return entries.flatMap(expandCatalogEntry);
});

/**
 * The viewer's `UserMedia` rows, keyed by media id. Per request, never cached
 * across requests — this is the data that must reflect edits immediately.
 */
export const getUserMediaMap = cache(
  async (userId: string | null): Promise<Map<string, UserMediaFields>> => {
    if (!userId || userId === "__anonymous__") return new Map();
    const rows = await prisma.userMedia.findMany({
      where: { userId },
      select: {
        mediaId: true,
        status: true,
        personalRating: true,
        computedPersonalScore: true,
        personalScoreConfidence: true,
        pairwiseScore: true,
        comparisonCount: true,
        isFavorite: true,
        isArchived: true,
      },
    });
    return new Map(
      rows.map(({ mediaId, ...fields }) => [mediaId, fields as UserMediaFields]),
    );
  },
);

/**
 * The catalog with this viewer's per-user fields merged on. Memoized per
 * request, so several consumers in one render share a single pair of reads.
 */
export const getCatalogWithUser = cache(
  async (userId: string | null): Promise<CatalogItemWithUser[]> => {
    const [items, userMedia] = await Promise.all([
      getCatalogItems(),
      getUserMediaMap(userId),
    ]);
    return items.map((item) => ({
      ...item,
      ...(userMedia.get(item.id) ?? DEFAULT_USER_MEDIA),
    }));
  },
);
