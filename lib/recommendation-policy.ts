import type { MediaStatus } from "@prisma/client";
import {
  DEFAULT_EXCLUDED_STATUSES,
  personalScoreTrustForStatus,
} from "@/lib/scoring/eligibility";

/**
 * Backwards-compatible shim. New code should call functions from
 * `@/lib/scoring/eligibility` directly — eligibility now lives there as a
 * single source of truth, separate from the (taste-only) Match score.
 */

export const EXCLUDED_RECOMMENDATION_STATUSES: MediaStatus[] =
  DEFAULT_EXCLUDED_STATUSES;

export function isRecommendationEligibleStatus(status: MediaStatus) {
  return !EXCLUDED_RECOMMENDATION_STATUSES.includes(status);
}

export function recommendationPersonalScoreTrust(
  status: MediaStatus,
  hasExplicitRating: boolean,
) {
  return personalScoreTrustForStatus(status, hasExplicitRating);
}

/**
 * @deprecated Status is no longer used as a score signal — it's an
 * eligibility filter. This shim returns 0 so any remaining callers don't
 * accidentally bias rankings. Remove once all call sites migrate.
 */
export function recommendationStatusSignal(_status: MediaStatus) {
  return 0;
}
