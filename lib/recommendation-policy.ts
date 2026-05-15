import type { MediaStatus } from "@prisma/client";

export const EXCLUDED_RECOMMENDATION_STATUSES: MediaStatus[] = [
  "IN_PROGRESS",
  "COMPLETED",
];

const RECOMMENDATION_STATUS_SIGNALS: Record<MediaStatus, number> = {
  UNTRACKED: 100,
  WATCHLIST: 30,
  BACKLOG: 18,
  PAUSED: -45,
  DROPPED: -80,
  IN_PROGRESS: 0,
  COMPLETED: 0,
};

const PERSONAL_SCORE_TRUST_BY_STATUS: Record<MediaStatus, number> = {
  COMPLETED: 1,
  IN_PROGRESS: 0.45,
  PAUSED: 0.2,
  DROPPED: 0.05,
  WATCHLIST: 0,
  BACKLOG: 0,
  UNTRACKED: 0,
};

export function isRecommendationEligibleStatus(status: MediaStatus) {
  return !EXCLUDED_RECOMMENDATION_STATUSES.includes(status);
}

export function recommendationStatusSignal(status: MediaStatus) {
  return RECOMMENDATION_STATUS_SIGNALS[status];
}

export function recommendationPersonalScoreTrust(
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
