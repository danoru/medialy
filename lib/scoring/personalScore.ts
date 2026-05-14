import {
  calculatePairwiseConfidence,
  clamp,
  normalizedPairwiseRating,
} from "@/lib/scoring/pairwise";
import { PERSONAL_SCORE_RELATIONAL_WEIGHT } from "@/lib/scoring/weights";

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
      confidence: roundConfidence(pairwiseConfidence * 0.6),
    };
  }

  const relationalWeight =
    PERSONAL_SCORE_RELATIONAL_WEIGHT * pairwiseConfidence;
  const explicitWeight = 1 - relationalWeight;
  const score =
    explicitRating * explicitWeight + pairwiseRating * relationalWeight;

  return {
    score: roundScore(clamp(score, 0, 10)),
    confidence: roundConfidence(Math.max(0.55, pairwiseConfidence)),
  };
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}

function roundConfidence(value: number) {
  return Math.round(clamp(value, 0, 1) * 100) / 100;
}
