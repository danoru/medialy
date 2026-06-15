import type { ExternalRatingSource, MediaType } from "@prisma/client";

/**
 * Single source of truth for every scoring tunable. Group constants by metric
 * so they can be surfaced on `/data-health/scoring` (and hover explainers) with
 * a short description of what the knob does.
 *
 * If you find a magic number elsewhere in `lib/scoring/`, move it here.
 */

// -----------------------------------------------------------------------------
// Pairwise / Elo
// -----------------------------------------------------------------------------

export const PAIRWISE = {
  initialScore: 1000,
  baseKFactor: 32,
  /**
   * K-factor decay buckets. Each entry: when an item has at least `atLeast`
   * comparisons, its K multiplier becomes `multiplier`. Walk top-down and take
   * the last matching bucket. Smaller K = score moves less per comparison.
   */
  kDecay: [
    { atLeast: 0, multiplier: 1 },
    { atLeast: 3, multiplier: 0.75 },
    { atLeast: 10, multiplier: 0.5 },
    { atLeast: 25, multiplier: 0.35 },
  ],
  /**
   * Confidence buckets for "how much do I trust this Elo score?". Walked the
   * same way as `kDecay` — last matching wins.
   */
  confidenceBuckets: [
    { atLeast: 0, value: 0.2 },
    { atLeast: 1, value: 0.45 },
    { atLeast: 3, value: 0.7 },
    { atLeast: 8, value: 1 },
  ],
  /**
   * Range used when collapsing Elo into a 0–100 / 0–10 UI value. Centered on
   * the 1000 starting score so a never-compared / break-even item maps to a
   * neutral 5.0, not a deflated 3.0.
   */
  uiRange: { min: 750, max: 1250 },
  /**
   * When computing "expected" outcome of a comparison, we blend the item's
   * explicit rating, its consensus, and its pairwise score into one effective
   * 0–10 strength. This lets a low-rated item that beats a high-rated one
   * register as a real upset. Weights default to zero for missing inputs.
   *
   * The weights are *targets*; missing inputs are dropped and the remaining
   * weights are renormalized.
   */
  priorBlend: {
    personalRating: 0.55,
    consensus: 0.2,
    pairwise: 0.25,
  },
  /**
   * Each 1.0 difference in effective rating (0–10 scale) becomes this many
   * Elo points when computing expected outcome. Higher = bigger upset bonus.
   */
  priorSpreadPerRatingPoint: 60,
} as const;

// -----------------------------------------------------------------------------
// Personal score
// -----------------------------------------------------------------------------

export const PERSONAL_SCORE = {
  /**
   * Target weight given to the pairwise-derived rating when blending with an
   * explicit rating. Actual weight scales with pairwise confidence; the
   * remainder goes to the explicit rating. 0 = ignore pairwise entirely.
   */
  relationalWeight: 0.3,
  /** Floor on personal-score confidence when an explicit rating exists. */
  explicitRatingConfidenceFloor: 0.55,
  /** Pairwise confidence gets multiplied by this when no explicit rating exists. */
  pairwiseOnlyConfidenceDamping: 0.6,
} as const;

// -----------------------------------------------------------------------------
// Consensus (external ratings)
// -----------------------------------------------------------------------------

/**
 * Per-source trust. 0 = ignore. 1.0 = full trust. Critic aggregates score
 * higher than mass-audience scores because of brigading / population bias.
 *
 * Sources not listed are treated as 0.5 (neutral) for forward compatibility.
 */
export const SOURCE_TRUST_WEIGHTS: Record<ExternalRatingSource, number> = {
  METACRITIC: 1.0,
  OPENCRITIC: 1.0,
  ROTTEN_TOMATOES_CRITICS: 0.85,
  ROTTEN_TOMATOES_AUDIENCE: 0.55,
  IMDB: 0.6,
  LETTERBOXD: 0.75,
  TMDB: 0.45,
  GOODREADS: 0.7,
  STORYGRAPH: 0.75,
  BGG: 0.95,
  STEAM: 0.5,
  ANILIST: 0.75,
  MYANIMELIST: 0.7,
  RAWG_USER: 0.5,
};

/**
 * Per-medium gating: a source contributes to consensus only if the media
 * type is listed. `null` means "applies to every media type". This stops e.g.
 * Goodreads from weighting a video game.
 */
export const SOURCE_MEDIA_APPLICABILITY: Record<
  ExternalRatingSource,
  MediaType[] | null
> = {
  METACRITIC: ["MOVIE", "TV_SHOW", "VIDEO_GAME", "MUSIC"],
  OPENCRITIC: ["VIDEO_GAME"],
  ROTTEN_TOMATOES_CRITICS: ["MOVIE", "TV_SHOW"],
  ROTTEN_TOMATOES_AUDIENCE: ["MOVIE", "TV_SHOW"],
  IMDB: ["MOVIE", "TV_SHOW"],
  LETTERBOXD: ["MOVIE"],
  TMDB: ["MOVIE", "TV_SHOW"],
  GOODREADS: ["BOOK"],
  STORYGRAPH: ["BOOK"],
  BGG: ["BOARD_GAME"],
  STEAM: ["VIDEO_GAME"],
  ANILIST: ["TV_SHOW", "MOVIE"],
  MYANIMELIST: ["TV_SHOW", "MOVIE"],
  RAWG_USER: ["VIDEO_GAME"],
};

export const CONSENSUS = {
  /**
   * Confidence scales with how many independent sources we have. Total
   * weight is divided by this denominator before being clamped to [0.25, 1].
   */
  sourceCountDenominator: 3,
  sourceConfidenceFloor: 0.25,
  /**
   * Agreement confidence — high variance across sources drops confidence.
   * `1 - variance / divisor`, clamped to [floor, 1].
   */
  agreementVarianceDivisor: 5,
  agreementConfidenceFloor: 0.3,
  /**
   * Outlier handling. When N ≥ minSourcesForTrim, any rating ≥
   * deviationFromMedian away from the median is multiplied by trimMultiplier.
   * Stops a single wild source from dragging the mean.
   */
  outlierTrim: {
    minSourcesForTrim: 4,
    deviationFromMedian: 3,
    trimMultiplier: 0.35,
  },
  /**
   * Recency decay on `fetchedAt`. Linear from 1.0 down to `floor` over
   * `staleAfterDays`. Anything older than `staleAfterDays` stays at `floor`.
   */
  recency: {
    staleAfterDays: 365,
    floor: 0.5,
  },
} as const;

// -----------------------------------------------------------------------------
// Medialy Match (taste-only)
// -----------------------------------------------------------------------------

/**
 * Match weights MUST sum to ~1.0 to keep the output bounded to 0–100.
 *
 * Personal score is intentionally omitted: recommendations only surface items
 * the viewer has not consumed (see `eligibility.ts`), so personal score adds
 * no signal — taste is represented through affinity overlap instead.
 *
 * Buckets target a 50 / 30 / 20 split:
 *  - Affinity (genre + tag + contributor): 50% — your demonstrated taste
 *  - Friends: 30% — ratings from followers, weighted by taste compatibility
 *  - Consensus: 20% — external critics, the least personal signal
 *
 * Each entry: what does the signal measure, and how do you tune it?
 *  - genreAffinity: overlap with genres of your 8+ rated completed items
 *  - tagAffinity:   overlap with tags of your 8+ rated completed items (includes country)
 *  - contributorAffinity: shared director/creator/dev/publisher with your highly-rated items
 *  - friendAffinity: ratings + watch status of users you follow, scaled by per-follower compatibility
 *  - consensus:     external critic agreement
 */
export const MEDIALY_MATCH_WEIGHTS = {
  genreAffinity: 0.2,
  tagAffinity: 0.15,
  contributorAffinity: 0.15,
  friendAffinity: 0.3,
  consensus: 0.2,
} as const;

/**
 * Affinity-map tuning. Two compounding techniques fight saturation:
 *
 *  - Bayesian shrinkage on per-feature mean rating. A genre's affinity is the
 *    average rating of items in it, pulled toward the global mean by `shrinkageK`
 *    pseudo-observations. Common-but-mediocre genres earn less than niche-but-loved
 *    ones; never-rated features default to neutral. Floored at zero — disliked
 *    genres simply don't contribute (no active demotion). Revisit if needed.
 *
 *  - BM25-style soft saturation on the candidate-side sum. Replaces a hard
 *    clamp(0,100). A candidate matching two niche genres can compound past what
 *    one popular genre can reach alone; nothing ever pegs at exactly 100.
 */
/**
 * Cross-user / cross-surface ranking tunables. Used wherever we rank items by
 * a quality score that blends multiple-evidence inputs (Overall Top 10,
 * Insights standouts, Discover). Each `shrinkageK` is the "minimum evidence
 * count to trust the observed mean at face value" — items with less evidence
 * get pulled toward the global prior in proportion to how thin their sample is.
 *
 * Values are intentionally small. IMDB's m=25000 is for a giant population;
 * we have tens to hundreds of users and a handful of critic sources per item.
 */
export const TOP_RANKING = {
  shrinkageK: {
    user: 3,
    source: 2,
    personal: 3,
  },
  /** Used only when the global pool is empty (fresh install). */
  fallbackPrior: 7.0,
} as const;

export const AFFINITY_TUNING = {
  shrinkageK: 5,
  neutralPivot: 6.5,
  scale: 30,
  saturationK: {
    genre: 60,
    tag: 30,
    contributor: 25,
  },
} as const;

// -----------------------------------------------------------------------------
// Comparison relevance (which Elo matchups to surface)
// -----------------------------------------------------------------------------

export const COMPARISON_RELEVANCE = {
  base: 0.25,
  genre: 0.35,
  tag: 0.08,
  rating: 0.2,
  pairwise: 0.1,
  year: 0.05,
  /** Distance budgets — proximity collapses linearly to zero past these. */
  ratingMaxDistance: 4,
  pairwiseMaxDistance: 500,
  yearMaxDistance: 30,
  /** How relevance maps to Elo weight: floor + (1 - floor) * relevance. */
  eloWeightFloor: 0.35,
} as const;

// -----------------------------------------------------------------------------
// Rating compatibility (used by `/friends` follow list and guest taste flow)
// -----------------------------------------------------------------------------

export const RATING_COMPATIBILITY = {
  /**
   * Compatibility = max(0, 100 - averageRatingDistance * penalty). 12 means a
   * 1-point average gap drops you to 88; a 5-point gap drops you to 40.
   */
  ratingDistancePenalty: 12,
} as const;

// -----------------------------------------------------------------------------
// Hidden gems & discoverability badges
// -----------------------------------------------------------------------------

export const HIDDEN_GEM = {
  weights: {
    quality: 0.55,
    obscurity: 0.3,
    confidence: 0.15,
  },
  /**
   * Quality is the max of these normalized signals — an item that excels by
   * any one measure can qualify.
   */
  qualitySources: {
    personalScore: { min: 5, max: 10 },
    consensusScore: { min: 5, max: 10 },
    pairwiseScore: { min: 1000, max: 1300 },
  },
  /** Threshold for the "Hidden Gem" badge. Above this, surface it. */
  badgeThreshold: 0.65,
  /** Minimum confidence to qualify — keeps no-data items out of the set. */
  minConfidence: 0.5,
} as const;

export const BADGE_THRESHOLDS = {
  sleeperHit: {
    /** Strong consensus but you haven't engaged. */
    minConsensusScore: 8,
    minConsensusConfidence: 0.5,
  },
  polarizing: {
    /** Wide spread across critics. */
    minSources: 3,
    minStandardDeviation: 1.5,
  },
  coldTake: {
    /** You loved it, the world didn't. */
    minPersonalScore: 8,
    maxConsensusScore: 6,
  },
  hotTakeFailed: {
    /** The world loved it, you didn't. */
    minConsensusScore: 8,
    maxPersonalScore: 5,
  },
  friendFavoriteUntouched: {
    minFriendRating: 8,
  },
} as const;
