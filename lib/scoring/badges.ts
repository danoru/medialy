import { BADGE_THRESHOLDS } from "@/lib/scoring/config";
import { normalizeExternalRating } from "@/lib/scoring/consensus";
import type { ExternalRatingLike } from "@/lib/scoring/types";

/**
 * Discoverability badges. Each badge is a pure function returning a typed
 * `BadgeMatch` so a single item can be tagged with multiple. Badges are
 * intentionally cheap to compute — render them anywhere a media tile shows
 * up (library, discover, recommendations, detail).
 *
 * Each match returns `reason` text suitable for a hover explainer.
 */

export type BadgeKey =
  | "hidden_gem"
  | "sleeper_hit"
  | "polarizing"
  | "cold_take"
  | "hot_take_failed"
  | "friend_favorite_untouched";

export type BadgeMatch = {
  key: BadgeKey;
  label: string;
  reason: string;
};

export type BadgeInput = {
  status: string;
  personalRating: number | null;
  computedPersonalScore: number | null;
  computedConsensusScore: number | null;
  consensusConfidence: number | null;
  externalRatings?: ExternalRatingLike[];
  /**
   * Public ratings from users the viewer follows. Used by the
   * `friend_favorite_untouched` badge (formerly populated from manual Friend
   * rows). Empty array == anonymous viewer or no follows yet.
   */
  followedUserRatings?: Array<{ rating: number | null }>;
};

export function evaluateBadges(item: BadgeInput): BadgeMatch[] {
  const matches: BadgeMatch[] = [];

  const sleeper = sleeperHit(item);
  if (sleeper) matches.push(sleeper);

  const polarizing = polarizingBadge(item);
  if (polarizing) matches.push(polarizing);

  const cold = coldTake(item);
  if (cold) matches.push(cold);

  const hotFailed = hotTakeFailed(item);
  if (hotFailed) matches.push(hotFailed);

  const friendFav = friendFavoriteUntouched(item);
  if (friendFav) matches.push(friendFav);

  return matches;
}

function sleeperHit(item: BadgeInput): BadgeMatch | null {
  const cfg = BADGE_THRESHOLDS.sleeperHit;
  if (
    item.computedConsensusScore != null &&
    item.computedConsensusScore >= cfg.minConsensusScore &&
    (item.consensusConfidence ?? 0) >= cfg.minConsensusConfidence &&
    item.personalRating == null &&
    (item.status === "UNTRACKED" || item.status === "WATCHLIST")
  ) {
    return {
      key: "sleeper_hit",
      label: "Sleeper Hit",
      reason: `Critics gave it ${item.computedConsensusScore}/10 and you haven't tried it yet.`,
    };
  }
  return null;
}

function polarizingBadge(item: BadgeInput): BadgeMatch | null {
  const cfg = BADGE_THRESHOLDS.polarizing;
  const ratings = item.externalRatings ?? [];
  if (ratings.length < cfg.minSources) return null;

  const normalized = ratings
    .map((r) => normalizeExternalRating(r))
    .filter((v): v is number => v != null);
  if (normalized.length < cfg.minSources) return null;

  const mean = normalized.reduce((s, v) => s + v, 0) / normalized.length;
  const variance =
    normalized.reduce((s, v) => s + (v - mean) ** 2, 0) / normalized.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev >= cfg.minStandardDeviation) {
    return {
      key: "polarizing",
      label: "Polarizing",
      reason: `Critics disagree — scores range across ${(stdDev * 2).toFixed(1)} points.`,
    };
  }
  return null;
}

function coldTake(item: BadgeInput): BadgeMatch | null {
  const cfg = BADGE_THRESHOLDS.coldTake;
  if (
    item.personalRating != null &&
    item.personalRating >= cfg.minPersonalScore &&
    item.computedConsensusScore != null &&
    item.computedConsensusScore <= cfg.maxConsensusScore
  ) {
    return {
      key: "cold_take",
      label: "Cold Take",
      reason: `You rated it ${item.personalRating}/10 — critics gave it ${item.computedConsensusScore}/10.`,
    };
  }
  return null;
}

function hotTakeFailed(item: BadgeInput): BadgeMatch | null {
  const cfg = BADGE_THRESHOLDS.hotTakeFailed;
  if (
    item.computedConsensusScore != null &&
    item.computedConsensusScore >= cfg.minConsensusScore &&
    item.personalRating != null &&
    item.personalRating <= cfg.maxPersonalScore
  ) {
    return {
      key: "hot_take_failed",
      label: "Wasn't For You",
      reason: `Critics gave it ${item.computedConsensusScore}/10 — you only ${item.personalRating}/10.`,
    };
  }
  return null;
}

function friendFavoriteUntouched(item: BadgeInput): BadgeMatch | null {
  const cfg = BADGE_THRESHOLDS.friendFavoriteUntouched;
  if (item.status !== "UNTRACKED" && item.status !== "WATCHLIST") return null;
  const ratings = item.followedUserRatings ?? [];
  const top = ratings
    .map((r) => r.rating)
    .filter((v): v is number => v != null)
    .reduce((a, b) => Math.max(a, b), 0);
  if (top >= cfg.minFriendRating) {
    return {
      key: "friend_favorite_untouched",
      label: "Friend Favorite",
      reason: `Someone you follow rated it ${top}/10 and you haven't started it.`,
    };
  }
  return null;
}
