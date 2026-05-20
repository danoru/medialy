import type { MediaStatus, Prisma } from "@prisma/client";
import { startOfToday } from "@/lib/upcoming";

/**
 * Eligibility is a *binary filter* on the recommendation pool: "can/do I want
 * to watch this right now". It is intentionally separate from Medialy Match
 * (taste — "would I like it"). Two different questions, two different scores.
 *
 * If you find yourself adding a continuous weight here, it probably belongs in
 * Match instead. If you find yourself adding a status-based weight to Match,
 * it probably belongs here.
 *
 * Each filter returns a typed reason so the UI can surface *why* something
 * was excluded ("Filtered: already completed", "Filtered: releases in 4
 * months") via hover explainers instead of opaque score nudges.
 */

export type EligibilityReason =
  | "already_completed"
  | "in_progress"
  | "dropped"
  | "archived"
  | "not_yet_released"
  | "medium_hidden";

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: EligibilityReason; detail?: string };

export type EligibilityInput = {
  status: MediaStatus;
  isArchived: boolean;
  releaseDate?: Date | string | null;
  mediaType: string;
};

export type EligibilityOptions = {
  /**
   * Per-user preferences. Default behavior matches today's recommendation
   * pool: exclude finished/dropped items, exclude future releases, exclude
   * archived. Future per-user models override these.
   */
  includeCompleted?: boolean;
  includeInProgress?: boolean;
  includeDropped?: boolean;
  includeUpcoming?: boolean;
  includeArchived?: boolean;
  hiddenMediaTypes?: string[];
  now?: Date;
};

/** Statuses excluded by default. Surfaced as a constant for query helpers. */
export const DEFAULT_EXCLUDED_STATUSES: MediaStatus[] = [
  "IN_PROGRESS",
  "COMPLETED",
  "DROPPED",
];

export function isEligibleForRecommendation(
  item: EligibilityInput,
  options: EligibilityOptions = {},
): EligibilityResult {
  const now = options.now ?? new Date();

  if (item.isArchived && !options.includeArchived) {
    return { eligible: false, reason: "archived" };
  }

  if (
    options.hiddenMediaTypes &&
    options.hiddenMediaTypes.includes(item.mediaType)
  ) {
    return { eligible: false, reason: "medium_hidden" };
  }

  if (
    item.status === "COMPLETED" &&
    !options.includeCompleted
  ) {
    return { eligible: false, reason: "already_completed" };
  }
  if (item.status === "IN_PROGRESS" && !options.includeInProgress) {
    return { eligible: false, reason: "in_progress" };
  }
  if (item.status === "DROPPED" && !options.includeDropped) {
    return { eligible: false, reason: "dropped" };
  }

  if (item.releaseDate && !options.includeUpcoming) {
    const release =
      item.releaseDate instanceof Date
        ? item.releaseDate
        : new Date(item.releaseDate);
    if (Number.isFinite(release.getTime()) && release.getTime() > now.getTime()) {
      return {
        eligible: false,
        reason: "not_yet_released",
        detail: release.toISOString(),
      };
    }
  }

  return { eligible: true };
}

/**
 * Prisma-where for the default-eligible recommendation pool. Per-user status
 * and archive live on `UserMedia`, so this builds a relation filter: an item
 * is eligible if the user either has no `UserMedia` row (defaults to
 * UNTRACKED, not archived) or has one that isn't excluded.
 *
 * If `userId` is omitted (e.g. legacy callers that only need the date
 * filter) the per-user filters are dropped and only release-date / visibility
 * remain.
 */
export function recommendationEligibilityWhere(
  options: EligibilityOptions & { userId?: string } = {},
): Prisma.MediaItemWhereInput {
  const now = options.now ?? new Date();
  const tomorrow = startOfToday(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const excludedStatuses = DEFAULT_EXCLUDED_STATUSES.filter((status) => {
    if (status === "COMPLETED" && options.includeCompleted) return false;
    if (status === "IN_PROGRESS" && options.includeInProgress) return false;
    if (status === "DROPPED" && options.includeDropped) return false;
    return true;
  });

  const releaseDateFilter: Prisma.MediaItemWhereInput = options.includeUpcoming
    ? {}
    : { OR: [{ releaseDate: null }, { releaseDate: { lt: tomorrow } }] };

  if (!options.userId) {
    return { ...releaseDateFilter };
  }

  const userMediaSomeFilter: Prisma.UserMediaWhereInput = {
    userId: options.userId,
    ...(options.includeArchived ? {} : { isArchived: false }),
    ...(excludedStatuses.length > 0
      ? { status: { notIn: excludedStatuses } }
      : {}),
  };

  const userScopedFilter: Prisma.MediaItemWhereInput = {
    OR: [
      { userMedia: { none: { userId: options.userId } } },
      { userMedia: { some: userMediaSomeFilter } },
    ],
  };

  return {
    ...userScopedFilter,
    ...releaseDateFilter,
  };
}

/**
 * Modulates how much we trust an explicit personal rating given the user's
 * engagement. A 9 from a COMPLETED item is *experience*; a 9 from a
 * WATCHLIST item is *expectation*. This is NOT a status-as-score signal; it
 * scales a taste signal we already had.
 */
const PERSONAL_SCORE_TRUST_BY_STATUS: Record<MediaStatus, number> = {
  COMPLETED: 1,
  IN_PROGRESS: 0.45,
  PAUSED: 0.2,
  DROPPED: 0.05,
  WATCHLIST: 0,
  BACKLOG: 0,
  UNTRACKED: 0,
};

export function personalScoreTrustForStatus(
  status: MediaStatus,
  hasExplicitRating: boolean,
) {
  if (
    hasExplicitRating &&
    (status === "WATCHLIST" || status === "BACKLOG" || status === "UNTRACKED")
  ) {
    return 0.25;
  }
  return PERSONAL_SCORE_TRUST_BY_STATUS[status];
}

export function eligibilityReasonLabel(reason: EligibilityReason): string {
  switch (reason) {
    case "already_completed":
      return "Already completed";
    case "in_progress":
      return "Currently in progress";
    case "dropped":
      return "You dropped this";
    case "archived":
      return "Archived";
    case "not_yet_released":
      return "Not yet released";
    case "medium_hidden":
      return "Medium hidden by your preferences";
  }
}
