"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { coerceMediaStatus, parseOptionalNumber } from "@/lib/validation";

export async function createFriend(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (name)
    await prisma.friend.create({ data: { name, notes: notes || null } });
  revalidatePath("/friends");
}

export async function addFriendRating(formData: FormData) {
  const friendId = String(formData.get("friendId") ?? "");
  const mediaId = String(formData.get("mediaId") ?? "");
  if (!friendId || !mediaId) return;
  await prisma.friendRating.upsert({
    where: { friendId_mediaId: { friendId, mediaId } },
    update: {
      rating: parseOptionalNumber(formData.get("rating")),
      status: formData.get("status")
        ? coerceMediaStatus(formData.get("status"))
        : null,
    },
    create: {
      friendId,
      mediaId,
      rating: parseOptionalNumber(formData.get("rating")),
      status: formData.get("status")
        ? coerceMediaStatus(formData.get("status"))
        : null,
    },
  });
  revalidatePath("/friends");
}
