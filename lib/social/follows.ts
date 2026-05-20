import { prisma } from "@/lib/prisma";

/**
 * One-way follow plumbing. `viewer` follows `target`; the reverse is independent.
 * Self-follows are silently ignored — keeps callsites from having to branch.
 */

export async function followUser(viewerId: string, targetId: string) {
  if (viewerId === targetId) return;
  await prisma.userFollow.upsert({
    where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
    update: {},
    create: { followerId: viewerId, followingId: targetId },
  });
}

export async function unfollowUser(viewerId: string, targetId: string) {
  await prisma.userFollow.deleteMany({
    where: { followerId: viewerId, followingId: targetId },
  });
}

export async function isFollowing(viewerId: string, targetId: string) {
  if (viewerId === targetId) return false;
  const row = await prisma.userFollow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
    select: { id: true },
  });
  return Boolean(row);
}

/** Users `viewerId` follows. */
export async function getFollowingIds(viewerId: string): Promise<string[]> {
  const rows = await prisma.userFollow.findMany({
    where: { followerId: viewerId },
    select: { followingId: true },
  });
  return rows.map((row) => row.followingId);
}

/** Users following `viewerId`. */
export async function getFollowerIds(viewerId: string): Promise<string[]> {
  const rows = await prisma.userFollow.findMany({
    where: { followingId: viewerId },
    select: { followerId: true },
  });
  return rows.map((row) => row.followerId);
}

export type PublicUserProfile = {
  id: string;
  displayName: string;
  image: string | null;
  avatarColor: string | null;
};

/** Hydrate the public profile fields for a set of user ids in one query. */
export async function getUserProfiles(
  userIds: string[],
): Promise<Map<string, PublicUserProfile>> {
  if (userIds.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, image: true, avatarColor: true },
  });
  return new Map(users.map((user) => [user.id, user]));
}

/**
 * Other platform users the viewer doesn't already follow (and isn't themself).
 * Used by the "Discover users" section on `/friends`. Limit defaults to a
 * small number; the platform is small.
 */
export async function getDiscoverableUsers(viewerId: string, limit = 25) {
  const followingIds = await getFollowingIds(viewerId);
  return prisma.user.findMany({
    where: {
      id: { notIn: [viewerId, ...followingIds] },
    },
    select: { id: true, displayName: true, image: true, avatarColor: true },
    orderBy: { displayName: "asc" },
    take: limit,
  });
}
