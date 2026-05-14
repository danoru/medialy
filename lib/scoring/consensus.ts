import type { ExternalRatingLike } from "@/lib/scoring/types";
import { clamp } from "@/lib/scoring/pairwise";
import { SOURCE_TRUST_WEIGHTS } from "@/lib/scoring/weights";

export function normalizeExternalRating(rating: ExternalRatingLike) {
  if (rating.scale <= 0) return null;
  return clamp((rating.score / rating.scale) * 10, 0, 10);
}

export function calculateConsensusScore(ratings: ExternalRatingLike[]) {
  const weighted = ratings
    .map((rating) => {
      const normalized = normalizeExternalRating(rating);
      if (normalized == null) return null;
      const weight: number = SOURCE_TRUST_WEIGHTS[rating.source] ?? 0.5;
      return { normalized, weight };
    })
    .filter((rating): rating is { normalized: number; weight: number } =>
      Boolean(rating),
    );

  if (weighted.length === 0) {
    return { score: null, confidence: 0 };
  }

  const totalWeight = weighted.reduce((sum, rating) => sum + rating.weight, 0);
  const score =
    weighted.reduce(
      (sum, rating) => sum + rating.normalized * rating.weight,
      0,
    ) / totalWeight;
  const mean = score;
  const variance =
    weighted.reduce(
      (sum, rating) => sum + Math.abs(rating.normalized - mean),
      0,
    ) / weighted.length;
  const sourceConfidence = clamp(totalWeight / 3, 0.25, 1);
  const agreementConfidence = clamp(1 - variance / 5, 0.3, 1);

  return {
    score: Math.round(score * 10) / 10,
    confidence: Math.round(sourceConfidence * agreementConfidence * 100) / 100,
  };
}
