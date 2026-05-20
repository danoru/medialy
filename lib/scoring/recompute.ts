import type { Prisma, PrismaClient } from "@prisma/client";
import { calculateConsensusScore } from "@/lib/scoring/consensus";
import { calculatePersonalScore } from "@/lib/scoring/personalScore";
import { prisma } from "@/lib/prisma";
import { DEFAULT_USER_MEDIA, upsertUserMedia } from "@/lib/db/user-media";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Recompute both personal (per-user) and consensus (cross-user) scores.
 * Pass a Prisma transaction client to participate in an outer `$transaction`.
 */
export async function recomputeMediaScores(
  mediaId: string,
  userId: string,
  tx: PrismaLike = prisma,
) {
  await Promise.all([
    recomputePersonalScore(mediaId, userId, tx),
    recomputeConsensusScore(mediaId, tx),
  ]);
}

export async function recomputePersonalScore(
  mediaId: string,
  userId: string,
  tx: PrismaLike = prisma,
) {
  const [media, userMedia] = await Promise.all([
    tx.mediaItem.findUnique({
      where: { id: mediaId },
      select: { id: true },
    }),
    tx.userMedia.findUnique({
      where: { userId_mediaId: { userId, mediaId } },
      select: {
        personalRating: true,
        pairwiseScore: true,
        comparisonCount: true,
      },
    }),
  ]);
  if (!media) return null;

  const personalRating = userMedia?.personalRating ?? null;
  const pairwiseScore =
    userMedia?.pairwiseScore ?? DEFAULT_USER_MEDIA.pairwiseScore;
  const comparisonCount =
    userMedia?.comparisonCount ?? DEFAULT_USER_MEDIA.comparisonCount;

  const score = calculatePersonalScore({
    explicitRating: personalRating,
    pairwiseScore,
    comparisonCount,
  });

  await upsertUserMedia(
    userId,
    mediaId,
    {
      computedPersonalScore: score.score,
      personalScoreConfidence: score.confidence,
    },
    tx,
  );

  return score;
}

export async function recomputeConsensusScore(
  mediaId: string,
  tx: PrismaLike = prisma,
) {
  const [item, ratings] = await Promise.all([
    tx.mediaItem.findUnique({
      where: { id: mediaId },
      select: { mediaType: true },
    }),
    tx.externalRating.findMany({
      where: { mediaId },
      select: { source: true, score: true, scale: true, fetchedAt: true },
    }),
  ]);
  const consensus = calculateConsensusScore(ratings, {
    mediaType: item?.mediaType,
  });

  await tx.mediaItem.update({
    where: { id: mediaId },
    data: {
      computedConsensusScore: consensus.score,
      consensusConfidence: consensus.confidence,
    },
  });

  return consensus;
}
