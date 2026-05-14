import { prisma } from "@/lib/prisma";
import { calculateMedialyMatch } from "@/lib/scoring/medialyMatch";
import { toMediaItemDTO } from "@/lib/media";
import { visibleMediaTypeFilter } from "@/lib/media-types";
import type { Recommendation, RecommendationReason } from "@/lib/types";
import { GENRE_WEIGHT, TAG_WEIGHT } from "@/lib/scoring/taxonomySimilarity";

export async function getRecommendations(
  limit?: number,
): Promise<Recommendation[]> {
  const items = await prisma.mediaItem.findMany({
    where: {
      isArchived: false,
      mediaType: visibleMediaTypeFilter(),
      status: { notIn: ["COMPLETED", "DROPPED"] },
    },
    include: {
      genres: { include: { genre: true } },
      tags: { where: { tag: { status: "APPROVED" } }, include: { tag: true } },
      friendRatings: { include: { friend: true } },
    },
    orderBy: [{ computedPersonalScore: "desc" }, { pairwiseScore: "desc" }],
  });

  const affinity = await getAffinityMaps();

  const recommendations = items
    .map((item) => {
      const genreAffinity = item.genres.reduce(
        (total, entry) => total + (affinity.genres.get(entry.genre.name) ?? 0),
        0,
      );
      const tagAffinity = item.tags.reduce(
        (total, entry) => total + (affinity.tags.get(entry.tag.name) ?? 0),
        0,
      );
      const friendAffinity = averageFriendBoost(item.friendRatings);
      const statusSignal =
        item.status === "WATCHLIST" ? 100 : item.status === "BACKLOG" ? 70 : 35;
      const upcomingSignal =
        item.releaseDate && item.releaseDate.getTime() >= Date.now()
          ? 100
          : 0;
      const match = calculateMedialyMatch({
        personalScore:
          item.computedPersonalScore ??
          item.personalRating ??
          item.pairwiseScore / 100,
        genreAffinity,
        tagAffinity,
        friendAffinity,
        status: statusSignal,
        upcoming: upcomingSignal,
        consensusScore: item.computedConsensusScore,
      });

      const confidence = Math.max(
        item.personalScoreConfidence ?? 0,
        item.consensusConfidence ?? 0,
      );

      return {
        media: toMediaItemDTO(item),
        score: match.score,
        confidence,
        reasons: match.reasons as RecommendationReason[],
      };
    })
    .sort((a, b) => b.score - a.score);

  return typeof limit === "number"
    ? recommendations.slice(0, limit)
    : recommendations;
}

async function getAffinityMaps() {
  const completed = await prisma.mediaItem.findMany({
    where: {
      isArchived: false,
      mediaType: visibleMediaTypeFilter(),
      status: "COMPLETED",
      OR: [
        { computedPersonalScore: { gte: 8 } },
        { personalRating: { gte: 8 } },
        { pairwiseScore: { gte: 1150 } },
      ],
    },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
    },
  });

  const genres = new Map<string, number>();
  const tags = new Map<string, number>();

  for (const item of completed) {
    const itemBoost = Math.max(
      10,
      Math.min(
        35,
        ((item.computedPersonalScore ?? item.personalRating ?? 5) - 5) * 10,
      ),
    );
    for (const entry of item.genres) {
      genres.set(
        entry.genre.name,
        (genres.get(entry.genre.name) ?? 0) + itemBoost,
      );
    }
    for (const entry of item.tags) {
      tags.set(
        entry.tag.name,
        (tags.get(entry.tag.name) ?? 0) +
          itemBoost * (TAG_WEIGHT / GENRE_WEIGHT),
      );
    }
  }

  return { genres, tags };
}

function averageFriendBoost(
  ratings: Array<{ rating: number | null; status: string | null }>,
) {
  if (ratings.length === 0) return 0;
  const total = ratings.reduce((sum, rating) => {
    const ratingBoost = rating.rating
      ? Math.max(0, (rating.rating - 6) * 10)
      : 0;
    const statusBoost =
      rating.status === "COMPLETED" ? 8 : rating.status === "WATCHLIST" ? 5 : 0;
    return sum + ratingBoost + statusBoost;
  }, 0);
  return Math.round(total / ratings.length);
}
