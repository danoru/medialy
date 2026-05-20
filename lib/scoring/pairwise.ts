import { PAIRWISE } from "@/lib/scoring/config";

export const INITIAL_PAIRWISE_SCORE = PAIRWISE.initialScore;
export const BASE_K_FACTOR = PAIRWISE.baseKFactor;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function expectedScore(playerScore: number, opponentScore: number) {
  return 1 / (1 + Math.pow(10, (opponentScore - playerScore) / 400));
}

export function kFactor(comparisonCount: number, base = BASE_K_FACTOR) {
  const multiplier = pickBucket(PAIRWISE.kDecay, comparisonCount, "multiplier");
  return base * multiplier;
}

export function calculatePairwiseConfidence(comparisonCount: number) {
  return pickBucket(PAIRWISE.confidenceBuckets, comparisonCount, "value");
}

export const confidenceFromComparisons = calculatePairwiseConfidence;

export function applyEloResult({
  winnerScore,
  loserScore,
  winnerComparisonCount,
  loserComparisonCount,
  weight = 1,
  expectedWinnerWinProb,
}: {
  winnerScore: number;
  loserScore: number;
  winnerComparisonCount: number;
  loserComparisonCount: number;
  weight?: number;
  /**
   * Optional override for the expected outcome. When provided (e.g. from the
   * blended-prior helper), it replaces the pure-Elo expectation. Range 0–1.
   */
  expectedWinnerWinProb?: number;
}) {
  const effectiveWeight = clamp(weight, 0, 2);
  const winnerExpected =
    expectedWinnerWinProb ?? expectedScore(winnerScore, loserScore);
  const loserExpected = 1 - winnerExpected;
  const winnerDelta =
    kFactor(winnerComparisonCount) * effectiveWeight * (1 - winnerExpected);
  const loserDelta =
    kFactor(loserComparisonCount) * effectiveWeight * (0 - loserExpected);

  return {
    winnerScore: winnerScore + winnerDelta,
    loserScore: loserScore + loserDelta,
    winnerDelta,
    loserDelta,
    expectedWinnerWinProb: winnerExpected,
  };
}

export function normalizeScoreForUi(
  score: number,
  min = PAIRWISE.uiRange.min,
  max = PAIRWISE.uiRange.max,
) {
  return clamp(((score - min) / (max - min)) * 100, 0, 100);
}

export function normalizedPairwiseRating(score: number) {
  return normalizeScoreForUi(score) / 10;
}

/**
 * Blended 0–10 strength used to compute the *expected* outcome of a
 * comparison. Mixes whatever signals are available:
 *  - explicit personal rating (highest weight — direct user signal)
 *  - external consensus (some weight — external validation)
 *  - pairwise score normalized to 0–10 (residual weight)
 *
 * Missing inputs are dropped and remaining weights renormalize. The result
 * is then converted to Elo-prior space by `effectiveEloPrior`.
 *
 * This is the helper that produces "upset" behavior: a 6-rated item vs.
 * a 10-rated item registers as a real upset when the underdog wins,
 * regardless of how close their pairwise scores currently are.
 */
export function effectiveRating(input: {
  personalRating?: number | null;
  consensusScore?: number | null;
  pairwiseScore: number;
}): number {
  const parts: Array<{ value: number; weight: number }> = [];
  if (input.personalRating != null) {
    parts.push({
      value: input.personalRating,
      weight: PAIRWISE.priorBlend.personalRating,
    });
  }
  if (input.consensusScore != null) {
    parts.push({
      value: input.consensusScore,
      weight: PAIRWISE.priorBlend.consensus,
    });
  }
  parts.push({
    value: normalizedPairwiseRating(input.pairwiseScore),
    weight: PAIRWISE.priorBlend.pairwise,
  });

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight === 0) return 5;
  return (
    parts.reduce((sum, p) => sum + p.value * p.weight, 0) / totalWeight
  );
}

/** Convert a 0–10 effective rating into Elo-space prior for expectedScore. */
export function effectiveEloPrior(rating: number): number {
  return (
    PAIRWISE.initialScore + (rating - 5) * PAIRWISE.priorSpreadPerRatingPoint
  );
}

/**
 * Convenience: given two items, compute the expected probability that
 * `winner` wins under the blended prior. Pass this to `applyEloResult` to
 * get upset-aware Elo updates.
 */
export function expectedWinProbabilityFromPriors(
  winner: Parameters<typeof effectiveRating>[0],
  loser: Parameters<typeof effectiveRating>[0],
): number {
  return expectedScore(
    effectiveEloPrior(effectiveRating(winner)),
    effectiveEloPrior(effectiveRating(loser)),
  );
}

function pickBucket<
  T extends { atLeast: number },
  K extends keyof T,
>(buckets: readonly T[], value: number, key: K): T[K] {
  let selected = buckets[0][key];
  for (const bucket of buckets) {
    if (value >= bucket.atLeast) selected = bucket[key];
  }
  return selected;
}
