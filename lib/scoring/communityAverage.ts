/**
 * Aggregate of other Medialy users' personal scores for a single media item.
 *
 * Distinct from `consensus` (which aggregates external critic/audience sources)
 * — this is the platform's own community signal. Displayed on the media detail
 * page alongside `Consensus` so users can compare critic verdict vs Medialy
 * community verdict.
 *
 * Returns the raw arithmetic mean (not shrunk) because the rater count is
 * surfaced alongside it — readers can judge thin samples themselves. Ranking
 * surfaces that need shrinkage (Discover, Top 10) use `bayesianShrunkMean`
 * directly.
 */
export type CommunityAverageInput = {
  computedPersonalScore: number | null;
};

export type CommunityAverageResult = {
  score: number | null;
  raterCount: number;
};

export function calculateCommunityAverage(
  ratings: CommunityAverageInput[],
): CommunityAverageResult {
  const scores = ratings
    .map((rating) => rating.computedPersonalScore)
    .filter((score): score is number => score != null);

  if (scores.length === 0) {
    return { score: null, raterCount: 0 };
  }

  const sum = scores.reduce((acc, score) => acc + score, 0);
  const mean = sum / scores.length;
  return {
    score: Math.round(mean * 10) / 10,
    raterCount: scores.length,
  };
}
