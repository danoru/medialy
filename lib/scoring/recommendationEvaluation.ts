import {
  buildFriendTrust,
  buildTasteProfiles,
  friendSignal,
  scoreV2,
  type FriendRating,
  type TasteObservation,
} from "./recommendationV2";

// Stable folds do not depend on scores, database order or random state.
export function evaluationFold(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++)
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return (hash >>> 0) % 5;
}

/**
 * Retrospective 5-fold diagnostic, not an online quality claim. Explicit-only
 * training prevents stored Elo from indirectly leaking a held-out preference.
 * Friend compatibility excludes the whole test fold; friends' own item ratings
 * remain legitimate recommendation inputs. Current metadata is not historical.
 */
export function evaluateRecommendations(
  observations: TasteObservation[],
  friends: FriendRating[],
  medium: string,
) {
  const rated = observations.filter(
    (row) =>
      !row.isArchived &&
      row.media.mediaType === medium &&
      row.personalRating != null,
  );
  const explicitOnly = rated.map((row) => ({
    ...row,
    comparisonCount: 0,
    pairwiseScore: 1000,
  }));
  const friendRows = new Map<string, FriendRating[]>();
  for (const row of friends) {
    const group = friendRows.get(row.mediaId) ?? [];
    group.push(row);
    friendRows.set(row.mediaId, group);
  }
  let pairs = 0;
  let v2Wins = 0;
  let consensusWins = 0;
  let evaluatedTitles = 0;
  let skippedFolds = 0;
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
    const trust = buildFriendTrust(
      training.map((row) => ({
        mediaId: row.media.id,
        rating: row.personalRating!,
      })),
      friends,
      excluded,
    );
    const scores = heldOut.map((row) => ({
      rating: row.personalRating!,
      v2: scoreV2(
        row.media,
        profiles,
        friendSignal(friendRows.get(row.media.id) ?? [], trust),
      ).score,
      consensus: row.media.computedConsensusScore,
    }));
    evaluatedTitles += scores.length;
    // Restrict both models to the same pairs with known consensus.
    const likes = scores.filter(
      (row) => row.rating >= 8 && row.consensus != null,
    );
    const dislikes = scores.filter(
      (row) => row.rating <= 5 && row.consensus != null,
    );
    for (const liked of likes)
      for (const disliked of dislikes) {
        pairs++;
        v2Wins +=
          liked.v2 > disliked.v2 ? 1 : liked.v2 === disliked.v2 ? 0.5 : 0;
        consensusWins +=
          liked.consensus! > disliked.consensus!
            ? 1
            : liked.consensus === disliked.consensus
              ? 0.5
              : 0;
      }
  }
  return {
    ratedTitles: rated.length,
    evaluatedTitles,
    skippedFolds,
    pairs,
    v2Accuracy: pairs ? v2Wins / pairs : null,
    consensusAccuracy: pairs ? consensusWins / pairs : null,
  };
}
