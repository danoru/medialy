import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATALOG_CACHE_TAG, CATALOG_REVALIDATE_SECONDS } from "@/lib/cache";
import {
  getFollowCompatibility,
  getGenreInsightsByMediaType,
} from "@/lib/insights";
import { toMediaItemDTO } from "@/lib/media";
import { VISIBLE_MEDIA_TYPES, visibleMediaTypeFilter } from "@/lib/media-types";
import { getRecommendations } from "@/lib/recommendations";
import type { MediaItemDTO } from "@/lib/types";
import { getCurrentUser } from "@/lib/user";
import { startOfToday } from "@/lib/upcoming";
import { getCatalogWithUser } from "@/lib/db/catalog";
import { TOP_RANKING } from "@/lib/scoring/config";
import {
  diversify,
  usualErasFrom,
  usualGenresFrom,
} from "@/lib/scoring/diversity";
import { buildEraExposure, eraOf } from "@/lib/scoring/era";
import { explicitRating } from "@/lib/scoring/recommendationV2";

export function getDashboardUpcomingWhere(
  today = startOfToday(),
): Prisma.MediaItemWhereInput {
  return {
    mediaType: visibleMediaTypeFilter(),
    releaseDate: { gte: today },
  };
}

export const dashboardUpcomingOrderBy = [
  { releaseDate: "asc" },
  { title: "asc" },
] satisfies Prisma.MediaItemOrderByWithRelationInput[];

/**
 * Per media type. The dashboard lists only the nearest few but plots every
 * release inside `UPCOMING_HORIZON_DAYS` on a strip, so the query has to reach
 * past the visible rows. The window stays unbounded on purpose — a library
 * whose next release is beyond the horizon still gets rows to show.
 */
export const DASHBOARD_UPCOMING_TAKE = 24;

type DashboardRecommendationEntry = Awaited<
  ReturnType<typeof getRecommendations>
>[number];

export function getDashboardTopRecommendationsByMediaType(
  recommendations: DashboardRecommendationEntry[],
) {
  return VISIBLE_MEDIA_TYPES.map((mediaType) => ({
    mediaType,
    items: recommendations
      .filter((recommendation) => recommendation.media.mediaType === mediaType)
      .slice(0, 10),
  }));
}

/**
 * Per-item evidence and the global priors needed to shrink it. Computed once
 * per dashboard fetch in `getDashboardData` and threaded into the Top 10 picker.
 */
export type CommunityRatingEvidence = {
  /**
   * Avg of `computedPersonalScore` (Refined) across non-archived users who
   * gave this item an explicit personal rating. Pairwise comparisons made
   * without a personal rating don't contribute — a pure-Elo opinion isn't a
   * grounded enough signal to feed the community average.
   */
  average: number;
  /** How many users contributed. Drives shrinkage strength. */
  voters: number;
};

export type ConsensusEvidence = {
  /** How many distinct external sources backed `computedConsensusScore`. */
  sources: number;
};

export type OverallTopRankingContext = {
  communityByMediaId: Map<string, CommunityRatingEvidence>;
  consensusByMediaId: Map<string, ConsensusEvidence>;
  globalCommunityMean: number;
  globalConsensusMean: number;
};

/** How a Medialy score was reached — enough to show the working. */
export type MedialyScore = {
  /** 0–10. */
  score: number;
  /** Real votes behind the score (critic votes plus ratings, no prior). */
  evidence: number;
  critics: { score: number; sources: number; votes: number } | null;
  /** Medialy users' Refined scores, the viewer's included. */
  ratings: { average: number; count: number } | null;
  /** The catalog-average starting point every title gets. */
  prior: { score: number; votes: number };
  /** True when `evidence` is below `TOP_RANKING.pooled.thinEvidenceVotes`. */
  thinEvidence: boolean;
};

/**
 * The Medialy score: the objective quality score behind the Overall Top 10,
 * Canon and Discover, and the headline score on a title's page. It is the
 * same for every viewer — external consensus plus the Refined scores of users
 * who gave the item an explicit rating, the viewer's included as one vote
 * like anyone else's. No archive state, no affinity; per-user signals belong
 * on Tonight's Pick / Up Next.
 *
 * Everything goes into one weighted average (see `TOP_RANKING.pooled`):
 * critic sources and ratings are votes, and the catalog average holds a fixed
 * number of votes as the starting point. This replaced averaging a shrunk
 * critic score with a shrunk community score 50/50, which let two ratings
 * weigh as much as all the critic data and capped any title with a couple of
 * ratings below a critics-only one.
 */
export function dashboardQualityScore(
  consensusScore: number | null | undefined,
  community: CommunityRatingEvidence | null | undefined,
  consensus: ConsensusEvidence | null | undefined,
  globalCommunityMean: number,
  globalConsensusMean: number,
): MedialyScore | null {
  const { criticVotesPerSource, priorVotes, thinEvidenceVotes } =
    TOP_RANKING.pooled;

  const ratings =
    community && community.voters > 0
      ? { average: community.average, count: community.voters }
      : null;
  // Defensive default: if the consensus score exists, *some* source produced
  // it. Treat unknown counts as 1 so we don't silently drop it.
  const critics =
    typeof consensusScore === "number"
      ? (() => {
          const sources = Math.max(consensus?.sources ?? 0, 1);
          return {
            score: consensusScore,
            sources,
            votes: sources * criticVotesPerSource,
          };
        })()
      : null;
  if (!ratings && !critics) return null;

  const prior = {
    score: (globalCommunityMean + globalConsensusMean) / 2,
    votes: priorVotes,
  };
  const evidence = (critics?.votes ?? 0) + (ratings?.count ?? 0);
  const weighted =
    (critics ? critics.score * critics.votes : 0) +
    (ratings ? ratings.average * ratings.count : 0) +
    prior.score * prior.votes;

  return {
    score: weighted / (evidence + prior.votes),
    evidence,
    critics,
    ratings,
    prior,
    thinEvidence: evidence < thinEvidenceVotes,
  };
}

/**
 * The raw cross-user aggregates behind the ranking context (community averages,
 * external-source counts, two global priors). Split out and cached because the
 * result is a serializable, viewer-independent snapshot that changes slowly —
 * see lib/cache.ts. The `Map`-shaped {@link OverallTopRankingContext} is
 * assembled from this outside the cache (Maps don't survive JSON serialization).
 */
const getRawRankingAggregates = unstable_cache(
  async () => {
    const [
      overallCommunityRatings,
      overallConsensusSourceCounts,
      globalCommunityAggregate,
      globalConsensusAggregate,
    ] = await Promise.all([
      prisma.userMedia.groupBy({
        by: ["mediaId"],
        where: { isArchived: false, personalRating: { not: null } },
        _avg: { computedPersonalScore: true },
        _count: { computedPersonalScore: true },
      }),
      prisma.externalRating.groupBy({
        by: ["mediaId"],
        _count: { _all: true },
      }),
      prisma.userMedia.aggregate({
        where: { isArchived: false, personalRating: { not: null } },
        _avg: { computedPersonalScore: true },
      }),
      prisma.mediaItem.aggregate({
        where: { computedConsensusScore: { not: null } },
        _avg: { computedConsensusScore: true },
      }),
    ]);
    return {
      overallCommunityRatings,
      overallConsensusSourceCounts,
      globalCommunityMean:
        globalCommunityAggregate._avg.computedPersonalScore ?? null,
      globalConsensusMean:
        globalConsensusAggregate._avg.computedConsensusScore ?? null,
    };
  },
  ["overall-ranking-aggregates"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] },
);

export async function buildOverallTopRankingContext(): Promise<OverallTopRankingContext> {
  const {
    overallCommunityRatings,
    overallConsensusSourceCounts,
    globalCommunityMean: rawCommunityMean,
    globalConsensusMean: rawConsensusMean,
  } = await getRawRankingAggregates();

  const communityByMediaId = new Map<string, CommunityRatingEvidence>();
  for (const row of overallCommunityRatings) {
    if (row._avg.computedPersonalScore != null) {
      communityByMediaId.set(row.mediaId, {
        average: row._avg.computedPersonalScore,
        voters: row._count.computedPersonalScore,
      });
    }
  }
  const consensusByMediaId = new Map<string, ConsensusEvidence>();
  for (const row of overallConsensusSourceCounts) {
    consensusByMediaId.set(row.mediaId, { sources: row._count._all });
  }
  const globalCommunityMean = rawCommunityMean ?? TOP_RANKING.fallbackPrior;
  const globalConsensusMean = rawConsensusMean ?? TOP_RANKING.fallbackPrior;

  return {
    communityByMediaId,
    consensusByMediaId,
    globalCommunityMean,
    globalConsensusMean,
  };
}

export function getDashboardOverallTopItemsByMediaType(
  items: MediaItemDTO[],
  context: OverallTopRankingContext,
  limit = 10,
) {
  return VISIBLE_MEDIA_TYPES.map((mediaType) => ({
    mediaType,
    items: items
      .filter((item) => item.mediaType === mediaType)
      .flatMap((media) => {
        const ranked = dashboardQualityScore(
          media.computedConsensusScore,
          context.communityByMediaId.get(media.id),
          context.consensusByMediaId.get(media.id),
          context.globalCommunityMean,
          context.globalConsensusMean,
        );
        return ranked == null ? [] : [{ media, ...ranked }];
      })
      .sort((first, second) => {
        const scoreDelta = second.score - first.score;
        if (scoreDelta !== 0) return scoreDelta;
        // Items with more total evidence win ties — broader sample is more
        // trustworthy at the same blended score.
        const evidenceDelta = second.evidence - first.evidence;
        if (evidenceDelta !== 0) return evidenceDelta;
        return first.media.title.localeCompare(second.media.title);
      })
      .slice(0, limit),
  }));
}

/**
 * Tonight's picks: five per media type, chosen for variety rather than as
 * the raw top five. Near-duplicates (same franchise, creator or genre mix)
 * are pushed down and one slot goes to a strong pick outside the viewer's
 * usual genres or eras. See `lib/scoring/diversity.ts`.
 *
 * Variety decides which five make the row; the row itself reads best-first by
 * Match, since that's the number each card shows. The featured pick is the top
 * score either way.
 */
export function getDashboardTonightPicksByMediaType(
  recommendations: DashboardRecommendationEntry[],
  usualGenresByType: Map<string, ReadonlySet<string>> = new Map(),
  usualErasByType: Map<string, ReadonlySet<string>> = new Map(),
) {
  return VISIBLE_MEDIA_TYPES.map((mediaType) => {
    const pool = recommendations
      .filter((recommendation) => recommendation.media.mediaType === mediaType)
      .slice(0, DASHBOARD_PICK_POOL);
    const byId = new Map(pool.map((entry) => [entry.media.id, entry]));
    const picks = diversify(
      pool.map((entry) => ({
        id: entry.media.id,
        score: entry.score,
        genres: entry.media.genres,
        tags: entry.media.tags,
        creators: (entry.media.credits ?? [])
          .filter((credit) => credit.role !== "ACTOR")
          .map((credit) => `${credit.role}:${credit.name}`),
        era: eraOf(entry.media.releaseDate),
      })),
      {
        limit: 5,
        usualGenres: usualGenresByType.get(mediaType),
        usualEras: usualErasByType.get(mediaType),
      },
    );
    return {
      mediaType,
      recommendations: [...picks]
        .sort((a, b) => b.score - a.score)
        .map((pick) => byId.get(pick.id)!),
    };
  });
}

/** How far down the ranked list the variety pass may reach. */
const DASHBOARD_PICK_POOL = 30;

export async function getDashboardData() {
  const today = startOfToday();
  const user = await getCurrentUser();
  // Anonymous viewers see a sensible default dashboard built from public
  // signals. We use a sentinel id that never matches any UserMedia row so
  // the per-user joins all collapse to defaults.
  const userId = user?.id ?? "__anonymous__";

  // Everything below that used to be its own catalog query is now derived from
  // the one shared (and cross-request cached) catalog read. The Overall Top
  // pool *is* that catalog: it's intentionally global — no archive filter — so
  // the viewer's archive state can't shape the ranking.
  const [
    mergedOverallTopItems,
    recommendations,
    genreInsights,
    followCompatibility,
    followingCount,
    topRankingContext,
  ] = await Promise.all([
    getCatalogWithUser(userId),
    getRecommendations(),
    getGenreInsightsByMediaType(),
    getFollowCompatibility(userId),
    user
      ? prisma.userFollow.count({ where: { followerId: userId } })
      : Promise.resolve(0),
    buildOverallTopRankingContext(),
  ]);

  // An item is "active" for this user when it isn't archived — which, on merged
  // rows, covers both the "no UserMedia row yet" and "row exists" cases the old
  // relation filter spelled out.
  const activeItems = mergedOverallTopItems.filter((item) => !item.isArchived);
  const mediaTypeCounts = VISIBLE_MEDIA_TYPES.map((mediaType) => ({
    mediaType,
    _count: {
      _all: activeItems.filter((item) => item.mediaType === mediaType).length,
    },
  })).sort((first, second) => first.mediaType.localeCompare(second.mediaType));

  // Same window and ordering as the old per-type queries
  // (`getDashboardUpcomingWhere` + `dashboardUpcomingOrderBy` + take).
  const upcomingPool = mergedOverallTopItems
    .filter((item) => item.releaseDate != null && item.releaseDate >= today)
    .sort(
      (first, second) =>
        (first.releaseDate?.getTime() ?? 0) -
          (second.releaseDate?.getTime() ?? 0) ||
        first.title.localeCompare(second.title),
    );
  const mergedUpcomingByType = VISIBLE_MEDIA_TYPES.map((mediaType) => ({
    mediaType,
    items: upcomingPool
      .filter((item) => item.mediaType === mediaType)
      .slice(0, DASHBOARD_UPCOMING_TAKE),
  }));

  const topItemsByMediaType = getDashboardOverallTopItemsByMediaType(
    mergedOverallTopItems.map(toMediaItemDTO),
    topRankingContext,
  );
  // The viewer's usual genres per medium, from what they have rated, so the
  // variety pass knows what "adventurous" means for them.
  const usualGenresByType = new Map(
    VISIBLE_MEDIA_TYPES.map((mediaType) => [
      mediaType,
      usualGenresFrom(
        mergedOverallTopItems
          .filter(
            (item) =>
              item.mediaType === mediaType &&
              explicitRating(item.personalRating) != null,
          )
          .map((item) => item.genres.map((entry) => entry.genre.name)),
      ),
    ]),
  );
  // And the eras they usually watch, from everything they track.
  const exposure = buildEraExposure(
    mergedOverallTopItems.map((item) => ({
      media: item,
      status: item.status,
      isArchived: item.isArchived,
    })),
  );
  const usualErasByType = new Map(
    VISIBLE_MEDIA_TYPES.map((mediaType) => [
      mediaType,
      usualErasFrom(exposure.get(mediaType)?.counts ?? new Map()),
    ]),
  );
  const tonightPicksByMediaType = getDashboardTonightPicksByMediaType(
    recommendations,
    usualGenresByType,
    usualErasByType,
  );

  return {
    userName: user?.displayName ?? null,
    topItemsByMediaType,
    recommendations: recommendations.slice(0, 18),
    tonightPicksByMediaType,
    genreInsights,
    mediaTypeCounts: mediaTypeCounts.map((entry) => ({
      mediaType: entry.mediaType,
      count: entry._count._all,
    })),
    upcomingItemsByMediaType: mergedUpcomingByType.map((entry) => ({
      mediaType: entry.mediaType,
      items: entry.items.map(toMediaItemDTO),
    })),
    followCompatibility: followCompatibility.slice(0, 5),
    followingCount,
  };
}
