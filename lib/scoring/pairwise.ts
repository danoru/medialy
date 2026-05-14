export const INITIAL_PAIRWISE_SCORE = 1000;
export const BASE_K_FACTOR = 32;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function expectedScore(playerScore: number, opponentScore: number) {
  return 1 / (1 + Math.pow(10, (opponentScore - playerScore) / 400));
}

export function kFactor(comparisonCount: number, base = BASE_K_FACTOR) {
  if (comparisonCount < 3) return base;
  if (comparisonCount < 10) return base * 0.75;
  if (comparisonCount < 25) return base * 0.5;
  return base * 0.35;
}

export function applyEloResult({
  winnerScore,
  loserScore,
  winnerComparisonCount,
  loserComparisonCount,
  weight = 1,
}: {
  winnerScore: number;
  loserScore: number;
  winnerComparisonCount: number;
  loserComparisonCount: number;
  weight?: number;
}) {
  const effectiveWeight = clamp(weight, 0, 2);
  const winnerExpected = expectedScore(winnerScore, loserScore);
  const loserExpected = expectedScore(loserScore, winnerScore);
  const winnerDelta =
    kFactor(winnerComparisonCount) * effectiveWeight * (1 - winnerExpected);
  const loserDelta =
    kFactor(loserComparisonCount) * effectiveWeight * (0 - loserExpected);

  return {
    winnerScore: winnerScore + winnerDelta,
    loserScore: loserScore + loserDelta,
    winnerDelta,
    loserDelta,
  };
}

export function normalizeScoreForUi(score: number, min = 850, max = 1350) {
  return clamp(((score - min) / (max - min)) * 100, 0, 100);
}

export function normalizedPairwiseRating(score: number) {
  return normalizeScoreForUi(score) / 10;
}

export function calculatePairwiseConfidence(comparisonCount: number) {
  if (comparisonCount <= 0) return 0.2;
  if (comparisonCount < 3) return 0.45;
  if (comparisonCount < 8) return 0.7;
  return 1;
}

export const confidenceFromComparisons = calculatePairwiseConfidence;
