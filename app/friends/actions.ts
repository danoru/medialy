"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/user";
import { coerceMediaStatus, parseOptionalRating } from "@/lib/validation";

export async function createFriend(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (name) {
    const userId = await requireUserId();
    await prisma.friend.create({
      data: { userId, name, notes: notes || null },
    });
  }
  revalidatePath("/friends");
}

export async function addFriendRating(formData: FormData) {
  const friendId = String(formData.get("friendId") ?? "");
  const mediaId = String(formData.get("mediaId") ?? "");
  if (!friendId || !mediaId) return;
  const userId = await requireUserId();
  await prisma.friendRating.upsert({
    where: { friendId_mediaId: { friendId, mediaId } },
    update: {
      rating: parseOptionalRating(formData.get("rating")),
      status: formData.get("status")
        ? coerceMediaStatus(formData.get("status"))
        : null,
    },
    create: {
      userId,
      friendId,
      mediaId,
      rating: parseOptionalRating(formData.get("rating")),
      status: formData.get("status")
        ? coerceMediaStatus(formData.get("status"))
        : null,
    },
  });
  revalidatePath("/friends");
}
