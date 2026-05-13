import { prisma } from "@/lib/prisma";
import { confidenceFromComparisons } from "@/lib/scoring";
import { toMediaItemDTO } from "@/lib/media";
import { visibleMediaTypeFilter } from "@/lib/media-types";
import type { Recommendation, RecommendationReason } from "@/lib/types";

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
      tags: { include: { tag: true } },
      friendRatings: { include: { friend: true } },
    },
    orderBy: [{ pairwiseScore: "desc" }],
  });

  const affinity = await getAffinityMaps();

  const recommendations = items
    .map((item) => {
      const reasons: RecommendationReason[] = [];
      const confidence = confidenceFromComparisons(item.comparisonCount);
      let score = item.pairwiseScore;

      if (item.status === "WATCHLIST" || item.status === "BACKLOG") {
        score += item.status === "WATCHLIST" ? 75 : 45;
        reasons.push({
          label: item.status === "WATCHLIST" ? "Watchlist" : "Backlog",
          value: item.status === "WATCHLIST" ? 75 : 45,
        });
      }

      const genreBoost = item.genres.reduce(
        (total, entry) => total + (affinity.genres.get(entry.genre.name) ?? 0),
        0,
      );
      if (genreBoost > 0) {
        score += genreBoost;
        reasons.push({ label: "Genre affinity", value: genreBoost });
      }

      const tagBoost = item.tags.reduce(
        (total, entry) => total + (affinity.tags.get(entry.tag.name) ?? 0),
        0,
      );
      if (tagBoost > 0) {
        score += tagBoost;
        reasons.push({ label: "Tag affinity", value: tagBoost });
      }

      if (item.upcomingDate && item.upcomingDate.getTime() >= Date.now()) {
        score += 30;
        reasons.push({ label: "Upcoming", value: 30 });
      }

      const friendBoost = averageFriendBoost(item.friendRatings);
      if (friendBoost > 0) {
        score += friendBoost;
        reasons.push({ label: "Friend signal", value: friendBoost });
      }

      const confidencePenalty = Math.round((1 - confidence) * 80);
      if (confidencePenalty > 0) {
        score -= confidencePenalty;
        reasons.push({
          label: "Low data confidence",
          value: -confidencePenalty,
        });
      }

      if (reasons.length === 0) {
        reasons.push({
          label: "Pairwise score",
          value: Math.round(item.pairwiseScore),
        });
      }

      return {
        media: toMediaItemDTO(item),
        score,
        confidence,
        reasons,
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
      OR: [{ personalRating: { gte: 8 } }, { pairwiseScore: { gte: 1150 } }],
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
      Math.min(35, (item.pairwiseScore - 1000) / 10),
    );
    for (const entry of item.genres) {
      genres.set(
        entry.genre.name,
        (genres.get(entry.genre.name) ?? 0) + itemBoost,
      );
    }
    for (const entry of item.tags) {
      tags.set(entry.tag.name, (tags.get(entry.tag.name) ?? 0) + itemBoost / 2);
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
