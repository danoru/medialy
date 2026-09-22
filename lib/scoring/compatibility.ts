import { RATING_COMPATIBILITY } from "@/lib/scoring/config";

/**
 * Compatibility between two raters from their overlapping personal ratings.
 * Used by `/friends`, `/u/[id]`, the friend and taste-twin signals, and the
 * legacy "guest taste profile" entry point. Symmetric in `viewerRating` /
 * `otherRating`.
 *
 * Two halves: how far apart the numbers are on average (a harsh rater and a
 * generous one look different here), and Pearson correlation (do they agree
 * on which titles are better, whatever their scales). The correlation half
 * only joins once there are `pearsonMinPairs` shared ratings.
 */
export function calculateRatingCompatibility(
  pairs: Array<{ viewerRating: number; otherRating: number }>,
) {
  if (pairs.length === 0) {
    return {
      overlapCount: 0,
      compatibilityScore: 0,
      averageDistance: null,
      correlation: null,
    };
  }

  const distance = pairs.reduce(
    (sum, pair) => sum + Math.abs(pair.viewerRating - pair.otherRating),
    0,
  );
  const averageDistance = distance / pairs.length;
  const distanceScore = Math.max(
    0,
    100 - averageDistance * RATING_COMPATIBILITY.ratingDistancePenalty,
  );

  const correlation =
    pairs.length >= RATING_COMPATIBILITY.pearsonMinPairs ? pearson(pairs) : null;
  const score =
    correlation == null
      ? distanceScore
      : distanceScore * (1 - RATING_COMPATIBILITY.pearsonShare) +
        (50 + 50 * correlation) * RATING_COMPATIBILITY.pearsonShare;

  return {
    overlapCount: pairs.length,
    compatibilityScore: Math.max(0, Math.round(score)),
    averageDistance,
    correlation,
  };
}

/** Pearson correlation of the two series, or null when either has no variance. */
export function pearson(
  pairs: Array<{ viewerRating: number; otherRating: number }>,
): number | null {
  const n = pairs.length;
  if (n < 2) return null;
  const meanA = pairs.reduce((sum, p) => sum + p.viewerRating, 0) / n;
  const meanB = pairs.reduce((sum, p) => sum + p.otherRating, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (const pair of pairs) {
    const da = pair.viewerRating - meanA;
    const db = pair.otherRating - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return null;
  return Math.max(-1, Math.min(1, cov / Math.sqrt(varA * varB)));
}
