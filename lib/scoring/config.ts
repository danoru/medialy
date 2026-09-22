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

/**
 * The v2 taste engine (`lib/scoring/recommendationV2.ts`). Every signal is a
 * 0–100 value centered on 50 plus a 0–1 reliability; the score is 50 plus the
 * weighted, reliability-scaled deviations. See the module header for the
 * signal definitions.
 */
export const RECOMMENDATION_V2 = {
  neutral: 50,
  /** Pseudo-observations of neutral taste for each feature. */
  featurePrior: 5,
  /**
   * Added to a candidate's feature count when turning per-feature support
   * into signal reliability, so one known genre is not full confidence but
   * three well-supported ones nearly are.
   */
  featureBreadthPrior: 2,
  /** Stabilizes the per-medium rating baseline for sparse users. */
  baselinePrior: 5,
  fallbackRating: 6.5,
  ratingPointScale: 20,
  /**
   * Stored ratings below this are placeholders, not opinions: the rating
   * control bottoms out at a half star, so a 0 was never entered by a person.
   * They are read as no rating.
   */
  minExplicitRating: 0.5,
  /** Neutral friend evidence; avoids one rating dominating the score. */
  friendPrior: 2,
  overlapPrior: 5,
  /** Opinion value when a friend finished or watchlisted a title without rating it. */
  statusOnlyInterest: 55,
  /**
   * The critic score that reads as neutral. The catalog's mean consensus is
   * about 7, so a 6 is below par and a 8.5 is strong; on the raw 0–10 scale
   * almost everything looked positive.
   */
  consensusNeutral: 7,
  /** Points of signal per critic point away from neutral. */
  consensusPointScale: 20,
  /**
   * Chosen by the holdout sweep of September 21, 2026 (pooled pair accuracy
   * 86.1%, v1 was 72%). Critics carry the most weight because for the two
   * largest histories they were the best single predictor; the personal
   * signals add most where taste and critics part ways.
   */
  weights: {
    similarity: 0.25,
    genre: 0.05,
    tag: 0.04,
    contributor: 0.06,
    friends: 0.22,
    twins: 0.1,
    consensus: 0.28,
  },
  /** Shared ratings a non-followed user needs before counting as a taste twin. */
  twinMinOverlap: 15,
  /**
   * Tiering: the friends and twins weights fade by how reliable the viewer's
   * own taste signals are, and the critics weight fades by how reliable any
   * tier above it is, so each tier only speaks up when the ones above are
   * quiet. Chosen September 22, 2026: costs about 1.6 points of holdout
   * accuracy against flat weights and makes the viewer's own history the
   * primary driver.
   */
  backoff: {
    enabled: true,
    friendFade: 0.5,
    consensusFade: 0.7,
  },
  similarity: {
    /** Nearest rated titles considered per candidate. */
    neighbours: 20,
    /** Cosine below this is not a neighbour at all. */
    minSimilarity: 0.1,
    /** Squared-similarity support needed for half reliability. */
    prior: 1.5,
    /** Weight of a genre in the item vector; tags use the category weights. */
    genreWeight: 1.5,
    tagCategoryWeights: {
      SUBGENRE: 1,
      THEME: 0.8,
      MOOD: 0.8,
      MECHANIC: 0.7,
      COUNTRY: 0.5,
      FORMAT: 0.3,
      default: 0.6,
    },
    /** Tag categories that mean the same thing across movies, TV and games. */
    portableTagCategories: ["THEME", "MOOD", "COUNTRY"],
    /** Same-medium reliability under which other media are consulted too. */
    crossMediumBelow: 0.3,
    /** Reliability multiplier for neighbours from another medium. */
    crossMediumFactor: 0.4,
  },
  roleWeights: {
    DIRECTOR: 1,
    CREATOR: 1,
    DEVELOPER: 0.55,
    PUBLISHER: 0.35,
    ACTOR: 0,
  },
} as const;

/**
 * Variety for short recommendation rows (dashboard picks). See
 * `lib/scoring/diversity.ts`.
 */
export const DIVERSITY = {
  /** How hard a near-duplicate of an earlier pick is pushed down, in score points per unit similarity. */
  lambda: 0.35,
  /** Similarity assigned to two picks that share a director, creator or studio. */
  sameCreatorSimilarity: 0.7,
  genreShare: 0.6,
  tagShare: 0.4,
  /** Slots in a row reserved for a pick outside the viewer's usual genres. */
  adventurousSlots: 1,
  /** Calibrated Match the adventurous pick must reach. */
  adventurousFloor: 55,
  /** How many of the viewer's most-rated genres count as "usual". */
  usualGenreCount: 3,
} as const;

/** Holdout thresholds, relative to the viewer's mean rating in the medium. */
export const RECOMMENDATION_EVALUATION = {
  /** A held-out title counts as liked when rated this far above the mean. */
  likedMargin: 1,
  /** ...and as disliked when rated this far below it. */
  dislikedMargin: 1,
} as const;

/**
 * Maps the raw v2 score to the displayed Match ("chance you rate this above
 * your own average"). Fitted by `npm run recommendations:evaluate -- --all`
 * on held-out ratings; paste the printed values here after a refit.
 *
 * Fitted September 22, 2026 on 1,399 held-out ratings from three users with
 * tiering and taste twins on (Brier 0.2158 against 0.25 for a constant
 * guess). A raw 50 shows as 47%, a raw 60 as 94%, a raw 40 as 4%: the tiered
 * score moves less than the flat one did, so the curve is steeper.
 */
export const MATCH_CALIBRATION = {
  intercept: -0.1351,
  slope: 0.3004,
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
// Friend signal (the `friendAffinity` input to Medialy Match)
// -----------------------------------------------------------------------------

/**
 * How followed users' opinions of a candidate become one 0–100 signal.
 *
 *  - A friend's compatibility is shrunk toward neutral (50) by how many titles
 *    the two of you have both rated: `overlap / (overlap + overlapPrior)`. One
 *    matching rating no longer makes someone a 100% taste twin.
 *  - Their opinion is a 0–100 value: `(rating − 5) × 20` for an explicit rating
 *    (a 10 reaches 100, a 5 is neutral), else a small interest value for having
 *    finished or watchlisted the title. Status is never added on top of a rating.
 *  - The compatibility-weighted mean is then multiplied by
 *    `Σw / (Σw + evidencePrior)`, so a single 50%-compatible friend moves the
 *    signal about half as far as a fully trusted one, instead of the weight
 *    cancelling out of the average entirely.
 */
export const FRIEND_SIGNAL = {
  overlapPrior: 5,
  evidencePrior: 1,
  completedInterest: 15,
  watchlistInterest: 8,
} as const;

// -----------------------------------------------------------------------------
// Discover page sections (see `lib/discover.ts`)
// -----------------------------------------------------------------------------

/**
 * Every Discover section ranks on the same global Quality score the dashboard
 * Top 10 and Canon use (`dashboardQualityScore`), so the lists are the same for
 * every viewer; the viewer only affects which titles are hidden (finished,
 * dropped, not interested) and the seeds for "If You Liked".
 *
 * "Reach" is how many people have weighed in: Medialy raters plus external
 * rating sources. It is expressed as a percentile within the genre pool so a
 * small catalog still gets a spread.
 */
export const DISCOVER = {
  essentials: {
    limit: 14,
    /**
     * Essentials are the acknowledged best, so they come from the more-seen
     * part of the pool. Titles below this reach percentile are left for
     * Hidden Gems. Relaxed when the pool is too small to fill the shelf.
     */
    minReachPercentile: 0.4,
  },
  gateway: {
    limit: 4,
    /** Critics have to broadly agree for a title to be an entry point. */
    minConsensusConfidence: 0.5,
    /** Entry points are widely seen, so they must sit in the upper half of reach. */
    minReachPercentile: 0.5,
    /** How many of the genre's most frequent subgenre tags count as "mainstream". */
    commonSubgenres: 8,
  },
  hiddenGems: {
    limit: 8,
    /** Gems must be in the less-seen 60% of the pool by reach. */
    maxReachPercentile: 0.6,
  },
  ifYouLiked: {
    limit: 4,
    /** Chains below this similarity are dropped rather than shown as filler. */
    minSimilarity: 0.25,
    taxonomyWeight: 0.7,
    creditWeight: 0.3,
  },
  /** Posters shown on a world card on the Discover landing. */
  worldMosaicSize: 3,
  /**
   * Pseudo-titles at the pool mean added to each world before ordering the
   * world rail, so tiny worlds need a big margin to outrank large ones.
   */
  worldRankPrior: 8,
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
