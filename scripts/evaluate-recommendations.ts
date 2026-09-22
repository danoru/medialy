/**
 * Read-only diagnostic for the recommendation engine.
 *
 *   npm run recommendations:evaluate -- <userId>   one user, per medium
 *   npm run recommendations:evaluate -- --all      every user with enough
 *                                                  ratings, plus a pooled
 *                                                  calibration fit to paste
 *                                                  into MATCH_CALIBRATION
 *
 * Reads each evaluated user's rated rows and every other user's public rows once; it
 * never writes.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { LEAN_MEDIA_WITH_CREDITS_SELECT } from "@/lib/db/media-select";
import { getFollowingIds } from "@/lib/social/follows";
import { VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import {
  evaluateRecommendations,
  type EvaluationResult,
} from "@/lib/scoring/recommendationEvaluation";
import {
  brierScore,
  fitLogistic,
  type CalibrationSample,
} from "@/lib/scoring/calibration";
import { MATCH_CALIBRATION } from "@/lib/scoring/config";

const MIN_RATINGS_FOR_ALL = 20;

async function loadUser(userId: string) {
  const [observations, following] = await Promise.all([
    prisma.userMedia.findMany({
      where: { userId, isArchived: false, personalRating: { not: null } },
      select: {
        personalRating: true,
        pairwiseScore: true,
        comparisonCount: true,
        status: true,
        isArchived: true,
        media: { select: LEAN_MEDIA_WITH_CREDITS_SELECT },
      },
    }),
    getFollowingIds(userId),
  ]);
  // Every other user's public rows; friends are the followed ones, the rest
  // may qualify as taste twins by overlap.
  const rows = await prisma.userMedia.findMany({
    where: {
      userId: { not: userId },
      isArchived: false,
      OR: [
        { personalRating: { not: null } },
        { status: { in: ["COMPLETED", "WATCHLIST"] } },
      ],
    },
    select: {
      userId: true,
      mediaId: true,
      personalRating: true,
      status: true,
      media: { select: { mediaType: true } },
    },
  });
  const followed = new Set(following);
  const social = rows.map((row) => ({
    userId: row.userId,
    mediaId: row.mediaId,
    mediaType: row.media.mediaType,
    rating: row.personalRating,
    status: row.status,
  }));
  return {
    observations,
    friends: social.filter((row) => followed.has(row.userId)),
    others: social.filter((row) => !followed.has(row.userId)),
  };
}

function summarize(result: EvaluationResult) {
  const pct = (value: number | null) =>
    value == null ? "n/a" : `${(value * 100).toFixed(1)}%`;
  return {
    rated: result.ratedTitles,
    mean: result.meanRating == null ? null : Number(result.meanRating.toFixed(2)),
    liked: result.likedTitles,
    disliked: result.dislikedTitles,
    pairs: result.pairs,
    v2: pct(result.v2Accuracy),
    v1: pct(result.v1Accuracy),
    consensus: pct(result.consensusAccuracy),
  };
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    throw new Error("Pass a user ID, or --all for every user with enough ratings.");
  }

  const userIds = arg === "--all"
    ? (
        await prisma.userMedia.groupBy({
          by: ["userId"],
          where: { isArchived: false, personalRating: { not: null } },
          _count: { _all: true },
        })
      )
        .filter((row) => row._count._all >= MIN_RATINGS_FOR_ALL)
        .map((row) => row.userId)
    : [arg];

  const pooled: CalibrationSample[] = [];
  const report: Record<string, unknown>[] = [];
  for (const userId of userIds) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new Error(`User ${userId} not found.`);
    const { observations, friends, others } = await loadUser(userId);
    for (const medium of VISIBLE_MEDIA_TYPES) {
      const result = evaluateRecommendations(observations, friends, medium, others);
      if (result.ratedTitles === 0) continue;
      pooled.push(...result.samples);
      report.push({ user: userId.slice(0, 8), medium, ...summarize(result) });
    }
  }

  const fit = fitLogistic(pooled);
  console.log(
    JSON.stringify(
      {
        method:
          "Five-fold holdout per user and medium. Liked/disliked are ±1 around the user's own mean. Accuracy = share of liked-vs-disliked pairs ranked correctly; 0.5 is chance. v1 runs with its friend signal off.",
        results: report,
        calibration: {
          samples: pooled.length,
          aboveMeanRate:
            pooled.length > 0
              ? Number((pooled.filter((s) => s.above).length / pooled.length).toFixed(3))
              : null,
          fitted: fit,
          brierFitted: fit ? Number(brierScore(pooled, fit)!.toFixed(4)) : null,
          brierCurrentConfig: Number(brierScore(pooled, MATCH_CALIBRATION)!.toFixed(4)),
          brierConstant: Number(
            brierScore(pooled, { intercept: 0, slope: 0 })!.toFixed(4),
          ),
          note: "Paste `fitted` into MATCH_CALIBRATION when it beats the current config on Brier.",
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Evaluation failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
