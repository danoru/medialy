"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/user";

const MAX_DISPLAY_NAME = 64;

/**
 * Update the signed-in user's `displayName`. The chrome and profile pages
 * key off this; `name` (from the Google profile) stays as-is for record-
 * keeping and is what the adapter originally populated.
 */
export async function updateDisplayName(formData: FormData) {
  const userId = await requireUserId("/settings");

  const raw = String(formData.get("displayName") ?? "").trim();
  if (!raw) return;
  const displayName = raw.slice(0, MAX_DISPLAY_NAME);

  await prisma.user.update({
    where: { id: userId },
    data: { displayName },
  });

  // Re-render any surface that displays the chrome / profile name.
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/profile");
}
