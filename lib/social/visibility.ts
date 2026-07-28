import type { MediaStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { visibleMediaTypeFilter } from "@/lib/media-types";
import { getFollowingIds, getUserProfiles } from "@/lib/social/follows";

/**
 * The privacy contract for cross-user reads. There are two tiers.
 *
 * **Public** — visible to any signed-in viewer, no follow required. Items the
 * user completed, items they personally rated, and the resulting personal
 * score. This is what compatibility / activity / profile pages display, via
 * {@link getPublicUserMedia} and {@link getPublicUserStats}.
 *
 * **Followed-only** — additionally exposes *in-flight* tracking statuses
 * (WATCHLIST / BACKLOG / IN_PROGRESS / PAUSED / DROPPED) for a single media
 * item, and only to a viewer who follows that user. This powers the "Friend
 * activity" section on the media detail page, via
 * {@link getFriendMediaActivity}. Knowing a friend has something queued or
 * gave up on it is the point of the feature; it is deliberately *not* part of
 * the public tier.
 *
 * **Never exposed at either tier**: notes, favorite/archive flags, and the
 * NOT_INTERESTED status (a private recommendation-suppression signal, not an
 * activity).
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
 * Tracking statuses a followed user's activity may reveal for a single item.
 * UNTRACKED carries no information and NOT_INTERESTED stays private, so both
 * are absent — see the module docstring.
 */
const FRIEND_VISIBLE_STATUSES: MediaStatus[] = [
  "WATCHLIST",
  "BACKLOG",
  "IN_PROGRESS",
  "COMPLETED",
  "PAUSED",
  "DROPPED",
];

/**
 * Display order: the further along a friend is, the higher they sort. Rated
 * rows break ties by score so the strongest opinions surface first.
 */
const FRIEND_STATUS_RANK: Record<MediaStatus, number> = {
  COMPLETED: 0,
  IN_PROGRESS: 1,
  PAUSED: 2,
  WATCHLIST: 3,
  BACKLOG: 4,
  DROPPED: 5,
  UNTRACKED: 6,
  NOT_INTERESTED: 6,
};

export type FriendMediaEntry = {
  userId: string;
  displayName: string;
  image: string | null;
  avatarColor: string | null;
  /** Never UNTRACKED unless the row exists only because of a rating. */
  status: MediaStatus;
  personalRating: number | null;
  computedPersonalScore: number | null;
};

/**
 * What the people `viewerId` follows have done with one media item — their
 * status, their rating, or both. Returns `[]` when the viewer follows nobody
 * or none of them have touched the item.
 *
 * A row is included when the friend has a shareable status *or* has rated the
 * item (a rating is public regardless of status, per the public tier). Any
 * other status is collapsed to UNTRACKED on the way out so a rated-but-private
 * status can't leak through the `status` field.
 */
export async function getFriendMediaActivity(
  viewerId: string,
  mediaId: string,
): Promise<FriendMediaEntry[]> {
  const followingIds = await getFollowingIds(viewerId);
  if (followingIds.length === 0) return [];

  const rows = await prisma.userMedia.findMany({
    where: {
      userId: { in: followingIds },
      mediaId,
      isArchived: false,
      OR: [
        { status: { in: FRIEND_VISIBLE_STATUSES } },
        { personalRating: { not: null } },
      ],
    },
    select: {
      userId: true,
      status: true,
      personalRating: true,
      computedPersonalScore: true,
    },
  });
  if (rows.length === 0) return [];

  const profiles = await getUserProfiles(rows.map((row) => row.userId));

  return rows
    .map((row) => {
      const profile = profiles.get(row.userId);
      return {
        userId: row.userId,
        displayName: profile?.displayName ?? "Someone",
        image: profile?.image ?? null,
        avatarColor: profile?.avatarColor ?? null,
        status: FRIEND_VISIBLE_STATUSES.includes(row.status)
          ? row.status
          : ("UNTRACKED" as MediaStatus),
        personalRating: row.personalRating,
        computedPersonalScore: row.computedPersonalScore,
      };
    })
    .sort(
      (first, second) =>
        FRIEND_STATUS_RANK[first.status] - FRIEND_STATUS_RANK[second.status] ||
        (second.personalRating ?? -1) - (first.personalRating ?? -1) ||
        first.displayName.localeCompare(second.displayName),
    );
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
