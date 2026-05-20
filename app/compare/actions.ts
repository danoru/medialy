"use server";

import { revalidatePath } from "next/cache";
import {
  isComparisonEligibleStatus,
  isReleasedForComparison,
} from "@/lib/compare";
import {
  calculateComparisonRelevance,
  relevanceToEloWeight,
} from "@/lib/scoring/comparisonRelevance";
import { applyEloResult } from "@/lib/scoring";
import { expectedWinProbabilityFromPriors } from "@/lib/scoring/pairwise";
import { prisma } from "@/lib/prisma";
import { recomputePersonalScore } from "@/lib/scoring/recompute";
import { getCurrentUserId } from "@/lib/user";
import {
  mergeUserMedia,
  upsertUserMedia,
  userMediaInclude,
} from "@/lib/db/user-media";

export async function saveComparison(formData: FormData) {
  const winnerId = String(formData.get("winnerId") ?? "");
  const loserId = String(formData.get("loserId") ?? "");
  const context = String(formData.get("context") ?? "OVERALL") as "OVERALL";
  const notes = String(formData.get("notes") ?? "").trim();
  if (!winnerId || !loserId || winnerId === loserId) return;

  const userId = await getCurrentUserId();

  await prisma.$transaction(async (tx) => {
    const [winnerRow, loserRow] = await Promise.all([
      tx.mediaItem.findUniqueOrThrow({
        where: { id: winnerId },
        include: {
          genres: { include: { genre: true } },
          ...userMediaInclude(userId),
        },
      }),
      tx.mediaItem.findUniqueOrThrow({
        where: { id: loserId },
        include: {
          genres: { include: { genre: true } },
          ...userMediaInclude(userId),
        },
      }),
    ]);
    const winner = mergeUserMedia(winnerRow);
    const loser = mergeUserMedia(loserRow);
    if (
      winner.isArchived ||
      loser.isArchived ||
      !isComparisonEligibleStatus(winner.status) ||
      !isComparisonEligibleStatus(loser.status) ||
      !isReleasedForComparison(winner.releaseDate) ||
      !isReleasedForComparison(loser.releaseDate) ||
      winner.mediaType !== loser.mediaType
    ) {
      throw new Error(
        "Comparisons must use two active, released items from the same media type.",
      );
    }
    const relevance = calculateComparisonRelevance(winner, loser);
    const eloWeight = relevanceToEloWeight(relevance);
    const expectedWinnerWinProb = expectedWinProbabilityFromPriors(
      {
        personalRating: winner.personalRating,
        consensusScore: winner.computedConsensusScore,
        pairwiseScore: winner.pairwiseScore,
      },
      {
        personalRating: loser.personalRating,
        consensusScore: loser.computedConsensusScore,
        pairwiseScore: loser.pairwiseScore,
      },
    );
    const updated = applyEloResult({
      winnerScore: winner.pairwiseScore,
      loserScore: loser.pairwiseScore,
      winnerComparisonCount: winner.comparisonCount,
      loserComparisonCount: loser.comparisonCount,
      weight: eloWeight,
      expectedWinnerWinProb,
    });

    await tx.pairwiseComparison.create({
      data: {
        userId,
        winnerId,
        loserId,
        context,
        notes: notes || null,
        weight: eloWeight,
        winnerScoreBefore: winner.pairwiseScore,
        winnerScoreAfter: updated.winnerScore,
        loserScoreBefore: loser.pairwiseScore,
        loserScoreAfter: updated.loserScore,
        winnerDelta: updated.winnerDelta,
        loserDelta: updated.loserDelta,
        expectedWinnerWinProb: updated.expectedWinnerWinProb,
      },
    });
    await upsertUserMedia(
      userId,
      winnerId,
      {
        pairwiseScore: updated.winnerScore,
        comparisonCount: winner.comparisonCount + 1,
      },
      tx,
    );
    await upsertUserMedia(
      userId,
      loserId,
      {
        pairwiseScore: updated.loserScore,
        comparisonCount: loser.comparisonCount + 1,
      },
      tx,
    );
    await Promise.all([
      recomputePersonalScore(winnerId, userId, tx),
      recomputePersonalScore(loserId, userId, tx),
    ]);
  });

  revalidatePath("/compare");
  revalidatePath("/media");
  revalidatePath("/dashboard");
}
