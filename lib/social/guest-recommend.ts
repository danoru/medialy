import { prisma } from "@/lib/prisma";
import { visibleMediaTypeFilter } from "@/lib/media-types";

/**
 * Stateless "recommend something to a guest" flow.
 *
 * Given a handful of titles the guest already likes (the "seeds") plus the
 * viewer's own library, surface items that:
 *  - share genres/tags with the seeds (so the guest is likely to enjoy them), and
 *  - the viewer has rated highly or has on their watchlist (so the viewer is
 *    actually a credible recommender).
 *
 * Intentionally lightweight: no `recomputeMediaScores` integration, no
 * persistence, no signal-by-signal explanations. The full taste graph lives
 * in `lib/recommendations.ts`; this is a deliberately simpler endpoint for
 * the "got a friend over, what should we watch" use case.
 */

export type GuestRecommendation = {
  id: string;
  title: string;
  posterUrl: string | null;
  score: number; // 0–100
  reason: string;
};

const GUEST_GENRE_WEIGHT = 1;
const GUEST_TAG_WEIGHT = 0.6;
const VIEWER_RATING_WEIGHT = 8; // a 9/10 viewer rating contributes ~24 raw points
const VIEWER_WATCHLIST_BONUS = 6;

export async function recommendForGuest({
  viewerId,
  seedMediaIds,
  limit = 12,
}: {
  viewerId: string;
  seedMediaIds: string[];
  limit?: number;
}): Promise<GuestRecommendation[]> {
  if (seedMediaIds.length === 0) return [];

  // 1) Pull the seeds' genres & tags — these define the guest's "taste shape".
  const seeds = await prisma.mediaItem.findMany({
    where: { id: { in: seedMediaIds } },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
    },
  });

  const guestGenres = new Map<string, number>();
  const guestTags = new Map<string, number>();
  for (const seed of seeds) {
    for (const entry of seed.genres) {
      guestGenres.set(
        entry.genre.name,
        (guestGenres.get(entry.genre.name) ?? 0) + 1,
      );
    }
    for (const entry of seed.tags) {
      guestTags.set(entry.tag.name, (guestTags.get(entry.tag.name) ?? 0) + 1);
    }
  }

  // 2) Candidate pool: items not in the seed set, of a visible type. Limit to
  //    the viewer's library + completed/rated items so we never recommend
  //    something the viewer can't speak to.
  const candidates = await prisma.mediaItem.findMany({
    where: {
      mediaType: visibleMediaTypeFilter(),
      id: { notIn: seedMediaIds },
      userMedia: {
        some: {
          userId: viewerId,
          isArchived: false,
          OR: [
            { status: "COMPLETED" },
            { status: "WATCHLIST" },
            { personalRating: { not: null } },
          ],
        },
      },
    },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
      userMedia: { where: { userId: viewerId }, take: 1 },
    },
    take: 500,
  });

  const scored: GuestRecommendation[] = [];
  for (const item of candidates) {
    const sharedGenres = item.genres
      .map((entry) => entry.genre.name)
      .filter((name) => guestGenres.has(name));
    const sharedTags = item.tags
      .map((entry) => entry.tag.name)
      .filter((name) => guestTags.has(name));

    const taxonomyScore =
      sharedGenres.length * GUEST_GENRE_WEIGHT +
      sharedTags.length * GUEST_TAG_WEIGHT;
    if (taxonomyScore === 0) continue;

    const viewerMedia = item.userMedia[0];
    const viewerRating = viewerMedia?.personalRating ?? null;
    const onWatchlist = viewerMedia?.status === "WATCHLIST";
    const viewerScore =
      (viewerRating != null ? Math.max(0, viewerRating - 6) * VIEWER_RATING_WEIGHT : 0) +
      (onWatchlist ? VIEWER_WATCHLIST_BONUS : 0);

    const raw = taxonomyScore * 8 + viewerScore;
    const score = Math.min(100, Math.round(raw));

    const reasonParts: string[] = [];
    if (sharedGenres.length) {
      reasonParts.push(`Shares ${sharedGenres.slice(0, 2).join(" + ")}`);
    }
    if (viewerRating != null && viewerRating >= 8) {
      reasonParts.push(`you rated it ${viewerRating}/10`);
    } else if (onWatchlist) {
      reasonParts.push("on your watchlist");
    }

    scored.push({
      id: item.id,
      title: item.title,
      posterUrl: item.posterUrl,
      score,
      reason:
        reasonParts.length > 0
          ? reasonParts.join(" · ")
          : "Matches what they like",
    });
  }

  scored.sort(
    (a, b) => b.score - a.score || a.title.localeCompare(b.title),
  );
  return scored.slice(0, limit);
}
