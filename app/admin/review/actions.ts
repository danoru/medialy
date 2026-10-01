"use server";

import { revalidatePath } from "next/cache";
import { AWAITING_REVIEW_WHERE } from "@/lib/db/admin-review";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/user";

function revalidateReviewQueue() {
  revalidatePath("/admin/review");
  revalidatePath("/admin");
  // The alert badge lives in the app shell.
  revalidatePath("/", "layout");
}

/** Acknowledge one user-added item. Fixing or deleting it happens on its own
 *  page; this only clears it from the queue. */
export async function markMediaReviewed(id: string) {
  await requireAdmin("/admin/review");
  await prisma.mediaItem.updateMany({
    where: { id, reviewedAt: null },
    data: { reviewedAt: new Date() },
  });
  revalidateReviewQueue();
}

/**
 * Acknowledge exactly the items the admin was looking at. Takes the ids from
 * the rendered page rather than clearing "everything awaiting review", so an
 * item a user adds while the page is open is not waved through unseen.
 */
export async function markAllMediaReviewed(ids: string[]) {
  await requireAdmin("/admin/review");
  if (!Array.isArray(ids) || ids.length === 0) return;
  await prisma.mediaItem.updateMany({
    where: { ...AWAITING_REVIEW_WHERE, id: { in: ids.map(String) } },
    data: { reviewedAt: new Date() },
  });
  revalidateReviewQueue();
}
