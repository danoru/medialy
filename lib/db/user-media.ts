import type {
  MediaStatus,
  Prisma,
  PrismaClient,
  UserMedia,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Per-user fields that originally lived on `MediaItem`. We keep these flat at
 * the top of the merged DTO so the existing FE code (`media.status`,
 * `media.personalRating`, etc.) keeps working unchanged.
 */
export type UserMediaFields = {
  status: MediaStatus;
  personalRating: number | null;
  computedPersonalScore: number | null;
  personalScoreConfidence: number;
  pairwiseScore: number;
  comparisonCount: number;
  isFavorite: boolean;
  isArchived: boolean;
};

/**
 * Defaults applied to a MediaItem for a user that has never interacted with
 * it (no `UserMedia` row yet). Mirrors the Prisma schema defaults.
 */
export const DEFAULT_USER_MEDIA: UserMediaFields = {
  status: "UNTRACKED",
  personalRating: null,
  computedPersonalScore: null,
  personalScoreConfidence: 0,
  pairwiseScore: 1000,
  comparisonCount: 0,
  isFavorite: false,
  isArchived: false,
};

export type WithUserMedia<T> = T & { userMedia: UserMediaFields[] };

/** The eight `UserMediaFields` as a Prisma `select`, for projected reads. */
const USER_MEDIA_FIELD_SELECT = {
  status: true,
  personalRating: true,
  computedPersonalScore: true,
  personalScoreConfidence: true,
  pairwiseScore: true,
  comparisonCount: true,
  isFavorite: true,
  isArchived: true,
} as const;

/**
 * Returns the Prisma `include` shape callers should use when loading a
 * `MediaItem` for a specific user — exactly one (or zero) `UserMedia` row
 * for that user.
 *
 * For anonymous viewers (`userId === null`), returns a `where` clause that
 * intentionally never matches any row, so the joined `userMedia` array is
 * always empty and `mergeUserMedia` falls back to `DEFAULT_USER_MEDIA`. This
 * lets read paths keep the same shape without branching on auth state.
 */
export function userMediaInclude(userId: string | null) {
  if (userId == null) {
    return {
      userMedia: { where: { userId: "__anonymous__" }, take: 1 } as const,
    };
  }
  return {
    userMedia: { where: { userId }, take: 1 } as const,
  };
}

/**
 * The `select` counterpart to `userMediaInclude` — same one-row-per-viewer
 * semantics, but pulls only the eight fields `mergeUserMedia` flattens instead
 * of the whole `UserMedia` row. Use this inside an explicit `select` (see
 * `@/lib/db/media-select`); `userMediaInclude` only works inside an `include`.
 */
export function userMediaSelect(userId: string | null) {
  return {
    userMedia: {
      where: { userId: userId ?? "__anonymous__" },
      take: 1,
      select: USER_MEDIA_FIELD_SELECT,
    } as const,
  };
}

/**
 * Flattens the user-scoped `UserMedia` row (loaded via `userMediaInclude`)
 * onto a `MediaItem` so callers can keep treating `status`, `personalRating`,
 * etc. as top-level fields. Drops the `userMedia` array from the result.
 */
export function mergeUserMedia<T extends { userMedia: UserMediaFields[] }>(
  media: T,
): Omit<T, "userMedia"> & UserMediaFields {
  const { userMedia, ...rest } = media;
  const row = userMedia[0];
  const fields: UserMediaFields = row
    ? {
        status: row.status,
        personalRating: row.personalRating,
        computedPersonalScore: row.computedPersonalScore,
        personalScoreConfidence: row.personalScoreConfidence,
        pairwiseScore: row.pairwiseScore,
        comparisonCount: row.comparisonCount,
        isFavorite: row.isFavorite,
        isArchived: row.isArchived,
      }
    : { ...DEFAULT_USER_MEDIA };

  return { ...(rest as Omit<T, "userMedia">), ...fields };
}

/**
 * Upsert helper around `prisma.userMedia` for the `(userId, mediaId)` pair.
 * Pass a transaction client to participate in an outer `$transaction`.
 */
export async function upsertUserMedia(
  userId: string,
  mediaId: string,
  data: Partial<Omit<UserMedia, "id" | "userId" | "mediaId" | "createdAt" | "updatedAt">>,
  tx: PrismaLike = prisma,
) {
  return tx.userMedia.upsert({
    where: { userId_mediaId: { userId, mediaId } },
    update: data,
    create: { userId, mediaId, ...data },
  });
}
