import { prisma } from "@/lib/prisma";
import { visibleMediaTypeFilter } from "@/lib/media-types";
import { getFollowingIds, getUserProfiles } from "@/lib/social/follows";

/**
 * Activity feed for the viewer: most recent public actions (completions and
 * rating changes) by users they follow. Goes through the same public-only
 * filter as `getPublicUserMedia` so private statuses never leak into the feed.
 */

export type ActivityFeedItem = {
  id: string; // UserMedia row id, used as a stable key
  userId: string;
  userDisplayName: string;
  userImage: string | null;
  userAvatarColor: string | null;
  mediaId: string;
  mediaTitle: string;
  mediaPosterUrl: string | null;
  kind: "completed" | "rated";
  rating: number | null;
  occurredAt: Date;
};

export async function getActivityFeed(
  viewerId: string,
  options: { limit?: number } = {},
): Promise<ActivityFeedItem[]> {
  const followingIds = await getFollowingIds(viewerId);
  if (followingIds.length === 0) return [];

  const limit = options.limit ?? 12;
  const rows = await prisma.userMedia.findMany({
    where: {
      userId: { in: followingIds },
      isArchived: false,
      media: { mediaType: visibleMediaTypeFilter() },
      OR: [{ status: "COMPLETED" }, { personalRating: { not: null } }],
    },
    select: {
      id: true,
      userId: true,
      mediaId: true,
      status: true,
      personalRating: true,
      updatedAt: true,
      media: { select: { title: true, posterUrl: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const profiles = await getUserProfiles(rows.map((row) => row.userId));

  return rows.map((row) => {
    const profile = profiles.get(row.userId);
    return {
      id: row.id,
      userId: row.userId,
      userDisplayName: profile?.displayName ?? "Someone",
      userImage: profile?.image ?? null,
      userAvatarColor: profile?.avatarColor ?? null,
      mediaId: row.mediaId,
      mediaTitle: row.media.title,
      mediaPosterUrl: row.media.posterUrl,
      kind: row.status === "COMPLETED" ? "completed" : "rated",
      rating: row.personalRating,
      occurredAt: row.updatedAt,
    };
  });
}
