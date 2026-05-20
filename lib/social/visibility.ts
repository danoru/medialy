import type { MediaStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { visibleMediaTypeFilter } from "@/lib/media-types";

/**
 * The privacy contract for cross-user reads.
 *
 * A user's library is partly public, partly private:
 *  - **Public**: items they've completed, items they've personally rated, and
 *    the resulting personal score. These are what compatibility / activity /
 *    profile pages display.
 *  - **Private**: notes, watchlist, BACKLOG / IN_PROGRESS / DROPPED / PAUSED
 *    statuses (the fact that they're tracking something but haven't finished),
 *    favorite/archive flags. Never returned by helpers in this file.
 *
 * Every social query must funnel through here. Do not call
 * `prisma.userMedia.findMany` for someone other than the viewer directly.
 */

export type PublicUserMediaRow = {
  mediaId: string;
  status: MediaStatus; // always COMPLETED here — included for callsite ergonomics
  personalRating: number | null;
  computedPersonalScore: number | null;
  updatedAt: Date;
};

/** Rows are emitted only when the user actually rated the item OR completed it. */
function publicWhere(targetUserId: string): Prisma.UserMediaWhereInput {
  return {
    userId: targetUserId,
    isArchived: false,
    media: { mediaType: visibleMediaTypeFilter() },
    OR: [{ status: "COMPLETED" }, { personalRating: { not: null } }],
  };
}

export async function getPublicUserMedia(
  targetUserId: string,
  options: { limit?: number } = {},
): Promise<PublicUserMediaRow[]> {
  const rows = await prisma.userMedia.findMany({
    where: publicWhere(targetUserId),
    select: {
      mediaId: true,
      status: true,
      personalRating: true,
      computedPersonalScore: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: options.limit,
  });
  // Collapse non-COMPLETED statuses to UNTRACKED so they never leak even if a
  // caller forgets to ignore the field. The OR above only lets through rows
  // that are COMPLETED or rated — but a rated WATCHLIST/BACKLOG item would
  // still expose status without this step.
  return rows.map((row) => ({
    ...row,
    status: row.status === "COMPLETED" ? "COMPLETED" : "UNTRACKED",
  }));
}

/**
 * Public counts useful for profile cards (completed, rated). Excludes archived.
 */
export async function getPublicUserStats(targetUserId: string) {
  const [completed, rated] = await Promise.all([
    prisma.userMedia.count({
      where: {
        userId: targetUserId,
        status: "COMPLETED",
        isArchived: false,
        media: { mediaType: visibleMediaTypeFilter() },
      },
    }),
    prisma.userMedia.count({
      where: {
        userId: targetUserId,
        personalRating: { not: null },
        isArchived: false,
        media: { mediaType: visibleMediaTypeFilter() },
      },
    }),
  ]);
  return { completedCount: completed, ratedCount: rated };
}
