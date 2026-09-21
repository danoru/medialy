import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCatalogWithUser } from "@/lib/db/catalog";
import { getFollowingIds } from "@/lib/social/follows";
import {
  matchesRecommendationEligibility,
  type EligibilityOptions,
} from "@/lib/scoring/eligibility";
import {
  buildFriendTrust,
  buildTasteProfiles,
  friendSignal,
  observedTaste,
  scoreV2,
  type FriendRating,
  type TasteObservation,
} from "@/lib/scoring/recommendationV2";

/** Request-local only: no cross-user persistence of taste profiles or social data. */
export const getRecommendationV2Context = cache(async (userId: string) => {
  const [catalog, followingIds] = await Promise.all([
    getCatalogWithUser(userId),
    userId === "__anonymous__"
      ? Promise.resolve([] as string[])
      : getFollowingIds(userId),
  ]);
  const rows = followingIds.length
    ? await prisma.userMedia.findMany({
        where: {
          userId: { in: followingIds },
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
      })
    : [];
  const friends: FriendRating[] = rows.map((row) => ({
    userId: row.userId,
    mediaId: row.mediaId,
    mediaType: row.media.mediaType,
    rating: row.personalRating,
    status: row.status,
  }));
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
  const friendRatingsByMedia = new Map<string, FriendRating[]>();
  for (const row of friends) {
    const group = friendRatingsByMedia.get(row.mediaId) ?? [];
    group.push(row);
    friendRatingsByMedia.set(row.mediaId, group);
  }
  return {
    catalog,
    observations,
    friends,
    viewerRatings,
    friendRatingsByMedia,
  };
});

/** Review-only entry point. Live getRecommendations intentionally remains v1. */
export async function getRecommendationsV2(
  userId: string,
  eligibility: EligibilityOptions = {},
) {
  const context = await getRecommendationV2Context(userId);
  const profiles = buildTasteProfiles(context.observations);
  const trust = buildFriendTrust(context.viewerRatings, context.friends);
  const observedIds = new Set(
    context.observations
      .filter((row) => observedTaste(row) != null)
      .map((row) => row.media.id),
  );
  return context.catalog
    .filter(
      (item) =>
        !eligibility.hiddenMediaTypes?.includes(item.mediaType) &&
        matchesRecommendationEligibility(item, { ...eligibility, userId }),
    )
    .map((media) => {
      // An explicit includeRated/includeCompleted request must not let a title
      // explain itself through either its own taste features or friend overlap.
      const excluded = new Set([media.id]);
      const candidateProfiles = observedIds.has(media.id)
        ? buildTasteProfiles(context.observations, excluded)
        : profiles;
      const candidateTrust = observedIds.has(media.id)
        ? buildFriendTrust(context.viewerRatings, context.friends, excluded)
        : trust;
      return {
        media,
        ...scoreV2(
          media,
          candidateProfiles,
          friendSignal(
            context.friendRatingsByMedia.get(media.id) ?? [],
            candidateTrust,
          ),
        ),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.confidence - a.confidence ||
        a.media.title.localeCompare(b.media.title) ||
        a.media.id.localeCompare(b.media.id),
    );
}
