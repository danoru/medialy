"use server";

import { revalidatePath } from "next/cache";
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
  await followUser(viewerId, targetUserId);
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
