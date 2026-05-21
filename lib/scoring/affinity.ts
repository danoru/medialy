import { AFFINITY_TUNING } from "@/lib/scoring/config";

/**
 * Per-feature rating accumulator used while walking the user's highly-rated
 * library. Sum + count are all we need to compute a shrunk mean.
 */
export type RatingAccumulator = { sum: number; count: number };

/**
 * Bayesian-shrunk mean: pulls per-feature mean rating toward `globalMean`
 * by `shrinkageK` pseudo-observations. With shrinkageK=5 and globalMean=8,
 * a genre with 2 items averaging 9.5 lands near 8.7; a genre with 30 items
 * averaging 8.3 lands near 8.25. This stops small-sample features from
 * dominating without penalising features the user has rated many times.
 *
 * Output is in *affinity units* — the distance above `neutralPivot`, scaled
 * up. Floored at zero so disliked features don't actively demote (they just
 * stop contributing). Revisit if you want signed negative evidence.
 */
export function shrunkContribution(
  acc: RatingAccumulator | undefined,
  globalMean: number,
) {
  if (!acc || acc.count === 0) return 0;
  const { shrinkageK, neutralPivot, scale } = AFFINITY_TUNING;
  const shrunkMean = (acc.sum + shrinkageK * globalMean) / (acc.count + shrinkageK);
  return Math.max(0, (shrunkMean - neutralPivot) * scale);
}

/**
 * BM25-style soft saturation: `100 * raw / (raw + k)`. Maps a raw additive
 * sum to a 0–100 score with diminishing returns. Replaces a hard clamp so
 * multi-feature matches compound past what a single saturated feature can
 * reach alone, and so no two candidates ever land at exactly 100.
 */
export function saturate(raw: number, k: number) {
  if (raw <= 0) return 0;
  return (100 * raw) / (raw + k);
}

/**
 * IMDB Top 250-style Bayesian shrinkage on a mean:
 *
 *   shrunkMean = (v × observed + k × prior) / (v + k)
 *
 * Pulls a per-item observed mean toward `prior` in proportion to how thin its
 * evidence (`v`) is. Used for cross-user rankings (Overall Top 10, Insights
 * standouts, Discover) so a single 10/10 doesn't outrank an item backed by
 * many ratings or many critic sources.
 *
 * With v=0, returns the prior — items with no evidence simply default to the
 * pool mean and lose ground to items that have any data at all.
 */
export function bayesianShrunkMean(
  observed: number,
  evidence: number,
  prior: number,
  shrinkageK: number,
): number {
  if (evidence <= 0) return prior;
  return (evidence * observed + shrinkageK * prior) / (evidence + shrinkageK);
}
