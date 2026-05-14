import type { Prisma, PrismaClient } from "@prisma/client";
import { calculateConsensusScore } from "@/lib/scoring/consensus";
import { calculatePersonalScore } from "@/lib/scoring/personalScore";
import { prisma } from "@/lib/prisma";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function recomputeMediaScores(
  mediaId: string,
  tx: PrismaLike = prisma,
) {
  await Promise.all([
    recomputePersonalScore(mediaId, tx),
    recomputeConsensusScore(mediaId, tx),
  ]);
}

export async function recomputePersonalScore(
  mediaId: string,
  tx: PrismaLike = prisma,
) {
  const item = await tx.mediaItem.findUnique({
    where: { id: mediaId },
    select: {
      personalRating: true,
      pairwiseScore: true,
      comparisonCount: true,
    },
  });
  if (!item) return null;

  const score = calculatePersonalScore({
    explicitRating: item.personalRating,
    pairwiseScore: item.pairwiseScore,
    comparisonCount: item.comparisonCount,
  });

  await tx.mediaItem.update({
    where: { id: mediaId },
    data: {
      computedPersonalScore: score.score,
      personalScoreConfidence: score.confidence,
    },
  });

  return score;
}

export async function recomputeConsensusScore(
  mediaId: string,
  tx: PrismaLike = prisma,
) {
  const ratings = await tx.externalRating.findMany({
    where: { mediaId },
    select: { source: true, score: true, scale: true },
  });
  const consensus = calculateConsensusScore(ratings);

  await tx.mediaItem.update({
    where: { id: mediaId },
    data: {
      computedConsensusScore: consensus.score,
      consensusConfidence: consensus.confidence,
    },
  });

  return consensus;
}
