import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";
import { calculateMedialyMatch } from "@/lib/scoring/medialyMatch";
import {
  personalScoreTrustForStatus,
  recommendationEligibilityWhere,
  type EligibilityOptions,
} from "@/lib/scoring/eligibility";
import { toMediaItemDTO } from "@/lib/media";
import { visibleMediaTypeFilter } from "@/lib/media-types";
import type { Recommendation, RecommendationReason } from "@/lib/types";
import { GENRE_WEIGHT, TAG_WEIGHT } from "@/lib/scoring/taxonomySimilarity";
import {
  EXCLUDED_RECOMMENDATION_STATUSES,
  isRecommendationEligibleStatus,
  recommendationPersonalScoreTrust,
  recommendationStatusSignal,
} from "@/lib/recommendation-policy";
import type { Prisma } from "@prisma/client";

export {
  EXCLUDED_RECOMMENDATION_STATUSES,
  isRecommendationEligibleStatus,
  recommendationPersonalScoreTrust,
  recommendationStatusSignal,
};

export async function getRecommendations(
  limit?: number,
  eligibility: EligibilityOptions = {},
): Promise<Recommendation[]> {
  // Anonymous viewers get a best-effort recommendations list built from
  // public signals (no personal taste graph). A sentinel id makes the
  // per-user joins consistently return defaults.
  const userId = (await getCurrentUserId()) ?? "__anonymous__";
  const rawItems = await prisma.mediaItem.findMany({
    where: {
      mediaType: visibleMediaTypeFilter(),
      ...recommendationEligibilityWhere({ ...eligibility, userId }),
    },
    include: {
      genres: { include: { genre: true } },
      tags: { where: { tag: { status: "APPROVED" } }, include: { tag: true } },
      friendRatings: { include: { friend: true } },
      credits: { include: { contributor: true } },
      ...userMediaInclude(userId),
    },
  });

  const items = rawItems
    .map(mergeUserMedia)
    .sort(
      (a, b) =>
        (b.computedPersonalScore ?? -Infinity) -
          (a.computedPersonalScore ?? -Infinity) ||
        b.pairwiseScore - a.pairwiseScore,
    );

  const affinity = await getAffinityMaps(userId);

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
      const contributorAffinity = item.credits.reduce(
        (total, entry) =>
          total + (affinity.contributors.get(entry.contributor.id) ?? 0),
        0,
      );
      const friendAffinity = averageFriendBoost(item.friendRatings);
      const hasExplicitRating = item.personalRating != null;
      const personalScoreTrust = personalScoreTrustForStatus(
        item.status,
        hasExplicitRating,
      );
      const match = calculateMedialyMatch({
        personalScore:
          item.personalRating ??
          item.computedPersonalScore ??
          item.pairwiseScore / 100,
        personalScoreTrust,
        genreAffinity,
        tagAffinity,
        friendAffinity,
        contributorAffinity,
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
        explanations: match.explanations,
      };
    })
    .sort((a, b) => {
      const scoreDelta = b.score - a.score;
      if (scoreDelta !== 0) return scoreDelta;
      // Deterministic tiebreaker: confidence, then title.
      const confidenceDelta = (b.confidence ?? 0) - (a.confidence ?? 0);
      if (confidenceDelta !== 0) return confidenceDelta;
      return a.media.title.localeCompare(b.media.title);
    });

  return typeof limit === "number"
    ? recommendations.slice(0, limit)
    : recommendations;
}

/**
 * @deprecated Use `recommendationEligibilityWhere` from
 * `@/lib/scoring/eligibility`. Retained for callers that still need just the
 * release-date filter.
 */
export function getRecommendationReleaseDateWhere(
  now = new Date(),
): Prisma.MediaItemWhereInput {
  return recommendationEligibilityWhere({ now });
}

async function getAffinityMaps(userId: string) {
  const completed = await prisma.userMedia.findMany({
    where: {
      userId,
      isArchived: false,
      status: "COMPLETED",
      media: { mediaType: visibleMediaTypeFilter() },
      OR: [
        { computedPersonalScore: { gte: 8 } },
        { personalRating: { gte: 8 } },
        { pairwiseScore: { gte: 1150 } },
      ],
    },
    include: {
      media: {
        include: {
          genres: { include: { genre: true } },
          tags: { include: { tag: true } },
          credits: { include: { contributor: true } },
        },
      },
    },
  });

  const genres = new Map<string, number>();
  const tags = new Map<string, number>();
  const contributors = new Map<string, number>();

  const TAG_RATIO = TAG_WEIGHT / GENRE_WEIGHT;
  const CONTRIBUTOR_RATIO = 0.6; // contributors weighted between genres and tags

  for (const row of completed) {
    const itemBoost = Math.max(
      10,
      Math.min(
        35,
        ((row.computedPersonalScore ?? row.personalRating ?? 5) - 5) * 10,
      ),
    );
    for (const entry of row.media.genres) {
      genres.set(
        entry.genre.name,
        (genres.get(entry.genre.name) ?? 0) + itemBoost,
      );
    }
    for (const entry of row.media.tags) {
      tags.set(
        entry.tag.name,
        (tags.get(entry.tag.name) ?? 0) + itemBoost * TAG_RATIO,
      );
    }
    for (const entry of row.media.credits) {
      contributors.set(
        entry.contributor.id,
        (contributors.get(entry.contributor.id) ?? 0) +
          itemBoost * CONTRIBUTOR_RATIO,
      );
    }
  }

  return { genres, tags, contributors };
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
