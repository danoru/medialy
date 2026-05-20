import { RATING_COMPATIBILITY } from "@/lib/scoring/config";

/**
 * Compatibility between two raters from their overlapping personal ratings.
 * Used by `/friends` and `/u/[id]` for both follow targets and the legacy
 * "guest taste profile" entry point. Symmetric in `viewerRating`/`otherRating`.
 */
export function calculateRatingCompatibility(
  pairs: Array<{ viewerRating: number; otherRating: number }>,
) {
  if (pairs.length === 0) {
    return {
      overlapCount: 0,
      compatibilityScore: 0,
      averageDistance: null,
    };
  }

  const distance = pairs.reduce(
    (sum, pair) => sum + Math.abs(pair.viewerRating - pair.otherRating),
    0,
  );
  const averageDistance = distance / pairs.length;

  return {
    overlapCount: pairs.length,
    compatibilityScore: Math.max(
      0,
      Math.round(
        100 - averageDistance * RATING_COMPATIBILITY.ratingDistancePenalty,
      ),
    ),
    averageDistance,
  };
}
