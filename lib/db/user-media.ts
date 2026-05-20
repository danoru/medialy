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

export type WithUserMedia<T> = T & { userMedia: UserMedia[] };

/**
 * Returns the Prisma `include` shape callers should use when loading a
 * `MediaItem` for a specific user — exactly one (or zero) `UserMedia` row
 * for that user.
 */
export function userMediaInclude(userId: string) {
  return {
    userMedia: { where: { userId }, take: 1 } as const,
  };
}

/**
 * Flattens the user-scoped `UserMedia` row (loaded via `userMediaInclude`)
 * onto a `MediaItem` so callers can keep treating `status`, `personalRating`,
 * etc. as top-level fields. Drops the `userMedia` array from the result.
 */
export function mergeUserMedia<T extends { userMedia: UserMedia[] }>(
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
