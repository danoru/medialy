import type { MediaType } from "@prisma/client";
import {
  CONSENSUS,
  SOURCE_MEDIA_APPLICABILITY,
  SOURCE_TRUST_WEIGHTS,
} from "@/lib/scoring/config";
import { clamp } from "@/lib/scoring/pairwise";
import type { ExternalRatingLike } from "@/lib/scoring/types";

/**
 * Consensus = robust weighted mean of external critic / community ratings,
 * normalized to a 0–10 scale.
 *
 * Three forces shape the final number:
 *  1. **Per-source trust** — Metacritic (curated) > Steam (mass-positive).
 *  2. **Per-medium gating** — Goodreads only counts for books, Steam only
 *     for games, etc. Wrong-medium sources are dropped.
 *  3. **Outlier trimming** — once we have ≥4 sources, any score that's
 *     materially off the median is downweighted instead of dragging the mean.
 *  4. **Recency decay** — stale data (>1 year) decays toward a floor.
 *
 * Confidence is reported separately: it scales with how many sources agree
 * and how recent / numerous they are.
 *
 * All knobs live in `lib/scoring/config.ts` under `CONSENSUS`,
 * `SOURCE_TRUST_WEIGHTS`, and `SOURCE_MEDIA_APPLICABILITY`.
 */

export function normalizeExternalRating(rating: ExternalRatingLike) {
  if (rating.scale <= 0) return null;
  return clamp((rating.score / rating.scale) * 10, 0, 10);
}

export type ConsensusBreakdownEntry = {
  source: ExternalRatingLike["source"];
  normalized: number;
  baseWeight: number;
  effectiveWeight: number;
  recencyMultiplier: number;
  outlierMultiplier: number;
  applicable: boolean;
};

export type ConsensusResult = {
  score: number | null;
  confidence: number;
  agreementConfidence: number;
  sourceConfidence: number;
  usedSourceCount: number;
  breakdown: ConsensusBreakdownEntry[];
};

export function calculateConsensusScore(
  ratings: ExternalRatingLike[],
  options: { mediaType?: MediaType; now?: Date } = {},
): ConsensusResult {
  const now = options.now ?? new Date();

  const normalized = ratings.map((rating) => {
    const value = normalizeExternalRating(rating);
    const baseWeight = SOURCE_TRUST_WEIGHTS[rating.source] ?? 0.5;
    const applicable =
      value != null && isApplicableForMedium(rating.source, options.mediaType);
    const recencyMultiplier = applicable
      ? recencyDecay(rating.fetchedAt, now)
      : 0;
    return {
      rating,
      value,
      baseWeight,
      applicable,
      recencyMultiplier,
    };
  });

  const eligible = normalized.filter(
    (entry): entry is typeof entry & { value: number } =>
      entry.applicable && entry.value != null,
  );

  if (eligible.length === 0) {
    return {
      score: null,
      confidence: 0,
      agreementConfidence: 0,
      sourceConfidence: 0,
      usedSourceCount: 0,
      breakdown: normalized.map((entry) => ({
        source: entry.rating.source,
        normalized: entry.value ?? 0,
        baseWeight: entry.baseWeight,
        effectiveWeight: 0,
        recencyMultiplier: entry.recencyMultiplier,
        outlierMultiplier: 1,
        applicable: entry.applicable,
      })),
    };
  }

  // Outlier trim: downweight scores far from the median once we have enough.
  const median = computeMedian(eligible.map((entry) => entry.value));
  const trimCfg = CONSENSUS.outlierTrim;
  const enableTrim = eligible.length >= trimCfg.minSourcesForTrim;

  const weighted = eligible.map((entry) => {
    const outlierMultiplier =
      enableTrim && Math.abs(entry.value - median) >= trimCfg.deviationFromMedian
        ? trimCfg.trimMultiplier
        : 1;
    const effectiveWeight =
      entry.baseWeight * entry.recencyMultiplier * outlierMultiplier;
    return { ...entry, outlierMultiplier, effectiveWeight };
  });

  const totalWeight = weighted.reduce(
    (sum, entry) => sum + entry.effectiveWeight,
    0,
  );

  if (totalWeight <= 0) {
    return {
      score: null,
      confidence: 0,
      agreementConfidence: 0,
      sourceConfidence: 0,
      usedSourceCount: 0,
      breakdown: weighted.map(toBreakdownEntry),
    };
  }

  const score =
    weighted.reduce(
      (sum, entry) => sum + entry.value * entry.effectiveWeight,
      0,
    ) / totalWeight;

  // Agreement confidence — high variance lowers confidence.
  const meanAbsDev =
    weighted.reduce(
      (sum, entry) => sum + Math.abs(entry.value - score) * entry.effectiveWeight,
      0,
    ) / totalWeight;
  const agreementConfidence = clamp(
    1 - meanAbsDev / CONSENSUS.agreementVarianceDivisor,
    CONSENSUS.agreementConfidenceFloor,
    1,
  );
  const sourceConfidence = clamp(
    totalWeight / CONSENSUS.sourceCountDenominator,
    CONSENSUS.sourceConfidenceFloor,
    1,
  );

  const weightedById = new Map(weighted.map((w) => [w.rating, w]));
  const breakdown: ConsensusBreakdownEntry[] = normalized.map((entry) => {
    const w = weightedById.get(entry.rating);
    if (w) return toBreakdownEntry(w);
    return {
      source: entry.rating.source,
      normalized: round(entry.value ?? 0),
      baseWeight: entry.baseWeight,
      effectiveWeight: 0,
      recencyMultiplier: round(entry.recencyMultiplier),
      outlierMultiplier: 1,
      applicable: entry.applicable,
    };
  });

  return {
    score: round(score),
    confidence: round(sourceConfidence * agreementConfidence),
    agreementConfidence: round(agreementConfidence),
    sourceConfidence: round(sourceConfidence),
    usedSourceCount: eligible.length,
    breakdown,
  };
}

function toBreakdownEntry(entry: {
  rating: ExternalRatingLike;
  value: number;
  baseWeight: number;
  recencyMultiplier: number;
  outlierMultiplier: number;
  effectiveWeight: number;
  applicable: boolean;
}): ConsensusBreakdownEntry {
  return {
    source: entry.rating.source,
    normalized: round(entry.value),
    baseWeight: entry.baseWeight,
    effectiveWeight: round(entry.effectiveWeight),
    recencyMultiplier: round(entry.recencyMultiplier),
    outlierMultiplier: entry.outlierMultiplier,
    applicable: entry.applicable,
  };
}

function isApplicableForMedium(
  source: ExternalRatingLike["source"],
  mediaType: MediaType | undefined,
): boolean {
  if (!mediaType) return true;
  const applicability = SOURCE_MEDIA_APPLICABILITY[source];
  if (applicability == null) return true;
  return applicability.includes(mediaType);
}

function recencyDecay(fetchedAt: Date | string | undefined, now: Date): number {
  if (!fetchedAt) return 1;
  const fetched =
    fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
  if (!Number.isFinite(fetched.getTime())) return 1;
  const ageDays = (now.getTime() - fetched.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 0) return 1;
  const { staleAfterDays, floor } = CONSENSUS.recency;
  if (ageDays >= staleAfterDays) return floor;
  const remaining = 1 - ageDays / staleAfterDays;
  return floor + (1 - floor) * remaining;
}

function computeMedian(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
