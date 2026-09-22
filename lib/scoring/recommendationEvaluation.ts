import {
  buildFriendBaselines,
  buildFriendTrust,
  buildTasteProfiles,
  explicitRating,
  friendSignal,
  scoreV2,
  type FriendRating,
  type TasteObservation,
} from "./recommendationV2";
import {
  buildAffinityMaps,
  candidateAffinity,
  V1_LOVED_THRESHOLD,
} from "./affinityProfile";
import { calculateMedialyMatch } from "./medialyMatch";
import { RECOMMENDATION_EVALUATION, RECOMMENDATION_V2 } from "./config";
import type { CalibrationSample } from "./calibration";

// Stable folds do not depend on scores, database order or random state.
export function evaluationFold(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++)
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return (hash >>> 0) % 5;
}

export type EvaluationResult = {
  ratedTitles: number;
  evaluatedTitles: number;
  skippedFolds: number;
  /** The viewer's mean explicit rating in this medium; "liked" and "disliked" are relative to it. */
  meanRating: number | null;
  likedTitles: number;
  dislikedTitles: number;
  pairs: number;
  /** Fraction of liked/disliked pairs each ranker orders correctly; 0.5 is chance. */
  v2Accuracy: number | null;
  v1Accuracy: number | null;
  consensusAccuracy: number | null;
  /** Raw v2 score against "rated above own mean", for calibration. */
  samples: CalibrationSample[];
};

/**
 * Retrospective 5-fold diagnostic, not an online quality claim. Explicit-only
 * training prevents stored Elo from indirectly leaking a held-out preference.
 * Friend compatibility excludes the whole test fold; friends' own item ratings
 * remain legitimate recommendation inputs. Current metadata is not historical.
 *
 * "Liked" and "disliked" are relative to the viewer's own mean rating in the
 * medium, by `RECOMMENDATION_EVALUATION.likedMargin` / `dislikedMargin`, so a
 * harsh rater and a generous one are judged on the same footing.
 *
 * Three rankers are scored on the same pairs: v2, the live v1 affinity engine
 * (trained on the fold's loved titles, friend signal off), and consensus alone.
 */
export function evaluateRecommendations(
  observations: TasteObservation[],
  friends: FriendRating[],
  medium: string,
  /** Rows from users the viewer does not follow; taste twins come from here. */
  others: FriendRating[] = [],
): EvaluationResult {
  const rated = observations.filter(
    (row) =>
      !row.isArchived &&
      row.media.mediaType === medium &&
      explicitRating(row.personalRating) != null,
  );
  const explicitOnly = rated.map((row) => ({
    ...row,
    comparisonCount: 0,
    pairwiseScore: 1000,
  }));
  const meanRating =
    rated.length > 0
      ? rated.reduce((sum, row) => sum + row.personalRating!, 0) / rated.length
      : null;
  const groupByMedia = (rows: FriendRating[]) => {
    const map = new Map<string, FriendRating[]>();
    for (const row of rows) {
      const group = map.get(row.mediaId) ?? [];
      group.push(row);
      map.set(row.mediaId, group);
    }
    return map;
  };
  const friendRows = groupByMedia(friends);
  const otherRows = groupByMedia(others);
  const baselines = buildFriendBaselines([...friends, ...others]);

  let pairs = 0;
  let v2Wins = 0;
  let v1Wins = 0;
  let consensusWins = 0;
  let evaluatedTitles = 0;
  let skippedFolds = 0;
  let likedTitles = 0;
  let dislikedTitles = 0;
  const samples: CalibrationSample[] = [];

  for (let fold = 0; fold < 5; fold++) {
    const heldOut = explicitOnly.filter(
      (row) => evaluationFold(row.media.id) === fold,
    );
    const excluded = new Set(heldOut.map((row) => row.media.id));
    const training = explicitOnly.filter((row) => !excluded.has(row.media.id));
    if (training.length < 5 || !heldOut.length) {
      skippedFolds++;
      continue;
    }
    const profiles = buildTasteProfiles(training);
    const viewerRatings = training.map((row) => ({
      mediaId: row.media.id,
      rating: row.personalRating!,
    }));
    const trust = buildFriendTrust(viewerRatings, friends, excluded);
    const twinTrust = buildFriendTrust(viewerRatings, others, excluded);
    const affinity = buildAffinityMaps(
      training
        .filter((row) => row.personalRating! >= V1_LOVED_THRESHOLD)
        .map((row) => ({ rating: row.personalRating!, media: row.media })),
    );

    const scores = heldOut.map((row) => {
      const v2 = scoreV2(
        row.media,
        profiles,
        friendSignal(friendRows.get(row.media.id) ?? [], trust, baselines),
        {
          twins: friendSignal(
            otherRows.get(row.media.id) ?? [],
            twinTrust,
            baselines,
            { minOverlap: RECOMMENDATION_V2.twinMinOverlap, noun: "taste-twin" },
          ),
        },
      ).score;
      const v1 = calculateMedialyMatch({
        ...candidateAffinity(row.media, affinity),
        friendAffinity: 0,
        consensusScore: row.media.computedConsensusScore,
      }).score;
      return {
        rating: row.personalRating!,
        v2,
        v1,
        consensus: row.media.computedConsensusScore,
      };
    });
    evaluatedTitles += scores.length;
    if (meanRating != null) {
      for (const entry of scores) {
        samples.push({ score: entry.v2, above: entry.rating > meanRating });
      }
    }

    // Restrict every ranker to the same pairs with known consensus.
    const liked = scores.filter(
      (row) =>
        meanRating != null &&
        row.rating >= meanRating + RECOMMENDATION_EVALUATION.likedMargin &&
        row.consensus != null,
    );
    const disliked = scores.filter(
      (row) =>
        meanRating != null &&
        row.rating <= meanRating - RECOMMENDATION_EVALUATION.dislikedMargin &&
        row.consensus != null,
    );
    likedTitles += liked.length;
    dislikedTitles += disliked.length;
    const win = (a: number, b: number) => (a > b ? 1 : a === b ? 0.5 : 0);
    for (const good of liked)
      for (const bad of disliked) {
        pairs++;
        v2Wins += win(good.v2, bad.v2);
        v1Wins += win(good.v1, bad.v1);
        consensusWins += win(good.consensus!, bad.consensus!);
      }
  }
  return {
    ratedTitles: rated.length,
    evaluatedTitles,
    skippedFolds,
    meanRating,
    likedTitles,
    dislikedTitles,
    pairs,
    v2Accuracy: pairs ? v2Wins / pairs : null,
    v1Accuracy: pairs ? v1Wins / pairs : null,
    consensusAccuracy: pairs ? consensusWins / pairs : null,
    // Sorted so the result does not depend on input order.
    samples: samples.sort(
      (a, b) => a.score - b.score || Number(a.above) - Number(b.above),
    ),
  };
}
