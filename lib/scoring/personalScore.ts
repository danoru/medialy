import { PERSONAL_SCORE } from "@/lib/scoring/config";
import {
  calculatePairwiseConfidence,
  clamp,
  normalizedPairwiseRating,
} from "@/lib/scoring/pairwise";

export function calculatePersonalScore({
  explicitRating,
  pairwiseScore,
  comparisonCount,
}: {
  explicitRating: number | null | undefined;
  pairwiseScore: number;
  comparisonCount: number;
}) {
  const pairwiseRating = normalizedPairwiseRating(pairwiseScore);
  const pairwiseConfidence = calculatePairwiseConfidence(comparisonCount);

  if (explicitRating == null) {
    return {
      score: roundScore(pairwiseRating),
      confidence: roundConfidence(
        pairwiseConfidence * PERSONAL_SCORE.pairwiseOnlyConfidenceDamping,
      ),
    };
  }

  const relationalWeight =
    PERSONAL_SCORE.relationalWeight * pairwiseConfidence;
  const explicitWeight = 1 - relationalWeight;
  const score =
    explicitRating * explicitWeight + pairwiseRating * relationalWeight;

  return {
    score: roundScore(clamp(score, 0, 10)),
    confidence: roundConfidence(
      Math.max(PERSONAL_SCORE.explicitRatingConfidenceFloor, pairwiseConfidence),
    ),
  };
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function roundConfidence(value: number) {
  return Math.round(clamp(value, 0, 1) * 100) / 100;
}
