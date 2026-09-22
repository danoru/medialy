import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCatalogWithUser, type CatalogItemWithUser } from "@/lib/db/catalog";
import { getFollowingIds } from "@/lib/social/follows";
import {
  matchesRecommendationEligibility,
  type EligibilityOptions,
} from "@/lib/scoring/eligibility";
import {
  buildFriendBaselines,
  buildFriendTrust,
  buildTasteProfiles,
  friendSignal,
  observedTaste,
  scoreV2,
  type FriendRating,
  type NameLookup,
  type TasteObservation,
  type V2Score,
} from "@/lib/scoring/recommendationV2";
import { RECOMMENDATION_V2 } from "@/lib/scoring/config";
import { calibratedMatch } from "@/lib/scoring/calibration";
import { toMediaItemDTO } from "@/lib/media";
import type { Recommendation } from "@/lib/types";

/**
 * The v2 engine's data layer. One cached context per request holds the
 * catalog with the viewer's rows merged, the viewer's ratings, and every
 * rated or completed row from the people they follow.
 */
export const getRecommendationV2Context = cache(async (userId: string) => {
  const anonymous = userId === "__anonymous__";
  const [catalog, followingIds, rows, people] = await Promise.all([
    getCatalogWithUser(userId),
    anonymous ? Promise.resolve([] as string[]) : getFollowingIds(userId),
    // Every other user's public rows: friends are the ones the viewer
    // follows; the rest may qualify as taste twins by overlap.
    anonymous
      ? Promise.resolve([])
      : prisma.userMedia.findMany({
          where: {
            userId: { not: userId },
            isArchived: false,
            OR: [
              { personalRating: { not: null } },
              { status: { in: ["COMPLETED", "WATCHLIST"] } },
            ],
          },
          select: {
            userId: true,
            mediaId: true,
            personalRating: true,
            status: true,
            media: { select: { mediaType: true } },
          },
        }),
    anonymous
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { id: { not: userId } },
          select: { id: true, displayName: true },
        }),
  ]);
  const following = new Set(followingIds);
  const social: FriendRating[] = rows.map((row) => ({
    userId: row.userId,
    mediaId: row.mediaId,
    mediaType: row.media.mediaType,
    rating: row.personalRating,
    status: row.status,
  }));
  const friends = social.filter((row) => following.has(row.userId));
  const others = social.filter((row) => !following.has(row.userId));
  const names: NameLookup = new Map(
    people.map((person) => [person.id, person.displayName]),
  );
  const observations: TasteObservation[] = catalog.map((media) => ({
    media,
    personalRating: media.personalRating,
    pairwiseScore: media.pairwiseScore,
    comparisonCount: media.comparisonCount,
    status: media.status,
    isArchived: media.isArchived,
  }));
  const viewerRatings = observations
    .filter((row) => !row.isArchived && row.personalRating != null)
    .map((row) => ({ mediaId: row.media.id, rating: row.personalRating! }));
  const byMedia = (list: FriendRating[]) => {
    const map = new Map<string, FriendRating[]>();
    for (const row of list) {
      const group = map.get(row.mediaId) ?? [];
      group.push(row);
      map.set(row.mediaId, group);
    }
    return map;
  };
  return {
    catalog,
    observations,
    friends,
    others,
    names,
    viewerRatings,
    friendRatingsByMedia: byMedia(friends),
    otherRatingsByMedia: byMedia(others),
    profiles: buildTasteProfiles(observations),
    trust: buildFriendTrust(viewerRatings, friends),
    twinTrust: buildFriendTrust(viewerRatings, others),
    baselines: buildFriendBaselines(social),
    observedIds: new Set(
      observations
        .filter((row) => observedTaste(row) != null)
        .map((row) => row.media.id),
    ),
  };
});

export type V2Recommendation = V2Score & { media: CatalogItemWithUser };

/**
 * Scores one catalog row for the viewer. A title the viewer has already
 * rated is scored with itself removed from the profile and the friend
 * overlap, so it cannot explain itself.
 */
export function scoreCatalogItem(
  context: Awaited<ReturnType<typeof getRecommendationV2Context>>,
  media: CatalogItemWithUser,
): V2Recommendation {
  const excluded = new Set([media.id]);
  const isObserved = context.observedIds.has(media.id);
  const profiles = isObserved
    ? buildTasteProfiles(context.observations, excluded)
    : context.profiles;
  const trust = isObserved
    ? buildFriendTrust(context.viewerRatings, context.friends, excluded)
    : context.trust;
  const twinTrust = isObserved
    ? buildFriendTrust(context.viewerRatings, context.others, excluded)
    : context.twinTrust;
  return {
    media,
    ...scoreV2(
      media,
      profiles,
      friendSignal(
        context.friendRatingsByMedia.get(media.id) ?? [],
        trust,
        context.baselines,
      ),
      {
        twins: friendSignal(
          context.otherRatingsByMedia.get(media.id) ?? [],
          twinTrust,
          context.baselines,
          { minOverlap: RECOMMENDATION_V2.twinMinOverlap, noun: "taste-twin" },
        ),
        names: context.names,
      },
    ),
  };
}

/** Every eligible title, best first, with raw scores and full explanations. */
export async function getRecommendationsV2(
  userId: string,
  eligibility: EligibilityOptions = {},
): Promise<V2Recommendation[]> {
  const context = await getRecommendationV2Context(userId);
  return context.catalog
    .filter(
      (item) =>
        !eligibility.hiddenMediaTypes?.includes(item.mediaType) &&
        matchesRecommendationEligibility(item, { ...eligibility, userId }),
    )
    .map((media) => scoreCatalogItem(context, media))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.confidence - a.confidence ||
        a.media.title.localeCompare(b.media.title) ||
        a.media.id.localeCompare(b.media.id),
    );
}

/**
 * The shape the pages consume. `score` is the calibrated Match (chance the
 * viewer rates it above their own average); the raw engine score and the
 * signed per-signal breakdown ride along for explainers.
 */
export function toRecommendation(entry: V2Recommendation): Recommendation {
  const explanations = entry.explanations.map((e) => ({
    signal: e.signal,
    label: e.label,
    rawValue: e.value == null ? 0 : Math.round(e.value),
    weight: e.weight,
    contribution: Math.round(e.contribution * 10) / 10,
    reliability: Math.round(e.reliability * 100) / 100,
    detail: e.detail,
  }));
  return {
    media: toMediaItemDTO(entry.media),
    score: calibratedMatch(entry.score),
    rawScore: Math.round(entry.score * 10) / 10,
    confidence: Math.round(entry.confidence * 100) / 100,
    reason: entry.reason,
    reasons: explanations
      .filter((e) => Math.abs(e.contribution) >= 0.5)
      .map((e) => ({ label: e.label, value: e.contribution })),
    explanations,
  };
}
