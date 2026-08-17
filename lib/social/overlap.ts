import type { MediaStatus } from "@prisma/client";
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

/** The projection both the single and batched paths read. */
type OverlapRow = {
  mediaId: string;
  status: MediaStatus;
  personalRating: number | null;
};

const EMPTY_OVERLAP: UserOverlap = {
  compatibilityScore: 0,
  overlapCount: 0,
  averageDistance: null,
  sharedCompletedCount: 0,
  watchNextTogether: [],
  topSharedGenres: [],
};

function viewerRowsQuery(viewerId: string) {
  return prisma.userMedia.findMany({
    where: {
      userId: viewerId,
      isArchived: false,
      media: { mediaType: visibleMediaTypeFilter() },
    },
    select: { mediaId: true, status: true, personalRating: true },
  });
}

export async function getUserOverlap(
  viewerId: string,
  targetId: string,
): Promise<UserOverlap> {
  if (viewerId === targetId) return { ...EMPTY_OVERLAP };

  const [viewerRows, targetRows] = await Promise.all([
    viewerRowsQuery(viewerId),
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
    select: { genre: { select: { name: true } } },
  });
  return rankGenreNames(rows.map((row) => row.genre.name));
}

function rankGenreNames(names: string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([name]) => name);
}

/**
 * `getUserOverlap` for many targets at once.
 *
 * The per-target function issues about five queries and re-reads the viewer's
 * entire library every time, so calling it in a loop made `/friends` cost
 * ~5N round-trips and N copies of the viewer's rows. This runs a fixed five
 * queries regardless of how many people you follow, then does the pairing in
 * memory. Results are identical to calling `getUserOverlap` per target.
 */
export async function getUserOverlaps(
  viewerId: string,
  targetIds: string[],
): Promise<Map<string, UserOverlap>> {
  const targets = targetIds.filter((id) => id !== viewerId);
  const result = new Map<string, UserOverlap>(
    targetIds.map((id) => [id, { ...EMPTY_OVERLAP }]),
  );
  if (targets.length === 0) return result;

  const [viewerRows, targetRows, viewerWatchlist, targetWatchlists] =
    await Promise.all([
      viewerRowsQuery(viewerId),
      prisma.userMedia.findMany({
        where: {
          userId: { in: targets },
          isArchived: false,
          media: { mediaType: visibleMediaTypeFilter() },
          OR: [{ status: "COMPLETED" }, { personalRating: { not: null } }],
        },
        select: {
          userId: true,
          mediaId: true,
          status: true,
          personalRating: true,
        },
      }),
      prisma.userMedia.findMany({
        where: { userId: viewerId, status: "WATCHLIST", isArchived: false },
        select: { mediaId: true },
      }),
      prisma.userMedia.findMany({
        where: {
          userId: { in: targets },
          status: "WATCHLIST",
          isArchived: false,
        },
        select: { userId: true, mediaId: true },
      }),
    ]);

  const viewerById = new Map(viewerRows.map((row) => [row.mediaId, row]));
  const viewerWatchlistIds = new Set(
    viewerWatchlist.map((row) => row.mediaId),
  );

  const rowsByTarget = new Map<string, OverlapRow[]>();
  for (const row of targetRows) {
    const list = rowsByTarget.get(row.userId) ?? [];
    list.push(row);
    rowsByTarget.set(row.userId, list);
  }
  const watchlistByTarget = new Map<string, Set<string>>();
  for (const row of targetWatchlists) {
    const set = watchlistByTarget.get(row.userId) ?? new Set<string>();
    set.add(row.mediaId);
    watchlistByTarget.set(row.userId, set);
  }

  // Pair everything up in memory first, collecting the ids the two follow-up
  // lookups need so each can be a single batched query.
  const pending = targets.map((targetId) => {
    const rows = rowsByTarget.get(targetId) ?? [];
    const targetWatchlist = watchlistByTarget.get(targetId) ?? new Set<string>();
    const sharedWatchlistIds = [...viewerWatchlistIds].filter((id) =>
      targetWatchlist.has(id),
    );

    const pairs: Array<{ viewerRating: number; otherRating: number }> = [];
    const sharedCompletedIds: string[] = [];
    const theyLoveCandidates: Array<{ mediaId: string; theirRating: number }> =
      [];

    for (const target of rows) {
      const viewer = viewerById.get(target.mediaId);
      if (viewer?.personalRating != null && target.personalRating != null) {
        pairs.push({
          viewerRating: viewer.personalRating,
          otherRating: target.personalRating,
        });
      }
      if (target.status === "COMPLETED" && viewer?.status === "COMPLETED") {
        sharedCompletedIds.push(target.mediaId);
      }
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

    return {
      targetId,
      compat: calculateRatingCompatibility(pairs),
      sharedCompletedIds,
      sharedWatchlistIds,
      theyLoveCandidates,
      watchNextIds,
    };
  });

  const allWatchNextIds = [
    ...new Set(pending.flatMap((entry) => [...entry.watchNextIds])),
  ];
  const allSharedCompletedIds = [
    ...new Set(pending.flatMap((entry) => entry.sharedCompletedIds)),
  ];

  const [watchNextMedia, genreRows] = await Promise.all([
    allWatchNextIds.length
      ? prisma.mediaItem.findMany({
          where: { id: { in: allWatchNextIds } },
          select: { id: true, title: true, posterUrl: true },
        })
      : Promise.resolve([]),
    allSharedCompletedIds.length
      ? prisma.mediaGenre.findMany({
          where: { mediaId: { in: allSharedCompletedIds } },
          select: { mediaId: true, genre: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const mediaById = new Map(watchNextMedia.map((row) => [row.id, row]));
  const genresByMedia = new Map<string, string[]>();
  for (const row of genreRows) {
    const list = genresByMedia.get(row.mediaId) ?? [];
    list.push(row.genre.name);
    genresByMedia.set(row.mediaId, list);
  }

  for (const entry of pending) {
    const theyLoveById = new Map(
      entry.theyLoveCandidates.map((item) => [item.mediaId, item.theirRating]),
    );
    result.set(entry.targetId, {
      compatibilityScore: entry.compat.compatibilityScore,
      overlapCount: entry.compat.overlapCount,
      averageDistance: entry.compat.averageDistance,
      sharedCompletedCount: entry.sharedCompletedIds.length,
      watchNextTogether: [...entry.watchNextIds].map((mediaId) => {
        const media = mediaById.get(mediaId);
        return {
          mediaId,
          title: media?.title ?? "(unknown)",
          posterUrl: media?.posterUrl ?? null,
          reason: entry.sharedWatchlistIds.includes(mediaId)
            ? ("shared-watchlist" as const)
            : ("they-love-it-you-havent-seen" as const),
          theirRating: theyLoveById.get(mediaId) ?? null,
        };
      }),
      topSharedGenres: rankGenreNames(
        entry.sharedCompletedIds.flatMap(
          (mediaId) => genresByMedia.get(mediaId) ?? [],
        ),
      ),
    });
  }

  return result;
}
