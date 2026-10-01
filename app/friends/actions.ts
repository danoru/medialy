"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { followUser, unfollowUser } from "@/lib/social/follows";
import { requireUserId } from "@/lib/user";

/**
 * Server actions for the social `/friends` redesign. The legacy manual-friend
 * actions (`createFriend`, `addFriendRating`) have been removed alongside the
 * `Friend` and `FriendRating` tables — see the
 * `drop_manual_friends_add_user_follow` migration.
 */

export async function followUserAction(targetUserId: string) {
  if (!targetUserId) return;
  const viewerId = await requireUserId("/friends");
  try {
    await followUser(viewerId, targetUserId);
  } catch (error) {
    // Following a user id that doesn't exist: nothing to do.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2025")
    ) {
      return;
    }
    throw error;
  }
  revalidatePath("/friends");
  revalidatePath(`/u/${targetUserId}`);
}

export async function unfollowUserAction(targetUserId: string) {
  if (!targetUserId) return;
  const viewerId = await requireUserId("/friends");
  await unfollowUser(viewerId, targetUserId);
  revalidatePath("/friends");
  revalidatePath(`/u/${targetUserId}`);
}
