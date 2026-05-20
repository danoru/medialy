import { HIDDEN_GEM } from "@/lib/scoring/config";
import { clamp } from "@/lib/scoring/pairwise";

/**
 * "Hidden Gem" = high quality + low visibility. Quality is the *best* of the
 * three score sources, so an item can qualify if it excels by any one measure
 * (you loved it personally, critics agreed, or it dominates head-to-head).
 *
 * Inputs are intentionally minimal — anywhere in the app that has the columns
 * below can compute the score.
 */

export type HiddenGemInput = {
  computedPersonalScore: number | null;
  computedConsensusScore: number | null;
  pairwiseScore: number;
  comparisonCount: number;
  personalScoreConfidence: number | null;
  consensusConfidence: number | null;
};

export type HiddenGemBreakdown = {
  score: number; // 0–1
  quality: number; // 0–1
  obscurity: number; // 0–1
  confidence: number; // 0–1
  qualifies: boolean;
  contributors: {
    personalScore: number;
    consensusScore: number;
    pairwiseScore: number;
  };
};

export function calculateHiddenGemScore(
  item: HiddenGemInput,
  libraryStats: { medianComparisons: number },
): HiddenGemBreakdown {
  const personalQ = normalize(
    item.computedPersonalScore,
    HIDDEN_GEM.qualitySources.personalScore.min,
    HIDDEN_GEM.qualitySources.personalScore.max,
  );
  const consensusQ = normalize(
    item.computedConsensusScore,
    HIDDEN_GEM.qualitySources.consensusScore.min,
    HIDDEN_GEM.qualitySources.consensusScore.max,
  );
  const pairwiseQ = normalize(
    item.pairwiseScore,
    HIDDEN_GEM.qualitySources.pairwiseScore.min,
    HIDDEN_GEM.qualitySources.pairwiseScore.max,
  );

  const quality = Math.max(personalQ, consensusQ, pairwiseQ);

  const denominator = Math.max(libraryStats.medianComparisons, 1);
  const obscurity = clamp(1 - item.comparisonCount / denominator, 0, 1);

  const confidence = Math.max(
    item.personalScoreConfidence ?? 0,
    item.consensusConfidence ?? 0,
  );

  const score =
    quality * HIDDEN_GEM.weights.quality +
    obscurity * HIDDEN_GEM.weights.obscurity +
    confidence * HIDDEN_GEM.weights.confidence;

  return {
    score: round(score),
    quality: round(quality),
    obscurity: round(obscurity),
    confidence: round(confidence),
    qualifies:
      score >= HIDDEN_GEM.badgeThreshold &&
      confidence >= HIDDEN_GEM.minConfidence,
    contributors: {
      personalScore: round(personalQ),
      consensusScore: round(consensusQ),
      pairwiseScore: round(pairwiseQ),
    },
  };
}

export function rankHiddenGems<T extends HiddenGemInput>(
  items: T[],
  options: { limit?: number; requireQualifies?: boolean } = {},
): Array<T & { hiddenGem: HiddenGemBreakdown }> {
  const stats = computeLibraryStats(items);
  const scored = items.map((item) => ({
    ...item,
    hiddenGem: calculateHiddenGemScore(item, stats),
  }));

  const filtered = options.requireQualifies
    ? scored.filter((item) => item.hiddenGem.qualifies)
    : scored;

  filtered.sort((a, b) => b.hiddenGem.score - a.hiddenGem.score);
  return options.limit ? filtered.slice(0, options.limit) : filtered;
}

export function computeLibraryStats(items: { comparisonCount: number }[]) {
  if (items.length === 0) return { medianComparisons: 0 };
  const sorted = [...items]
    .map((item) => item.comparisonCount)
    .sort((a, b) => a - b);
  return { medianComparisons: sorted[Math.floor(sorted.length / 2)] };
}

function normalize(value: number | null, min: number, max: number) {
  if (value == null) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
