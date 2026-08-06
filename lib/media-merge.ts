import type {
  MediaItem,
  MediaStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { MAX_GENRES_PER_ITEM } from "@/lib/data/genre";
import { clearComparisonsForMedia, type ComparisonPartner } from "@/lib/media";
import { DEFAULT_USER_MEDIA } from "@/lib/db/user-media";
import { prisma } from "@/lib/prisma";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Folding a duplicate catalog entry into the entry it duplicates.
 *
 * Merging is "repoint every child row onto the survivor, then delete the
 * duplicate". What makes it more than an UPDATE is that six of those child
 * tables carry a unique constraint involving `mediaId`, so a blind repoint
 * throws the moment both items share a genre, a tag, a rating source, a list,
 * or a user. Each collision therefore needs its own rule, below.
 *
 * Conflicts resolve automatically and always in the survivor's favour — the
 * duplicate only ever fills in blanks. That mirrors the rule the metadata
 * backfills already follow: curated values are never overwritten by an
 * automated process.
 */

/**
 * Statuses that mean "haven't started" — the same split
 * `lib/status-rules.ts` uses to decide whether rating something may promote
 * it. Anything outside this set is a deliberate statement about where the
 * user is with the item, and must win over one that isn't.
 */
const UNCOMMITTED_STATUSES: readonly MediaStatus[] = [
  "UNTRACKED",
  "WATCHLIST",
  "BACKLOG",
];

export function isDeliberateStatus(status: MediaStatus) {
  return !UNCOMMITTED_STATUSES.includes(status);
}

/**
 * Which of two statuses for the same user survives the merge.
 *
 * A deliberate status beats a not-started one in either direction: someone who
 * marked the duplicate Completed and never touched the canonical entry has
 * still watched the film. When both are deliberate the survivor's wins, and
 * when neither is we keep whichever says more than `UNTRACKED`.
 */
export function mergeStatus(
  survivor: MediaStatus,
  duplicate: MediaStatus,
): MediaStatus {
  if (isDeliberateStatus(survivor)) return survivor;
  if (isDeliberateStatus(duplicate)) return duplicate;
  return survivor === "UNTRACKED" ? duplicate : survivor;
}

export type MergeableUserMedia = {
  status: MediaStatus;
  personalRating: number | null;
  isFavorite: boolean;
  isArchived: boolean;
};

/**
 * Merge one user's two `UserMedia` rows into the fields the survivor's row
 * should end up with.
 *
 * `pairwiseScore` / `comparisonCount` are deliberately absent: the duplicate's
 * Elo is derived entirely from comparisons that this merge deletes, so there
 * is nothing there worth carrying over. The survivor keeps its own.
 */
export function mergeUserMediaFields(
  survivor: MergeableUserMedia,
  duplicate: MergeableUserMedia,
): MergeableUserMedia {
  return {
    status: mergeStatus(survivor.status, duplicate.status),
    personalRating: survivor.personalRating ?? duplicate.personalRating,
    // Favouriting either entry was a positive signal about the same work.
    isFavorite: survivor.isFavorite || duplicate.isFavorite,
    // Archiving is a statement about the row you keep seeing, so the
    // survivor's own choice stands.
    isArchived: survivor.isArchived,
  };
}

/** Scalars worth inheriting. Identity (`title`, `mediaType`), computed scores
 *  and provenance (`createdById`) are never taken from the duplicate. */
const INHERITABLE_FIELDS = [
  "originalTitle",
  "description",
  "releaseDate",
  "posterUrl",
  "externalUrl",
  "metadataJson",
  "platformsJson",
] as const;

type InheritableField = (typeof INHERITABLE_FIELDS)[number];

function isBlank(value: unknown) {
  if (value == null) return true;
  return typeof value === "string" && value.trim() === "";
}

/**
 * Fields the survivor should adopt from the duplicate: only those it is
 * currently missing. Never overwrites a curated value.
 */
export function inheritableScalars(
  survivor: Pick<MediaItem, InheritableField>,
  duplicate: Pick<MediaItem, InheritableField>,
): Partial<Pick<MediaItem, InheritableField>> {
  const data: Record<string, unknown> = {};
  for (const field of INHERITABLE_FIELDS) {
    if (isBlank(survivor[field]) && !isBlank(duplicate[field])) {
      data[field] = duplicate[field];
    }
  }
  return data as Partial<Pick<MediaItem, InheritableField>>;
}

export type MergePreview = {
  duplicate: { id: string; title: string; mediaType: string };
  survivor: { id: string; title: string; mediaType: string };
  /** Users whose row moves across wholesale (no row on the survivor yet). */
  statusesMoved: number;
  /** Users with a row on both, resolved field by field. */
  statusesMerged: number;
  comparisonsDropped: number;
  notesMoved: number;
  listsMoved: number;
  genresAdded: number;
  tagsAdded: number;
  creditsAdded: number;
  externalRatingsAdded: number;
  relationsMoved: number;
  releaseEventsMoved: number;
  fieldsInherited: InheritableField[];
};

/**
 * Read-only dry run of `mergeMediaItems`, so the confirmation step can state
 * exactly what is about to move rather than asking for blind consent to an
 * irreversible action.
 */
export async function getMergePreview(
  duplicateId: string,
  survivorId: string,
): Promise<MergePreview | null> {
  if (duplicateId === survivorId) return null;

  const [duplicate, survivor] = await Promise.all([
    prisma.mediaItem.findUnique({ where: { id: duplicateId } }),
    prisma.mediaItem.findUnique({ where: { id: survivorId } }),
  ]);
  if (!duplicate || !survivor) return null;

  const [
    duplicateUsers,
    survivorUsers,
    comparisonsDropped,
    notesMoved,
    duplicateLists,
    survivorLists,
    duplicateGenres,
    survivorGenres,
    duplicateTags,
    survivorTags,
    duplicateCredits,
    survivorCredits,
    duplicateRatings,
    survivorRatings,
    relationsFrom,
    relationsTo,
    releaseEventsMoved,
  ] = await Promise.all([
    prisma.userMedia.findMany({
      where: { mediaId: duplicateId },
      select: { userId: true },
    }),
    prisma.userMedia.findMany({
      where: { mediaId: survivorId },
      select: { userId: true },
    }),
    prisma.pairwiseComparison.count({
      where: { OR: [{ winnerId: duplicateId }, { loserId: duplicateId }] },
    }),
    prisma.note.count({ where: { mediaId: duplicateId } }),
    prisma.listItem.findMany({
      where: { mediaId: duplicateId },
      select: { listId: true },
    }),
    prisma.listItem.findMany({
      where: { mediaId: survivorId },
      select: { listId: true },
    }),
    prisma.mediaGenre.findMany({
      where: { mediaId: duplicateId },
      select: { genreId: true },
    }),
    prisma.mediaGenre.findMany({
      where: { mediaId: survivorId },
      select: { genreId: true },
    }),
    prisma.mediaTag.findMany({
      where: { mediaId: duplicateId },
      select: { tagId: true },
    }),
    prisma.mediaTag.findMany({
      where: { mediaId: survivorId },
      select: { tagId: true },
    }),
    prisma.mediaCredit.findMany({
      where: { mediaId: duplicateId },
      select: { contributorId: true, role: true },
    }),
    prisma.mediaCredit.findMany({
      where: { mediaId: survivorId },
      select: { contributorId: true, role: true },
    }),
    prisma.externalRating.findMany({
      where: { mediaId: duplicateId },
      select: { source: true },
    }),
    prisma.externalRating.findMany({
      where: { mediaId: survivorId },
      select: { source: true },
    }),
    prisma.mediaRelation.findMany({
      where: { fromId: duplicateId },
      select: { toId: true, kind: true },
    }),
    prisma.mediaRelation.findMany({
      where: { toId: duplicateId },
      select: { fromId: true, kind: true },
    }),
    prisma.mediaReleaseEvent.count({ where: { mediaId: duplicateId } }),
  ]);

  const survivorUserIds = new Set(survivorUsers.map((row) => row.userId));
  const survivorListIds = new Set(survivorLists.map((row) => row.listId));
  const survivorGenreIds = new Set(survivorGenres.map((row) => row.genreId));
  const survivorTagIds = new Set(survivorTags.map((row) => row.tagId));
  const survivorCreditKeys = new Set(
    survivorCredits.map((row) => `${row.contributorId}:${row.role}`),
  );
  const survivorSources = new Set(survivorRatings.map((row) => row.source));

  const genreRoom = Math.max(0, MAX_GENRES_PER_ITEM - survivorGenres.length);
  const newGenres = duplicateGenres.filter(
    (row) => !survivorGenreIds.has(row.genreId),
  );

  // A relation between the two entries is meaningless once they're one item.
  const movableRelations = [
    ...relationsFrom.filter((row) => row.toId !== survivorId),
    ...relationsTo.filter((row) => row.fromId !== survivorId),
  ];

  return {
    duplicate: {
      id: duplicate.id,
      title: duplicate.title,
      mediaType: duplicate.mediaType,
    },
    survivor: {
      id: survivor.id,
      title: survivor.title,
      mediaType: survivor.mediaType,
    },
    statusesMoved: duplicateUsers.filter(
      (row) => !survivorUserIds.has(row.userId),
    ).length,
    statusesMerged: duplicateUsers.filter((row) =>
      survivorUserIds.has(row.userId),
    ).length,
    comparisonsDropped,
    notesMoved,
    listsMoved: duplicateLists.filter((row) => !survivorListIds.has(row.listId))
      .length,
    genresAdded: Math.min(newGenres.length, genreRoom),
    tagsAdded: duplicateTags.filter((row) => !survivorTagIds.has(row.tagId))
      .length,
    creditsAdded: duplicateCredits.filter(
      (row) => !survivorCreditKeys.has(`${row.contributorId}:${row.role}`),
    ).length,
    externalRatingsAdded: duplicateRatings.filter(
      (row) => !survivorSources.has(row.source),
    ).length,
    relationsMoved: movableRelations.length,
    releaseEventsMoved,
    fieldsInherited: Object.keys(
      inheritableScalars(survivor, duplicate),
    ) as InheritableField[],
  };
}

export type MergeResult =
  | { ok: true; survivorTitle: string; duplicateTitle: string }
  | { ok: false; reason: "missing" | "same-item" | "type-mismatch" };

/**
 * Fold `duplicateId` into `survivorId` and delete the duplicate.
 *
 * Returns the comparison partners whose scores need recomputing once the
 * transaction has committed — the caller does that outside, so a slow fan-out
 * can't hold the transaction open.
 */
export async function mergeMediaItems(
  duplicateId: string,
  survivorId: string,
): Promise<{ result: MergeResult; partners: ComparisonPartner[] }> {
  if (duplicateId === survivorId) {
    return { result: { ok: false, reason: "same-item" }, partners: [] };
  }

  const [duplicate, survivor] = await Promise.all([
    prisma.mediaItem.findUnique({ where: { id: duplicateId } }),
    prisma.mediaItem.findUnique({ where: { id: survivorId } }),
  ]);
  if (!duplicate || !survivor) {
    return { result: { ok: false, reason: "missing" }, partners: [] };
  }
  // Merging across types is almost always a misclick, and it would silently
  // destroy an entry that a relation (remake, adaptation) should describe.
  if (duplicate.mediaType !== survivor.mediaType) {
    return { result: { ok: false, reason: "type-mismatch" }, partners: [] };
  }

  const partners = await prisma.$transaction(async (tx) => {
    await transferTaxonomy(tx, duplicateId, survivorId);
    await transferExternalRatings(tx, duplicateId, survivorId);
    await transferListItems(tx, duplicateId, survivorId);
    await transferRelations(tx, duplicateId, survivorId);
    await transferUserMedia(tx, duplicateId, survivorId);

    // No unique constraint on these — a plain repoint is safe.
    await tx.note.updateMany({
      where: { mediaId: duplicateId },
      data: { mediaId: survivorId },
    });
    await tx.mediaReleaseEvent.updateMany({
      where: { mediaId: duplicateId },
      data: { mediaId: survivorId },
    });
    await tx.mediaEditSuggestion.updateMany({
      where: { mediaId: duplicateId },
      data: { mediaId: survivorId },
    });

    const inherited = inheritableScalars(survivor, duplicate);
    if (Object.keys(inherited).length > 0) {
      await tx.mediaItem.update({ where: { id: survivorId }, data: inherited });
    }

    const affected = await clearComparisonsForMedia(tx, duplicateId);
    await tx.mediaItem.delete({ where: { id: duplicateId } });
    // The duplicate itself is gone; don't ask to recompute a dead row.
    return affected.filter((partner) => partner.mediaId !== duplicateId);
  });

  return {
    result: {
      ok: true,
      survivorTitle: survivor.title,
      duplicateTitle: duplicate.title,
    },
    partners,
  };
}

/** Genres (capped), tags and credits: add what the survivor is missing. */
async function transferTaxonomy(
  tx: PrismaLike,
  duplicateId: string,
  survivorId: string,
) {
  const [duplicateGenres, survivorGenres] = await Promise.all([
    tx.mediaGenre.findMany({
      where: { mediaId: duplicateId },
      select: { genreId: true },
    }),
    tx.mediaGenre.findMany({
      where: { mediaId: survivorId },
      select: { genreId: true },
    }),
  ]);
  const survivorGenreIds = new Set(survivorGenres.map((row) => row.genreId));
  // The survivor's own genres are the curated ones, so they keep their slots
  // and the duplicate only fills whatever room is left under the cap.
  const room = Math.max(0, MAX_GENRES_PER_ITEM - survivorGenres.length);
  const genresToAdd = duplicateGenres
    .filter((row) => !survivorGenreIds.has(row.genreId))
    .slice(0, room);
  if (genresToAdd.length > 0) {
    await tx.mediaGenre.createMany({
      data: genresToAdd.map((row) => ({
        mediaId: survivorId,
        genreId: row.genreId,
      })),
      skipDuplicates: true,
    });
  }

  const [duplicateTags, survivorTags] = await Promise.all([
    tx.mediaTag.findMany({
      where: { mediaId: duplicateId },
      select: { tagId: true },
    }),
    tx.mediaTag.findMany({
      where: { mediaId: survivorId },
      select: { tagId: true },
    }),
  ]);
  const survivorTagIds = new Set(survivorTags.map((row) => row.tagId));
  const tagsToAdd = duplicateTags.filter(
    (row) => !survivorTagIds.has(row.tagId),
  );
  if (tagsToAdd.length > 0) {
    await tx.mediaTag.createMany({
      data: tagsToAdd.map((row) => ({ mediaId: survivorId, tagId: row.tagId })),
      skipDuplicates: true,
    });
  }

  const [duplicateCredits, survivorCredits] = await Promise.all([
    tx.mediaCredit.findMany({ where: { mediaId: duplicateId } }),
    tx.mediaCredit.findMany({
      where: { mediaId: survivorId },
      select: { contributorId: true, role: true },
    }),
  ]);
  const survivorCreditKeys = new Set(
    survivorCredits.map((row) => `${row.contributorId}:${row.role}`),
  );
  const creditsToAdd = duplicateCredits.filter(
    (row) => !survivorCreditKeys.has(`${row.contributorId}:${row.role}`),
  );
  if (creditsToAdd.length > 0) {
    await tx.mediaCredit.createMany({
      data: creditsToAdd.map((row) => ({
        mediaId: survivorId,
        contributorId: row.contributorId,
        role: row.role,
        order: row.order,
        source: row.source,
        sourceId: row.sourceId,
      })),
      skipDuplicates: true,
    });
  }
}

/** Unique per `(mediaId, source)` — take only sources the survivor lacks. */
async function transferExternalRatings(
  tx: PrismaLike,
  duplicateId: string,
  survivorId: string,
) {
  const survivorRatings = await tx.externalRating.findMany({
    where: { mediaId: survivorId },
    select: { source: true },
  });
  const survivorSources = new Set(survivorRatings.map((row) => row.source));
  const movable = await tx.externalRating.findMany({
    where: { mediaId: duplicateId },
  });
  const ids = movable
    .filter((row) => !survivorSources.has(row.source))
    .map((row) => row.id);
  if (ids.length > 0) {
    await tx.externalRating.updateMany({
      where: { id: { in: ids } },
      data: { mediaId: survivorId },
    });
  }
}

/** Unique per `(listId, mediaId)` — a list holding both keeps the survivor's
 *  entry, with its existing rank and note. */
async function transferListItems(
  tx: PrismaLike,
  duplicateId: string,
  survivorId: string,
) {
  const survivorItems = await tx.listItem.findMany({
    where: { mediaId: survivorId },
    select: { listId: true },
  });
  const survivorListIds = new Set(survivorItems.map((row) => row.listId));
  const duplicateItems = await tx.listItem.findMany({
    where: { mediaId: duplicateId },
    select: { id: true, listId: true },
  });

  const movable = duplicateItems.filter(
    (row) => !survivorListIds.has(row.listId),
  );
  if (movable.length > 0) {
    await tx.listItem.updateMany({
      where: { id: { in: movable.map((row) => row.id) } },
      data: { mediaId: survivorId },
    });
  }
  // The rest would collide; they die with the duplicate anyway, but deleting
  // explicitly keeps this readable next to the transfer.
  const colliding = duplicateItems.filter((row) =>
    survivorListIds.has(row.listId),
  );
  if (colliding.length > 0) {
    await tx.listItem.deleteMany({
      where: { id: { in: colliding.map((row) => row.id) } },
    });
  }
}

/** Unique per `(fromId, toId, kind)`, and a link to the survivor would become
 *  a self-relation once the two entries are one. */
async function transferRelations(
  tx: PrismaLike,
  duplicateId: string,
  survivorId: string,
) {
  const [outgoing, incoming, survivorRelations] = await Promise.all([
    tx.mediaRelation.findMany({ where: { fromId: duplicateId } }),
    tx.mediaRelation.findMany({ where: { toId: duplicateId } }),
    tx.mediaRelation.findMany({
      where: { OR: [{ fromId: survivorId }, { toId: survivorId }] },
      select: { fromId: true, toId: true, kind: true },
    }),
  ]);
  const existing = new Set(
    survivorRelations.map((row) => `${row.fromId}:${row.toId}:${row.kind}`),
  );

  for (const relation of outgoing) {
    const key = `${survivorId}:${relation.toId}:${relation.kind}`;
    if (relation.toId === survivorId || existing.has(key)) continue;
    await tx.mediaRelation.update({
      where: { id: relation.id },
      data: { fromId: survivorId },
    });
    existing.add(key);
  }
  for (const relation of incoming) {
    const key = `${relation.fromId}:${survivorId}:${relation.kind}`;
    if (relation.fromId === survivorId || existing.has(key)) continue;
    await tx.mediaRelation.update({
      where: { id: relation.id },
      data: { toId: survivorId },
    });
    existing.add(key);
  }
  // Anything left over is a self-link or a duplicate; it cascades away with
  // the duplicate item.
}

/**
 * Unique per `(userId, mediaId)`. Users with a row on only the duplicate have
 * it repointed; users with both get the two resolved by `mergeUserMediaFields`.
 *
 * Repointed rows have their Elo reset — every comparison backing it is about
 * to be deleted along with the duplicate, so carrying the score across would
 * assert a confidence nothing supports.
 */
async function transferUserMedia(
  tx: PrismaLike,
  duplicateId: string,
  survivorId: string,
) {
  const [duplicateRows, survivorRows] = await Promise.all([
    tx.userMedia.findMany({ where: { mediaId: duplicateId } }),
    tx.userMedia.findMany({ where: { mediaId: survivorId } }),
  ]);
  const survivorByUser = new Map(survivorRows.map((row) => [row.userId, row]));

  const repointable: string[] = [];
  for (const row of duplicateRows) {
    const existing = survivorByUser.get(row.userId);
    if (!existing) {
      repointable.push(row.id);
      continue;
    }
    await tx.userMedia.update({
      where: { id: existing.id },
      data: mergeUserMediaFields(existing, row),
    });
  }

  if (repointable.length > 0) {
    await tx.userMedia.updateMany({
      where: { id: { in: repointable } },
      data: {
        mediaId: survivorId,
        pairwiseScore: DEFAULT_USER_MEDIA.pairwiseScore,
        comparisonCount: DEFAULT_USER_MEDIA.comparisonCount,
      },
    });
  }
}
