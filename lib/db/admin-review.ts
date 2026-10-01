import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * What is waiting on an admin.
 *
 * Users can put items into the shared catalog directly — search-and-add and
 * file imports both create `MediaItem` rows without a review step, which keeps
 * onboarding frictionless. The trade is that an admin has to hear about it, so
 * every such item is stamped with `createdById` and stays "awaiting review"
 * until an admin acknowledges it (`reviewedAt`).
 *
 * An item created by an admin is never queued: the admin already saw it.
 */
export const AWAITING_REVIEW_WHERE = {
  reviewedAt: null,
  createdBy: { isAdmin: false },
} satisfies Prisma.MediaItemWhereInput;

export type AdminReviewCounts = {
  /** User-added catalog items no admin has acknowledged yet. */
  newItems: number;
  /** Pending suggested edits / manual additions. */
  suggestions: number;
  /** Freeform tags awaiting approval. */
  tags: number;
  /** Everything above — the number on the admin alert badge. */
  total: number;
};

/**
 * Counts behind the admin alert badge, memoized per request (the layout and
 * the admin page both ask). Discovery candidates are left out on purpose: they
 * are fetched by a script, not submitted by users, and would drown the badge.
 */
export const getAdminReviewCounts = cache(
  async (): Promise<AdminReviewCounts> => {
    const [newItems, suggestions, tags] = await Promise.all([
      prisma.mediaItem.count({ where: AWAITING_REVIEW_WHERE }),
      prisma.mediaEditSuggestion.count({ where: { status: "PENDING" } }),
      prisma.tag.count({ where: { status: "PENDING" } }),
    ]);
    return { newItems, suggestions, tags, total: newItems + suggestions + tags };
  },
);

export type ReviewQueueItem = Awaited<
  ReturnType<typeof getMediaAwaitingReview>
>[number];

/** The review queue itself, oldest first so nothing sits unseen at the bottom. */
export async function getMediaAwaitingReview(limit = 100) {
  return prisma.mediaItem.findMany({
    where: AWAITING_REVIEW_WHERE,
    select: {
      id: true,
      title: true,
      mediaType: true,
      releaseDate: true,
      posterUrl: true,
      externalUrl: true,
      description: true,
      createdAt: true,
      createdBy: { select: { id: true, displayName: true } },
      genres: { select: { genre: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}
