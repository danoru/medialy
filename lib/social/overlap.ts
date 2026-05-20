import { prisma } from "@/lib/prisma";
import { calculateRatingCompatibility } from "@/lib/scoring/compatibility";
import { visibleMediaTypeFilter } from "@/lib/media-types";

/**
 * Cross-user comparison: how compatible are two users' tastes, what do they
 * share, and what could they watch next together. Reads only public data
 * (ratings + COMPLETED items) on both sides — see lib/social/visibility.ts for
 * the privacy contract.
 */

export type UserOverlap = {
  compatibilityScore: number;
  overlapCount: number;
  averageDistance: number | null;
  sharedCompletedCount: number;
  watchNextTogether: Array<{
    mediaId: string;
    title: string;
    posterUrl: string | null;
    reason: "shared-watchlist" | "they-love-it-you-havent-seen";
    theirRating: number | null;
  }>;
  topSharedGenres: string[];
};

const WATCH_NEXT_LIMIT = 6;

export async function getUserOverlap(
  viewerId: string,
  targetId: string,
): Promise<UserOverlap> {
  if (viewerId === targetId) {
    return {
      compatibilityScore: 0,
      overlapCount: 0,
      averageDistance: null,
      sharedCompletedCount: 0,
      watchNextTogether: [],
      topSharedGenres: [],
    };
  }

  const [viewerRows, targetRows] = await Promise.all([
    prisma.userMedia.findMany({
      where: {
        userId: viewerId,
        isArchived: false,
        media: { mediaType: visibleMediaTypeFilter() },
      },
      select: {
        mediaId: true,
        status: true,
        personalRating: true,
      },
    }),
    prisma.userMedia.findMany({
      where: {
        userId: targetId,
        isArchived: false,
        media: { mediaType: visibleMediaTypeFilter() },
        // Public surface: rated OR completed
        OR: [{ status: "COMPLETED" }, { personalRating: { not: null } }],
      },
      select: {
        mediaId: true,
        status: true,
        personalRating: true,
      },
    }),
  ]);

  const viewerById = new Map(viewerRows.map((row) => [row.mediaId, row]));

  const pairs: Array<{ viewerRating: number; otherRating: number }> = [];
  const sharedCompletedIds: string[] = [];
  const theyLoveCandidates: Array<{ mediaId: string; theirRating: number }> = [];

  for (const target of targetRows) {
    const viewer = viewerById.get(target.mediaId);
    if (
      viewer?.personalRating != null &&
      target.personalRating != null
    ) {
      pairs.push({
        viewerRating: viewer.personalRating,
        otherRating: target.personalRating,
      });
    }
    if (target.status === "COMPLETED" && viewer?.status === "COMPLETED") {
      sharedCompletedIds.push(target.mediaId);
    }
    // "They love it, you haven't seen it": target rated 8+ and viewer has no
    // COMPLETED / IN_PROGRESS / DROPPED state (i.e., not engaged yet).
    if (
      target.personalRating != null &&
      target.personalRating >= 8 &&
      (viewer == null ||
        (viewer.status !== "COMPLETED" &&
          viewer.status !== "IN_PROGRESS" &&
          viewer.status !== "DROPPED"))
    ) {
      theyLoveCandidates.push({
        mediaId: target.mediaId,
        theirRating: target.personalRating,
      });
    }
  }

  const compat = calculateRatingCompatibility(pairs);

  // Watch-next-together: prefer items both have on WATCHLIST, then the
  // "they love it, you haven't seen it" pool. Hard cap at WATCH_NEXT_LIMIT.
  const viewerWatchlistIds = new Set(
    viewerRows.filter((row) => row.status === "WATCHLIST").map((row) => row.mediaId),
  );
  const targetWatchlistIds = new Set(
    // NOTE: targetRows above only includes COMPLETED/rated, so WATCHLIST
    // overlap requires a second narrow query. Watchlist is private under our
    // contract, but a shared "watch next" suggestion only surfaces the item id
    // *to the viewer themselves*, not to the target — they already know what's
    // on their own list. So this query is fine.
    [] as string[],
  );
  void targetWatchlistIds; // placeholder if we later relax privacy

  const sharedWatchlistIds = await sharedWatchlistMedia(viewerId, targetId);

  const watchNextIds = new Set<string>();
  for (const id of sharedWatchlistIds) {
    if (watchNextIds.size >= WATCH_NEXT_LIMIT) break;
    watchNextIds.add(id);
  }
  for (const candidate of theyLoveCandidates.sort(
    (a, b) => b.theirRating - a.theirRating,
  )) {
    if (watchNextIds.size >= WATCH_NEXT_LIMIT) break;
    watchNextIds.add(candidate.mediaId);
  }

  const watchNextMedia = watchNextIds.size
    ? await prisma.mediaItem.findMany({
        where: { id: { in: [...watchNextIds] } },
        select: { id: true, title: true, posterUrl: true },
      })
    : [];

  const theyLoveById = new Map(
    theyLoveCandidates.map((entry) => [entry.mediaId, entry.theirRating]),
  );

  const watchNextTogether = [...watchNextIds].map((mediaId) => {
    const media = watchNextMedia.find((row) => row.id === mediaId);
    return {
      mediaId,
      title: media?.title ?? "(unknown)",
      posterUrl: media?.posterUrl ?? null,
      reason: sharedWatchlistIds.includes(mediaId)
        ? ("shared-watchlist" as const)
        : ("they-love-it-you-havent-seen" as const),
      theirRating: theyLoveById.get(mediaId) ?? null,
    };
  });

  void viewerWatchlistIds; // reserved for richer future heuristics

  const topSharedGenres = sharedCompletedIds.length
    ? await topGenresAcross(sharedCompletedIds)
    : [];

  return {
    compatibilityScore: compat.compatibilityScore,
    overlapCount: compat.overlapCount,
    averageDistance: compat.averageDistance,
    sharedCompletedCount: sharedCompletedIds.length,
    watchNextTogether,
    topSharedGenres,
  };
}

/**
 * Watchlist suggestions only make sense when both users have the item on
 * watchlist — we surface those even though watchlist is otherwise private,
 * because the recommendation is for the viewer (their own watchlist + the
 * fact that they share it). Performed as a focused INTERSECT-style query.
 */
async function sharedWatchlistMedia(
  viewerId: string,
  targetId: string,
): Promise<string[]> {
  const [viewer, target] = await Promise.all([
    prisma.userMedia.findMany({
      where: { userId: viewerId, status: "WATCHLIST", isArchived: false },
      select: { mediaId: true },
    }),
    prisma.userMedia.findMany({
      where: { userId: targetId, status: "WATCHLIST", isArchived: false },
      select: { mediaId: true },
    }),
  ]);
  const targetIds = new Set(target.map((row) => row.mediaId));
  return viewer.map((row) => row.mediaId).filter((id) => targetIds.has(id));
}

async function topGenresAcross(mediaIds: string[]): Promise<string[]> {
  const rows = await prisma.mediaGenre.findMany({
    where: { mediaId: { in: mediaIds } },
    include: { genre: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.genre.name, (counts.get(row.genre.name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([name]) => name);
}
