import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";
import { calculateMedialyMatch } from "@/lib/scoring/medialyMatch";
import {
  recommendationEligibilityWhere,
  type EligibilityOptions,
} from "@/lib/scoring/eligibility";
import { calculateRatingCompatibility } from "@/lib/scoring/compatibility";
import { AFFINITY_TUNING } from "@/lib/scoring/config";
import {
  saturate,
  shrunkContribution,
  type RatingAccumulator,
} from "@/lib/scoring/affinity";
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
import { getFollowingIds } from "@/lib/social/follows";
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
  userIdOverride?: string,
): Promise<Recommendation[]> {
  // Anonymous viewers get a best-effort recommendations list built from
  // public signals (no personal taste graph). A sentinel id makes the
  // per-user joins consistently return defaults.
  const userId =
    userIdOverride ?? (await getCurrentUserId()) ?? "__anonymous__";
  const rawItems = await prisma.mediaItem.findMany({
    where: {
      mediaType: visibleMediaTypeFilter(),
      ...recommendationEligibilityWhere({ ...eligibility, userId }),
    },
    include: {
      genres: { include: { genre: true } },
      tags: { where: { tag: { status: "APPROVED" } }, include: { tag: true } },
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
      const genreRaw = item.genres.reduce(
        (total, entry) => total + (affinity.genres.get(entry.genre.name) ?? 0),
        0,
      );
      const tagRaw = item.tags.reduce(
        (total, entry) => total + (affinity.tags.get(entry.tag.name) ?? 0),
        0,
      );
      const contributorRaw = item.credits.reduce(
        (total, entry) =>
          total +
          (affinity.contributors.get(entry.contributor.id)?.weight ?? 0),
        0,
      );
      const genreAffinity = saturate(genreRaw, AFFINITY_TUNING.saturationK.genre);
      const tagAffinity = saturate(tagRaw, AFFINITY_TUNING.saturationK.tag);
      const contributorAffinity = saturate(
        contributorRaw,
        AFFINITY_TUNING.saturationK.contributor,
      );

      const contributorDetail = buildContributorDetail(item.credits, affinity);
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

type ContributorAffinity = {
  weight: number;
  name: string;
  role: string;
  exampleCount: number;
  topExample: { title: string; rating: number };
};

type CountryAffinity = {
  exampleCount: number;
};

export type AffinityMaps = {
  genres: Map<string, number>;
  tags: Map<string, number>;
  contributors: Map<string, ContributorAffinity>;
  countries: Map<string, CountryAffinity>;
};

// Directors and creators carry a strong authorial fingerprint; publishers/devs
// are more incidental, so we give them less weight per match. Applied as a
// post-shrinkage multiplier so it doesn't distort the per-contributor mean rating.
const ROLE_WEIGHT: Record<string, number> = {
  DIRECTOR: 1,
  CREATOR: 1,
  DEVELOPER: 0.55,
  PUBLISHER: 0.35,
  // Actor data is brand-new; suppress its scoring contribution until we have
  // enough rated items to validate the signal isn't just popularity noise.
  ACTOR: 0,
};

// Excluded from country affinity: most users have a US-heavy library by
// default, so matching on US would add noise without signal.
const COUNTRY_AFFINITY_EXCLUSIONS = new Set(["US"]);

// Tag and contributor buckets are post-multiplied to keep their typical
// contributions in roughly the same ratio they had under the old itemBoost
// scheme — tags supplement genres, contributors land between the two.
const TAG_BUCKET_SCALE = TAG_WEIGHT / GENRE_WEIGHT;
const CONTRIBUTOR_BUCKET_SCALE = 0.6;

function pushRating(acc: Map<string, RatingAccumulator>, key: string, rating: number) {
  const existing = acc.get(key);
  if (existing) {
    existing.sum += rating;
    existing.count += 1;
  } else {
    acc.set(key, { sum: rating, count: 1 });
  }
}

export async function getAffinityMaps(
  userId: string,
  options: { excludeMediaId?: string } = {},
): Promise<AffinityMaps> {
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
      ...(options.excludeMediaId
        ? { mediaId: { not: options.excludeMediaId } }
        : {}),
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

  // First pass: collect per-feature rating accumulators + provenance.
  const genreRatings = new Map<string, RatingAccumulator>();
  const tagRatings = new Map<string, RatingAccumulator>();
  type ContributorAccum = RatingAccumulator & {
    name: string;
    role: string;
    topExample: { title: string; rating: number };
  };
  const contributorRatings = new Map<string, ContributorAccum>();
  const countries = new Map<string, CountryAffinity>();

  let poolSum = 0;
  let poolCount = 0;

  for (const row of completed) {
    const rating = row.computedPersonalScore ?? row.personalRating ?? 0;
    if (rating <= 0) continue;
    poolSum += rating;
    poolCount += 1;
    const itemRating = Math.round(rating);

    for (const entry of row.media.genres) {
      pushRating(genreRatings, entry.genre.name, rating);
    }
    for (const entry of row.media.tags) {
      pushRating(tagRatings, entry.tag.name, rating);

      if (
        entry.tag.category === "COUNTRY" &&
        entry.tag.countryCode &&
        !COUNTRY_AFFINITY_EXCLUSIONS.has(entry.tag.countryCode)
      ) {
        const existing = countries.get(entry.tag.countryCode);
        countries.set(entry.tag.countryCode, {
          exampleCount: (existing?.exampleCount ?? 0) + 1,
        });
      }
    }
    for (const entry of row.media.credits) {
      const id = entry.contributor.id;
      const existing = contributorRatings.get(id);
      if (existing) {
        existing.sum += rating;
        existing.count += 1;
        if (itemRating > existing.topExample.rating) {
          existing.topExample = { title: row.media.title, rating: itemRating };
        }
      } else {
        contributorRatings.set(id, {
          sum: rating,
          count: 1,
          name: entry.contributor.name,
          role: entry.role,
          topExample: { title: row.media.title, rating: itemRating },
        });
      }
    }
  }

  const globalMean = poolCount > 0 ? poolSum / poolCount : AFFINITY_TUNING.neutralPivot;

  // Second pass: derive per-feature contributions via shrunk mean.
  const genres = new Map<string, number>();
  for (const [name, acc] of genreRatings) {
    genres.set(name, shrunkContribution(acc, globalMean));
  }
  const tags = new Map<string, number>();
  for (const [name, acc] of tagRatings) {
    tags.set(name, shrunkContribution(acc, globalMean) * TAG_BUCKET_SCALE);
  }
  const contributors = new Map<string, ContributorAffinity>();
  for (const [id, acc] of contributorRatings) {
    const roleMultiplier = ROLE_WEIGHT[acc.role] ?? 0.5;
    const weight =
      shrunkContribution(acc, globalMean) *
      CONTRIBUTOR_BUCKET_SCALE *
      roleMultiplier;
    contributors.set(id, {
      weight,
      name: acc.name,
      role: acc.role,
      exampleCount: acc.count,
      topExample: acc.topExample,
    });
  }

  return { genres, tags, contributors, countries };
}

export function buildContributorDetail(
  credits: Array<{ contributor: { id: string }; role: string }>,
  affinity: AffinityMaps,
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

  const roleLabel = ROLE_NOUN[best.role] ?? "contributor";
  if (best.exampleCount === 1) {
    return `${capitalize(roleLabel)} ${best.name} — you rated ${best.topExample.title} ${best.topExample.rating}/10`;
  }
  return `${capitalize(roleLabel)} ${best.name} — you've rated ${best.exampleCount} of their ${pluralizeWork(best.role)} highly`;
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

const ROLE_NOUN: Record<string, string> = {
  DIRECTOR: "director",
  CREATOR: "creator",
  DEVELOPER: "developer",
  PUBLISHER: "publisher",
};

function pluralizeWork(role: string): string {
  switch (role) {
    case "DIRECTOR":
    case "CREATOR":
      return "works";
    case "DEVELOPER":
    case "PUBLISHER":
      return "titles";
    default:
      return "works";
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

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

async function getFollowedUserRatingsByMedia(
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

/**
 * Per-follower taste compatibility (0–100) against the viewer. Computed once
 * per request from overlapping rated items. Returned map is keyed by
 * followerId; missing followers default to 50 (neutral) at lookup time.
 */
async function getFollowerCompatibilityMap(
  viewerId: string,
  followedByMedia: Map<string, FollowerRating[]>,
): Promise<Map<string, number>> {
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

  const compatibility = new Map<string, number>();
  for (const followerId of followerIds) {
    const pairs = pairsByFollower.get(followerId) ?? [];
    if (pairs.length === 0) {
      compatibility.set(followerId, 50); // no overlap = neutral
      continue;
    }
    compatibility.set(
      followerId,
      calculateRatingCompatibility(pairs).compatibilityScore,
    );
  }
  return compatibility;
}

function computeFriendSignal(
  ratings: FollowerRating[],
  followerCompatibility: Map<string, number>,
): { value: number; detail?: string } {
  if (ratings.length === 0) return { value: 0 };

  let weightedSum = 0;
  let weightTotal = 0;
  let topRater: { rating: number; compatibility: number } | undefined;

  for (const entry of ratings) {
    const compat = followerCompatibility.get(entry.userId) ?? 50;
    // Compatibility 0→100 maps to weight 0→1. A perfectly aligned friend's
    // rating counts in full; a low-compatibility friend's rating is muted.
    const weight = compat / 100;
    const ratingBoost = entry.rating
      ? Math.max(0, (entry.rating - 6) * 10)
      : 0;
    const statusBoost =
      entry.status === "COMPLETED" ? 8 : entry.status === "WATCHLIST" ? 5 : 0;
    const perFollower = ratingBoost + statusBoost;

    weightedSum += perFollower * weight;
    weightTotal += weight;

    if (entry.rating != null) {
      if (!topRater || entry.rating > topRater.rating) {
        topRater = { rating: entry.rating, compatibility: compat };
      }
    }
  }

  const value = weightTotal > 0 ? weightedSum / weightTotal : 0;

  let detail: string | undefined;
  if (topRater) {
    detail = `${ratings.length} follower${ratings.length === 1 ? "" : "s"} engaged · top rating ${topRater.rating}/10 (compatibility ${topRater.compatibility}%)`;
  }

  return { value, detail };
}
