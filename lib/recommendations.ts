import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";
import { calculateMedialyMatch } from "@/lib/scoring/medialyMatch";
import {
  matchesRecommendationEligibility,
  recommendationEligibilityWhere,
  type EligibilityOptions,
} from "@/lib/scoring/eligibility";
import { getCatalogItems, getCatalogWithUser } from "@/lib/db/catalog";
import { calculateRatingCompatibility } from "@/lib/scoring/compatibility";
import { FRIEND_SIGNAL } from "@/lib/scoring/config";
import {
  buildAffinityMaps,
  candidateAffinity,
  type AffinityMaps,
  type ContributorAffinity,
} from "@/lib/scoring/affinityProfile";
import { mediaTypeNoun } from "@/lib/format";
import { toMediaItemDTO } from "@/lib/media";
import { visibleMediaTypeFilter } from "@/lib/media-types";
import type { Recommendation, RecommendationReason } from "@/lib/types";
import {
  EXCLUDED_RECOMMENDATION_STATUSES,
  isRecommendationEligibleStatus,
  recommendationPersonalScoreTrust,
  recommendationStatusSignal,
} from "@/lib/recommendation-policy";
import { getFollowingIds } from "@/lib/social/follows";
import {
  getRecommendationsV2,
  toRecommendation,
} from "@/lib/recommendations-v2";
import type { Prisma } from "@prisma/client";

export type { AffinityMaps } from "@/lib/scoring/affinityProfile";

export {
  EXCLUDED_RECOMMENDATION_STATUSES,
  isRecommendationEligibleStatus,
  recommendationPersonalScoreTrust,
  recommendationStatusSignal,
};

/**
 * The live recommendation list: the v2 taste engine, calibrated so `score`
 * is the chance the viewer rates the title above their own average. See
 * `lib/scoring/recommendationV2.ts` for the signals.
 */
export async function getRecommendations(
  limit?: number,
  eligibility: EligibilityOptions = {},
  userIdOverride?: string,
): Promise<Recommendation[]> {
  // Anonymous viewers get a best-effort list built from public signals (no
  // personal taste graph). A sentinel id makes the per-user joins
  // consistently return defaults.
  const userId =
    userIdOverride ?? (await getCurrentUserId()) ?? "__anonymous__";
  const ranked = await getRecommendationsV2(userId, eligibility);
  const recommendations = ranked.map(toRecommendation);
  return typeof limit === "number"
    ? recommendations.slice(0, limit)
    : recommendations;
}

/**
 * The previous engine (affinity buckets plus a coverage-style confidence),
 * kept for the side-by-side comparison on /data-health/recommendations and
 * as the holdout baseline. Not used by any product page.
 */
export async function getRecommendationsV1(
  limit?: number,
  eligibility: EligibilityOptions = {},
  userIdOverride?: string,
): Promise<Recommendation[]> {
  const userId =
    userIdOverride ?? (await getCurrentUserId()) ?? "__anonymous__";

  // Reads the shared cached catalog rather than its own full-table scan, so a
  // dashboard render pays for the catalog once. Eligibility and the APPROVED
  // tag filter therefore move from SQL into JS — `matchesRecommendationEligibility`
  // is the exact twin of the `where` clause this used to build.
  const catalog = await getCatalogWithUser(userId);
  const items = catalog
    .filter((item) =>
      matchesRecommendationEligibility(item, { ...eligibility, userId }),
    )
    .map((item) => ({
      ...item,
      tags: item.tags.filter((entry) => entry.tag.status === "APPROVED"),
    }))
    .sort(
      (a, b) =>
        (b.computedPersonalScore ?? -Infinity) -
          (a.computedPersonalScore ?? -Infinity) ||
        b.pairwiseScore - a.pairwiseScore,
    );

  const [affinity, followedRatingsByMedia] = await Promise.all([
    getAffinityMaps(userId),
    getFollowedUserRatingsByMedia(
      userId,
      items.map((item) => item.id),
    ),
  ]);
  const followerCompatibility = await getFollowerCompatibilityMap(
    userId,
    followedRatingsByMedia,
  );

  const recommendations = items
    .map((item) => {
      const { genreAffinity, tagAffinity, contributorAffinity } =
        candidateAffinity(item, affinity);

      const contributorDetail = buildContributorDetail(
        item.credits,
        affinity,
        item.mediaType,
      );
      const countryDetail = buildCountryDetail(item.tags, affinity);
      const friendSignal = computeFriendSignal(
        followedRatingsByMedia.get(item.id) ?? [],
        followerCompatibility,
      );
      const match = calculateMedialyMatch({
        genreAffinity,
        tagAffinity,
        friendAffinity: friendSignal.value,
        contributorAffinity,
        consensusScore: item.computedConsensusScore,
        details: {
          ...(contributorDetail && { contributorAffinity: contributorDetail }),
          ...(countryDetail && { tagAffinity: countryDetail }),
          ...(friendSignal.detail && { friendAffinity: friendSignal.detail }),
        },
      });

      // Signal coverage: sum the weights of inputs that actually had data.
      // Reads as "this recommendation is backed by N% of our possible inputs"
      // — distinct from `score`, which is "how strong were the signals we did
      // have". A critic-only candidate caps at 0.20; a fully-supported one hits 1.
      const confidence = match.explanations.reduce(
        (total, entry) => total + (entry.rawValue > 0 ? entry.weight : 0),
        0,
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


export async function getAffinityMaps(
  userId: string,
  options: { excludeMediaId?: string } = {},
): Promise<AffinityMaps> {
  // The taxonomy this reads is already in the shared cached catalog, so only
  // the thin per-user rows are fetched and the media side is joined in memory.
  // The media-type filter stays in SQL — it narrows rows without sending any
  // extra columns.
  const [ratedRows, catalog] = await Promise.all([
    prisma.userMedia.findMany({
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
        ...(options.excludeMediaId
          ? { mediaId: { not: options.excludeMediaId } }
          : {}),
      },
      select: {
        mediaId: true,
        computedPersonalScore: true,
        personalRating: true,
      },
    }),
    getCatalogItems(),
  ]);

  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const rows = ratedRows.flatMap((row) => {
    const media = catalogById.get(row.mediaId);
    if (!media) return [];
    const rating = row.computedPersonalScore ?? row.personalRating ?? 0;
    return [{ rating, media }];
  });

  return buildAffinityMaps(rows);
}

export function buildContributorDetail(
  credits: Array<{ contributor: { id: string }; role: string }>,
  affinity: AffinityMaps,
  mediaType: string,
): string | undefined {
  type Match = ContributorAffinity & { role: string };
  let best: Match | undefined;
  for (const credit of credits) {
    const entry = affinity.contributors.get(credit.contributor.id);
    if (!entry) continue;
    const candidate: Match = { ...entry, role: credit.role };
    if (!best || candidate.weight > best.weight) best = candidate;
  }
  if (!best) return undefined;

  const verb = ROLE_VERB[best.role] ?? "credited on";
  const noun = mediaTypeNoun(mediaType, best.exampleCount);
  const head = `You've rated ${best.exampleCount} ${noun} ${verb} ${best.name} highly`;
  if (best.exampleCount === 1) {
    return `${head} (${best.topExample.title}, ${best.topExample.rating}/10)`;
  }
  return head;
}

function buildCountryDetail(
  tags: Array<{ tag: { category: string; countryCode: string | null; name: string } }>,
  affinity: AffinityMaps,
): string | undefined {
  let best: { name: string; count: number } | undefined;
  for (const entry of tags) {
    if (entry.tag.category !== "COUNTRY" || !entry.tag.countryCode) continue;
    const match = affinity.countries.get(entry.tag.countryCode);
    if (!match) continue;
    if (!best || match.exampleCount > best.count) {
      best = { name: entry.tag.name, count: match.exampleCount };
    }
  }
  if (!best) return undefined;
  const noun = best.count === 1 ? "favorite" : "favorites";
  return `Shares country (${best.name}) with ${best.count} of your ${noun}`;
}

const ROLE_VERB: Record<string, string> = {
  DIRECTOR: "directed by",
  CREATOR: "created by",
  DEVELOPER: "developed by",
  PUBLISHER: "published by",
  ACTOR: "starring",
};


/**
 * For each candidate mediaId, fetch the public ratings + completion status
 * from users the viewer follows. One follower contributes at most one rating
 * per item by construction (UserMedia.@@unique([userId, mediaId])), so no
 * extra capping is required. Anonymous viewers get an empty map.
 */
type FollowerRating = {
  userId: string;
  rating: number | null;
  status: string | null;
};

export async function getFollowedUserRatingsByMedia(
  viewerId: string,
  mediaIds: string[],
): Promise<Map<string, FollowerRating[]>> {
  if (viewerId === "__anonymous__" || mediaIds.length === 0) return new Map();
  const followingIds = await getFollowingIds(viewerId);
  if (followingIds.length === 0) return new Map();

  const rows = await prisma.userMedia.findMany({
    where: {
      userId: { in: followingIds },
      mediaId: { in: mediaIds },
      isArchived: false,
      OR: [{ status: "COMPLETED" }, { personalRating: { not: null } }],
    },
    select: { userId: true, mediaId: true, personalRating: true, status: true },
  });

  const byMedia = new Map<string, FollowerRating[]>();
  for (const row of rows) {
    const current = byMedia.get(row.mediaId) ?? [];
    current.push({
      userId: row.userId,
      rating: row.personalRating,
      status: row.status,
    });
    byMedia.set(row.mediaId, current);
  }
  return byMedia;
}

/** A follower's taste agreement with the viewer and how much evidence backs it. */
export type FollowerTrust = {
  /** 0–100 from `calculateRatingCompatibility`; 50 when there is no overlap. */
  compatibility: number;
  /** Titles both the viewer and the follower have rated. */
  overlap: number;
};

/**
 * Per-follower taste compatibility (0–100) against the viewer, plus the
 * overlap count that produced it. Computed once per request from overlapping
 * rated items. Returned map is keyed by followerId; missing followers default
 * to neutral with zero overlap at lookup time.
 */
export async function getFollowerCompatibilityMap(
  viewerId: string,
  followedByMedia: Map<string, FollowerRating[]>,
): Promise<Map<string, FollowerTrust>> {
  if (viewerId === "__anonymous__") return new Map();
  const followerIds = new Set<string>();
  for (const rows of followedByMedia.values()) {
    for (const row of rows) followerIds.add(row.userId);
  }
  if (followerIds.size === 0) return new Map();

  const [viewerRated, followerRated] = await Promise.all([
    prisma.userMedia.findMany({
      where: {
        userId: viewerId,
        isArchived: false,
        personalRating: { not: null },
      },
      select: { mediaId: true, personalRating: true },
    }),
    prisma.userMedia.findMany({
      where: {
        userId: { in: [...followerIds] },
        isArchived: false,
        personalRating: { not: null },
      },
      select: { userId: true, mediaId: true, personalRating: true },
    }),
  ]);

  const viewerById = new Map(
    viewerRated.map((row) => [row.mediaId, row.personalRating!]),
  );

  const pairsByFollower = new Map<
    string,
    Array<{ viewerRating: number; otherRating: number }>
  >();
  for (const row of followerRated) {
    const viewerRating = viewerById.get(row.mediaId);
    if (viewerRating == null || row.personalRating == null) continue;
    const list = pairsByFollower.get(row.userId) ?? [];
    list.push({ viewerRating, otherRating: row.personalRating });
    pairsByFollower.set(row.userId, list);
  }

  const trust = new Map<string, FollowerTrust>();
  for (const followerId of followerIds) {
    const pairs = pairsByFollower.get(followerId) ?? [];
    if (pairs.length === 0) {
      trust.set(followerId, { compatibility: 50, overlap: 0 });
      continue;
    }
    const result = calculateRatingCompatibility(pairs);
    trust.set(followerId, {
      compatibility: result.compatibilityScore,
      overlap: result.overlapCount,
    });
  }
  return trust;
}

/**
 * Compatibility shrunk toward neutral by how many shared ratings back it, then
 * mapped to a 0–1 weight. See `FRIEND_SIGNAL` for the reasoning.
 */
export function followerWeight(trust: FollowerTrust | undefined) {
  const compatibility = trust?.compatibility ?? 50;
  const overlap = trust?.overlap ?? 0;
  const reliability = overlap / (overlap + FRIEND_SIGNAL.overlapPrior);
  const effective = 50 + (compatibility - 50) * reliability;
  return effective / 100;
}

/** One follower's opinion of a title as a 0–100 value; 0 means no opinion. */
export function followerOpinion(entry: FollowerRating) {
  if (entry.rating != null) {
    return Math.max(0, Math.min(100, (entry.rating - 5) * 20));
  }
  if (entry.status === "COMPLETED") return FRIEND_SIGNAL.completedInterest;
  if (entry.status === "WATCHLIST") return FRIEND_SIGNAL.watchlistInterest;
  return 0;
}

export function computeFriendSignal(
  ratings: FollowerRating[],
  followerTrust: Map<string, FollowerTrust>,
): { value: number; detail?: string } {
  if (ratings.length === 0) return { value: 0 };

  let weightedSum = 0;
  let weightTotal = 0;
  let topRater: { rating: number; compatibility: number } | undefined;

  for (const entry of ratings) {
    const trust = followerTrust.get(entry.userId);
    const weight = followerWeight(trust);
    weightedSum += followerOpinion(entry) * weight;
    weightTotal += weight;

    if (entry.rating != null) {
      if (!topRater || entry.rating > topRater.rating) {
        topRater = {
          rating: entry.rating,
          compatibility: trust?.compatibility ?? 50,
        };
      }
    }
  }

  if (weightTotal <= 0) return { value: 0 };

  // Weighted mean of opinions, then shrunk by total trust so that one
  // half-trusted friend moves the signal half as far as a fully trusted one
  // (their weight no longer cancels out of the average).
  const mean = weightedSum / weightTotal;
  const evidence = weightTotal / (weightTotal + FRIEND_SIGNAL.evidencePrior);
  const value = mean * evidence;

  let detail: string | undefined;
  if (topRater) {
    detail = `${ratings.length} follower${ratings.length === 1 ? "" : "s"} engaged · top rating ${topRater.rating}/10 (compatibility ${topRater.compatibility}%)`;
  }

  return { value, detail };
}
