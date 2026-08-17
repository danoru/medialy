import type {
  MediaStatus,
  MediaType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import {
  contributorKey,
  normalizeContributorName,
  replaceMediaCredits,
  type CreditDTO,
} from "@/lib/credits";
import { manualRatingsForMediaType } from "@/lib/external-ratings";
import { prisma } from "@/lib/prisma";
import {
  mergeUserMedia,
  userMediaInclude,
  type UserMediaFields,
} from "@/lib/db/user-media";
import { getCurrentUserId } from "@/lib/user";
import type { MediaFormInput, MediaItemDTO } from "@/lib/types";
import { normalizeSearchText } from "@/lib/text-normalization";
import {
  canonicalTagMetadataForName,
  isTagApplicableForMediaType,
  mediaTypesFromJson,
  normalizeTagKey,
  normalizeTagName,
  tagMetadataAllowsMediaType,
} from "@/lib/taxonomy";

const includeTaxonomy = {
  genres: { include: { genre: true } },
  tags: { include: { tag: true } },
  credits: { include: { contributor: true }, orderBy: { order: "asc" } },
} as const;

/**
 * The shape `toMediaItemDTO` consumes. Scalars beyond the identifying three are
 * optional so rows loaded through the lean catalog projections in
 * `@/lib/db/media-select` (which drop `description`/`metadataJson`) satisfy it
 * just as well as a fully-hydrated `MediaItem` does.
 */
type MediaWithTaxonomy = {
  id: string;
  title: string;
  mediaType: MediaType;
  originalTitle?: string | null;
  description?: string | null;
  releaseDate?: Date | string | null;
  posterUrl?: string | null;
  externalUrl?: string | null;
  metadataJson?: string | null;
  computedConsensusScore?: number | null;
  consensusConfidence?: number | null;
  updatedAt?: Date | string;
  genres: Array<{ genre: { name: string } }>;
  tags: Array<{
    tag: { name: string; status: "APPROVED" | "PENDING" | "REJECTED" };
  }>;
  credits?: Array<{
    role: CreditDTO["role"];
    order: number;
    contributor: { name: string; kind: CreditDTO["kind"] };
  }>;
  externalRatings?: Array<{
    source: import("@prisma/client").ExternalRatingSource;
    score: number;
    scale: number;
  }>;
};

/**
 * `toMediaItemDTO` expects the per-user fields already merged onto the item
 * (via `mergeUserMedia` from `@/lib/db/user-media`). Callers that load
 * MediaItem with `userMediaInclude(userId)` should merge before passing in.
 */
type MediaWithTaxonomyAndUserFields = MediaWithTaxonomy & UserMediaFields;

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function toMediaItemDTO(
  item: MediaWithTaxonomyAndUserFields,
): MediaItemDTO {
  return {
    ...item,
    genres: item.genres.map((entry) => entry.genre.name).sort(),
    tags: item.tags.map((entry) => entry.tag.name).sort(),
    tagDetails: item.tags
      .map((entry) => ({
        name: entry.tag.name,
        status: entry.tag.status,
      }))
      .sort((first, second) => first.name.localeCompare(second.name)),
    credits: (item.credits ?? [])
      .map((credit) => ({
        role: credit.role,
        kind: credit.contributor.kind,
        name: credit.contributor.name,
        order: credit.order,
      }))
      .sort(
        (first, second) =>
          first.role.localeCompare(second.role) || first.order - second.order,
      ),
    externalRatings: item.externalRatings?.map((rating) => ({
      source: rating.source,
      score: rating.score,
      scale: rating.scale,
    })),
  };
}

export async function getMediaItemDTO(id: string) {
  const userId = await getCurrentUserId();
  const item = await prisma.mediaItem.findUnique({
    where: { id },
    include: {
      ...includeTaxonomy,
      ...userMediaInclude(userId),
      externalRatings: {
        select: { source: true, score: true, scale: true },
        orderBy: { source: "asc" },
      },
    },
  });

  return item ? toMediaItemDTO(mergeUserMedia(item)) : null;
}

export async function getMediaItemDTOs(where: Prisma.MediaItemWhereInput = {}) {
  const userId = await getCurrentUserId();
  const items = await prisma.mediaItem.findMany({
    where,
    include: { ...includeTaxonomy, ...userMediaInclude(userId) },
    orderBy: [{ title: "asc" }],
  });

  return items.map((item) => toMediaItemDTO(mergeUserMedia(item)));
}

export async function upsertTaxonomy(
  mediaId: string,
  genres: string[],
  tags: string[],
  mediaType?: MediaType,
) {
  await prisma.mediaGenre.deleteMany({ where: { mediaId } });
  await prisma.mediaTag.deleteMany({ where: { mediaId } });

  for (const name of [...new Set(genres)]) {
    const genre = await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await prisma.mediaGenre.create({ data: { mediaId, genreId: genre.id } });
  }

  const normalizedTags = [
    ...new Map(
      tags
        .map((rawName) => normalizeTagName(rawName))
        .filter(Boolean)
        .map((name) => [normalizeTagKey(name), name]),
    ).values(),
  ];

  for (const name of normalizedTags) {
    const normalizedName = normalizeTagKey(name);
    const existingTag = await prisma.tag.findUnique({
      where: { normalizedName },
    });

    if (existingTag?.status === "REJECTED") continue;

    if (existingTag) {
      if (
        mediaType &&
        !tagMetadataAllowsMediaType(existingTag.mediaTypesJson, mediaType)
      ) {
        const mediaTypes = [
          ...new Set([
            ...mediaTypesFromJson(existingTag.mediaTypesJson),
            mediaType,
          ]),
        ];
        await prisma.tag.update({
          where: { id: existingTag.id },
          data: { mediaTypesJson: JSON.stringify(mediaTypes) },
        });
      }
      await prisma.mediaTag.create({
        data: { mediaId, tagId: existingTag.id },
      });
      continue;
    }

    const metadata = canonicalTagMetadataForName(name);
    if (
      metadata &&
      mediaType &&
      !isTagApplicableForMediaType(name, mediaType)
    ) {
      continue;
    }

    const tag = await prisma.tag.upsert({
      where: { normalizedName },
      update: metadata
        ? {
            category: metadata.category,
            discoverable: metadata.discoverable,
            mediaTypesJson: metadata.mediaTypes
              ? JSON.stringify(metadata.mediaTypes)
              : undefined,
            countryCode: metadata.countryCode,
            status: "APPROVED",
            approvedAt: new Date(),
          }
        : {},
      create: {
        name,
        normalizedName,
        status: metadata ? "APPROVED" : "PENDING",
        category: metadata?.category ?? "THEME",
        discoverable: metadata?.discoverable ?? false,
        mediaTypesJson: metadata?.mediaTypes
          ? JSON.stringify(metadata.mediaTypes)
          : mediaType
            ? JSON.stringify([mediaType])
            : undefined,
        countryCode: metadata?.countryCode,
        approvedAt: metadata ? new Date() : undefined,
      },
    });
    await prisma.mediaTag.create({ data: { mediaId, tagId: tag.id } });
  }
}

export async function upsertMediaRelations(
  mediaId: string,
  input: Pick<MediaFormInput, "genres" | "tags" | "credits" | "mediaType">,
) {
  await upsertTaxonomy(mediaId, input.genres, input.tags, input.mediaType);
  await replaceMediaCredits(prisma, mediaId, input.credits ?? []);
}

/**
 * Reconcile an item's related titles and re-releases to exactly the staged set
 * from the edit form.
 *
 * `undefined` means the caller doesn't manage connections (CSV import), so the
 * existing rows are left alone. An empty array means "there are none" and the
 * rows are removed — the two are deliberately distinct so an import can't
 * silently wipe curated links.
 */
export async function replaceMediaConnections(
  mediaId: string,
  input: Pick<MediaFormInput, "relations" | "releaseEvents">,
) {
  if (input.relations !== undefined) {
    const relations = input.relations
      // An item can't relate to itself, and a self-edge would violate the
      // (fromId, toId, kind) unique constraint in confusing ways.
      .filter((relation) => relation.otherId !== mediaId)
      .map((relation) =>
        relation.direction === "forward"
          ? { fromId: mediaId, toId: relation.otherId, kind: relation.kind }
          : { fromId: relation.otherId, toId: mediaId, kind: relation.kind },
      );

    await prisma.$transaction(async (tx) => {
      await tx.mediaRelation.deleteMany({
        where: { OR: [{ fromId: mediaId }, { toId: mediaId }] },
      });
      if (relations.length > 0) {
        await tx.mediaRelation.createMany({
          data: relations,
          skipDuplicates: true,
        });
      }
    });
  }

  if (input.releaseEvents !== undefined) {
    const events = input.releaseEvents.map((event) => ({
      mediaId,
      kind: event.kind,
      date: new Date(event.date),
      title: event.title,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.mediaReleaseEvent.deleteMany({ where: { mediaId } });
      if (events.length > 0) {
        await tx.mediaReleaseEvent.createMany({ data: events });
      }
    });
  }
}

/**
 * Additive taxonomy upsert for re-imports against an existing MediaItem.
 * Unions the provided genres/tags into the item without deleting any that
 * are already attached — so a Letterboxd re-import (which carries no genre
 * or tag data) cannot wipe data the user already curated.
 */
export async function addImportedTaxonomy(
  mediaId: string,
  genres: string[],
  tags: string[],
  mediaType?: MediaType,
) {
  for (const name of [...new Set(genres)].filter(Boolean)) {
    const genre = await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await prisma.mediaGenre.upsert({
      where: { mediaId_genreId: { mediaId, genreId: genre.id } },
      update: {},
      create: { mediaId, genreId: genre.id },
    });
  }

  const normalizedTags = [
    ...new Map(
      tags
        .map((rawName) => normalizeTagName(rawName))
        .filter(Boolean)
        .map((name) => [normalizeTagKey(name), name]),
    ).values(),
  ];

  for (const name of normalizedTags) {
    const normalizedName = normalizeTagKey(name);
    const existingTag = await prisma.tag.findUnique({
      where: { normalizedName },
    });
    if (existingTag?.status === "REJECTED") continue;

    let tagId: string;
    if (existingTag) {
      if (
        mediaType &&
        !tagMetadataAllowsMediaType(existingTag.mediaTypesJson, mediaType)
      ) {
        const mediaTypes = [
          ...new Set([
            ...mediaTypesFromJson(existingTag.mediaTypesJson),
            mediaType,
          ]),
        ];
        await prisma.tag.update({
          where: { id: existingTag.id },
          data: { mediaTypesJson: JSON.stringify(mediaTypes) },
        });
      }
      tagId = existingTag.id;
    } else {
      const metadata = canonicalTagMetadataForName(name);
      if (
        metadata &&
        mediaType &&
        !isTagApplicableForMediaType(name, mediaType)
      ) {
        continue;
      }
      const created = await prisma.tag.upsert({
        where: { normalizedName },
        update: metadata
          ? {
              category: metadata.category,
              discoverable: metadata.discoverable,
              mediaTypesJson: metadata.mediaTypes
                ? JSON.stringify(metadata.mediaTypes)
                : undefined,
              countryCode: metadata.countryCode,
              status: "APPROVED",
              approvedAt: new Date(),
            }
          : {},
        create: {
          name,
          normalizedName,
          status: metadata ? "APPROVED" : "PENDING",
          category: metadata?.category ?? "THEME",
          discoverable: metadata?.discoverable ?? false,
          mediaTypesJson: metadata?.mediaTypes
            ? JSON.stringify(metadata.mediaTypes)
            : mediaType
              ? JSON.stringify([mediaType])
              : undefined,
          countryCode: metadata?.countryCode,
          approvedAt: metadata ? new Date() : undefined,
        },
      });
      tagId = created.id;
    }

    await prisma.mediaTag.upsert({
      where: { mediaId_tagId: { mediaId, tagId } },
      update: {},
      create: { mediaId, tagId },
    });
  }
}

/**
 * Additive credits upsert for re-imports. Adds any new (role, contributor)
 * pairs from `input.credits` but leaves existing credits in place.
 */
export async function addImportedCredits(
  mediaId: string,
  credits: NonNullable<MediaFormInput["credits"]>,
) {
  if (!credits.length) return;
  const existing = await prisma.mediaCredit.findMany({
    where: { mediaId },
    select: { role: true, contributorId: true, order: true },
  });
  const existingKey = new Set(
    existing.map((entry) => `${entry.role}::${entry.contributorId}`),
  );
  const maxOrderByRole = new Map<string, number>();
  for (const entry of existing) {
    const cur = maxOrderByRole.get(entry.role) ?? -1;
    if (entry.order > cur) maxOrderByRole.set(entry.role, entry.order);
  }

  for (const credit of credits) {
    const uniqueNames = [
      ...new Map(
        credit.names
          .map(normalizeContributorName)
          .filter(Boolean)
          .map((name) => [contributorKey(name), name]),
      ).values(),
    ];
    for (const name of uniqueNames) {
      const contributor = await prisma.contributor.upsert({
        where: {
          normalizedName_kind: {
            normalizedName: contributorKey(name),
            kind: credit.kind,
          },
        },
        update: { name },
        create: {
          name,
          normalizedName: contributorKey(name),
          kind: credit.kind,
        },
      });
      const key = `${credit.role}::${contributor.id}`;
      if (existingKey.has(key)) continue;
      const nextOrder = (maxOrderByRole.get(credit.role) ?? -1) + 1;
      maxOrderByRole.set(credit.role, nextOrder);
      await prisma.mediaCredit.create({
        data: {
          mediaId,
          contributorId: contributor.id,
          role: credit.role,
          order: nextOrder,
        },
      });
      existingKey.add(key);
    }
  }
}

/**
 * Replace the manual external ratings (Metacritic, Rotten Tomatoes) for an
 * item. Any manual source applicable to the item's media type that's absent
 * from `input.externalRatings` is deleted; present ones are upserted. Other
 * sources (e.g. IMDB, TMDB) that aren't user-editable are left untouched.
 */
export async function replaceManualExternalRatings(
  mediaId: string,
  input: Pick<MediaFormInput, "mediaType" | "externalRatings">,
) {
  const applicable = manualRatingsForMediaType(input.mediaType);
  if (applicable.length === 0) return;

  const provided = new Map(
    (input.externalRatings ?? []).map((rating) => [rating.source, rating]),
  );

  for (const def of applicable) {
    const next = provided.get(def.source);
    if (next) {
      await prisma.externalRating.upsert({
        where: { mediaId_source: { mediaId, source: def.source } },
        create: {
          mediaId,
          source: def.source,
          score: next.score,
          scale: next.scale,
        },
        update: {
          score: next.score,
          scale: next.scale,
          fetchedAt: new Date(),
        },
      });
    } else {
      await prisma.externalRating.deleteMany({
        where: { mediaId, source: def.source },
      });
    }
  }
}

export function mediaMutationData(input: MediaFormInput) {
  return {
    title: input.title,
    originalTitle: input.originalTitle || null,
    mediaType: input.mediaType,
    description: input.description || null,
    releaseDate: input.releaseDate,
    externalUrl: input.externalUrl || null,
    metadataJson: input.metadataJson || null,
  };
}

/**
 * Extracts the per-user fields from a `MediaFormInput` so callers can write
 * them to `UserMedia` after creating/updating the underlying `MediaItem`.
 *
 * Fields the input didn't supply are omitted entirely rather than coerced to a
 * default — otherwise saving the metadata form (which no longer collects any of
 * them) would blank out the user's existing rating and status.
 */
export function userMediaMutationData(input: MediaFormInput) {
  const data: {
    status?: MediaStatus;
    personalRating?: number | null;
    isFavorite?: boolean;
  } = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.personalRating !== undefined) {
    data.personalRating = input.personalRating;
  }
  if (input.isFavorite !== undefined) data.isFavorite = input.isFavorite;
  return data;
}

/** Rows `uniqueMediaTitle` needs to detect and resolve title collisions. */
export type TitleCandidate = {
  id: string;
  title: string;
  releaseDate: Date | null;
};

export async function mediaMutationDataWithUniqueTitle(
  client: PrismaLike,
  input: MediaFormInput,
  excludeId?: string,
  options: { candidates?: TitleCandidate[] } = {},
) {
  return {
    ...mediaMutationData(input),
    title: await uniqueMediaTitle(client, input, excludeId, options.candidates),
  };
}

export async function findExistingMediaItem(
  client: PrismaLike,
  input: Pick<MediaFormInput, "title" | "mediaType" | "releaseDate">,
  excludeId?: string,
) {
  const items = await client.mediaItem.findMany({
    where: { mediaType: input.mediaType },
    select: { id: true, title: true, releaseDate: true },
  });
  const inputKey = mediaTitleKey(input.title, input.mediaType);
  const inputYear = mediaReleaseYear(input.releaseDate);

  return (
    items.find((item) => {
      if (item.id === excludeId) return false;
      if (mediaTitleKey(item.title, input.mediaType) !== inputKey) return false;

      const itemYear = mediaReleaseYear(item.releaseDate);
      return !inputYear || !itemYear || inputYear === itemYear;
    }) ?? null
  );
}

/** A `(user, surviving item)` pair whose comparison count we just reduced. */
export type ComparisonPartner = { userId: string; mediaId: string };

/**
 * Delete every `PairwiseComparison` touching `mediaId` and walk back the
 * `comparisonCount` of the items on the other side of those comparisons.
 *
 * Both deleting and merging an item destroy its comparison history — the FKs
 * are `ON DELETE RESTRICT`, so the rows have to go before the item can, and
 * the accumulated Elo on the *partner* items would otherwise keep claiming
 * comparisons that no longer exist, permanently inflating their confidence.
 * The partners' `pairwiseScore` is accumulated rather than derived and can't
 * be unwound exactly; it re-converges as they're compared again.
 *
 * Returns the affected pairs so the caller can recompute their scores once the
 * surrounding transaction has committed.
 */
export async function clearComparisonsForMedia(
  tx: PrismaLike,
  mediaId: string,
): Promise<ComparisonPartner[]> {
  const comparedWith = { OR: [{ winnerId: mediaId }, { loserId: mediaId }] };
  const comparisons = await tx.pairwiseComparison.findMany({
    where: comparedWith,
    select: { userId: true, winnerId: true, loserId: true },
  });

  const affected = new Map<string, ComparisonPartner & { removed: number }>();
  for (const comparison of comparisons) {
    const otherId =
      comparison.winnerId === mediaId
        ? comparison.loserId
        : comparison.winnerId;
    if (otherId === mediaId) continue;
    const key = `${comparison.userId}:${otherId}`;
    const entry = affected.get(key);
    if (entry) entry.removed += 1;
    else
      affected.set(key, {
        userId: comparison.userId,
        mediaId: otherId,
        removed: 1,
      });
  }

  await tx.pairwiseComparison.deleteMany({ where: comparedWith });

  // Group by decrement amount so a heavily-compared item costs a couple of
  // queries rather than two per partner (and blows the transaction timeout).
  const byAmount = new Map<number, ComparisonPartner[]>();
  for (const { userId, mediaId: partnerId, removed } of affected.values()) {
    const pairs = byAmount.get(removed);
    if (pairs) pairs.push({ userId, mediaId: partnerId });
    else byAmount.set(removed, [{ userId, mediaId: partnerId }]);
  }

  for (const [amount, pairs] of byAmount) {
    const where = { OR: pairs };
    // Floor first: a count that somehow lags the stored rows must not go
    // negative. Those rows drop to 0 and so fall out of the decrement below.
    await tx.userMedia.updateMany({
      where: { ...where, comparisonCount: { lt: amount } },
      data: { comparisonCount: 0 },
    });
    await tx.userMedia.updateMany({
      where: { ...where, comparisonCount: { gte: amount } },
      data: { comparisonCount: { decrement: amount } },
    });
  }

  return [...affected.values()].map(({ userId, mediaId: partnerId }) => ({
    userId,
    mediaId: partnerId,
  }));
}

export function mediaTitleBase(value: string) {
  return value
    .trim()
    .replace(/\s+\(\d{4}\)$/, "")
    .replace(/\s+/g, " ");
}

export function mediaTitleKey(value: string, mediaType: MediaType | string) {
  return `${normalizeSearchText(mediaTitleBase(value))}::${String(mediaType).toUpperCase()}`;
}

export function mediaReleaseYear(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear();
}

async function uniqueMediaTitle(
  client: PrismaLike,
  input: MediaFormInput,
  excludeId?: string,
  // Bulk callers (imports) pass a list they already hold, so a batch of rows
  // doesn't re-scan the table once per row.
  candidates?: TitleCandidate[],
) {
  const items =
    candidates ??
    (await client.mediaItem.findMany({
      where: { mediaType: input.mediaType },
      select: { id: true, title: true, releaseDate: true },
    }));
  const inputKey = mediaTitleKey(input.title, input.mediaType);
  const collisions = items.filter(
    (item) =>
      item.id !== excludeId &&
      mediaTitleKey(item.title, input.mediaType) === inputKey,
  );

  if (collisions.length === 0) return input.title;

  const baseTitle = mediaTitleBase(input.title);
  const usedTitles = new Map(
    items.map((item) => [item.title.toLowerCase(), item.id]),
  );

  for (const item of collisions) {
    const year = mediaReleaseYear(item.releaseDate);
    if (!year) continue;

    const nextTitle = availableDatedTitle(baseTitle, year, item.id, usedTitles);
    if (nextTitle === item.title) continue;

    usedTitles.delete(item.title.toLowerCase());
    usedTitles.set(nextTitle.toLowerCase(), item.id);
    await client.mediaItem.update({
      where: { id: item.id },
      data: { title: nextTitle },
    });
  }

  const inputYear = mediaReleaseYear(input.releaseDate);
  if (!inputYear) return input.title;

  return availableDatedTitle(baseTitle, inputYear, excludeId, usedTitles);
}

function availableDatedTitle(
  baseTitle: string,
  year: number,
  ownerId: string | undefined,
  usedTitles: Map<string, string>,
) {
  const title = `${baseTitle} (${year})`;
  const existingOwner = usedTitles.get(title.toLowerCase());
  if (!existingOwner || existingOwner === ownerId) return title;

  let index = 2;
  while (true) {
    const fallbackTitle = `${baseTitle} (${year} ${index})`;
    const fallbackOwner = usedTitles.get(fallbackTitle.toLowerCase());
    if (!fallbackOwner || fallbackOwner === ownerId) return fallbackTitle;
    index += 1;
  }
}
