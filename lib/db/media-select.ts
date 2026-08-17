import type { Prisma } from "@prisma/client";

/**
 * Shared Prisma projections for catalog reads.
 *
 * `MediaItem` carries three columns that dwarf everything else on the row —
 * `description`, `metadataJson` (multi-KB TMDB/RAWG/IGDB payloads) and
 * `platformsJson`. Only the media detail page, the edit form and the merge/
 * suggestion flows ever read them, but any `include:` based query drags them
 * along for every row. On full-catalog scans that is the dominant share of the
 * bytes Neon sends us.
 *
 * List/ranking/scoring paths should select through these helpers instead. The
 * pattern (explicit `select` + narrow relation selects) mirrors `getCanonData`
 * in `@/lib/db/canon`, which has always done it this way.
 */

/**
 * Every `MediaItem` scalar the DTO layer needs, minus the three wide columns.
 * Matches the non-optional surface of `MediaItemDTO`, so rows selected this way
 * flow through `toMediaItemDTO` unchanged (`description`/`metadataJson` are
 * optional there and simply come back `undefined`).
 *
 * Deliberately omits `createdAt`/`createdById` too — no list view renders them.
 */
export const LEAN_MEDIA_SELECT = {
  id: true,
  title: true,
  originalTitle: true,
  mediaType: true,
  releaseDate: true,
  posterUrl: true,
  externalUrl: true,
  computedConsensusScore: true,
  consensusConfidence: true,
  updatedAt: true,
} as const satisfies Prisma.MediaItemSelect;

/** Genre names only — the join rows themselves carry nothing else worth sending. */
export const leanGenreSelect = {
  select: { genre: { select: { name: true } } },
} as const;

/**
 * Tag rows with the fields the taxonomy helpers actually read: `status` for
 * approval gating, `category`/`discoverable`/`mediaTypesJson` for the Discover
 * and Canon subgenre lanes, `countryCode` for country affinity. All small
 * columns — the tag row is cheap, it's the media row that isn't.
 */
export const leanTagSelect = {
  select: {
    tag: {
      select: {
        name: true,
        status: true,
        category: true,
        discoverable: true,
        mediaTypesJson: true,
        countryCode: true,
      },
    },
  },
} as const;

/** Credits shaped for `toMediaItemDTO` and the affinity maps (which key on contributor id). */
export const leanCreditsSelect = {
  select: {
    role: true,
    order: true,
    contributor: { select: { id: true, name: true, kind: true } },
  },
  orderBy: { order: "asc" },
} as const satisfies Prisma.MediaItem$creditsArgs;

/** `LEAN_MEDIA_SELECT` plus genres and tags — the shape most list views want. */
export const LEAN_MEDIA_WITH_TAXONOMY_SELECT = {
  ...LEAN_MEDIA_SELECT,
  genres: leanGenreSelect,
  tags: leanTagSelect,
} as const satisfies Prisma.MediaItemSelect;

/** The above plus credits, for scoring paths that weight director/studio affinity. */
export const LEAN_MEDIA_WITH_CREDITS_SELECT = {
  ...LEAN_MEDIA_WITH_TAXONOMY_SELECT,
  credits: leanCreditsSelect,
} as const satisfies Prisma.MediaItemSelect;
