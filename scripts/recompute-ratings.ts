import { calculateConsensusScore } from "@/lib/scoring/consensus";
import { calculatePersonalScore } from "@/lib/scoring/personalScore";
import {
  recomputeConsensusScore,
  recomputePersonalScore,
} from "@/lib/scoring/recompute";
import { prisma } from "@/lib/prisma";

/**
 * Recompute denormalized scores from the canonical scoring logic in
 * `lib/scoring/`. Run after changing any scoring tunable (e.g. `PAIRWISE.uiRange`).
 *
 *  - Personal / pairwise scores live per-user on `UserMedia` → recompute each row.
 *  - Consensus lives on `MediaItem` → recompute each item.
 *
 * `--dry-run` reports old → new values without writing.
 */

const dryRun = process.argv.includes("--dry-run");

const round = (value: number | null | undefined) =>
  value == null ? null : Math.round(value * 100) / 100;

async function main() {
  // --- Personal / pairwise (per-user) -------------------------------------
  const userMedia = await prisma.userMedia.findMany({
    select: {
      userId: true,
      mediaId: true,
      personalRating: true,
      pairwiseScore: true,
      comparisonCount: true,
      computedPersonalScore: true,
      media: { select: { title: true } },
    },
  });

  for (const um of userMedia) {
    const after = dryRun
      ? calculatePersonalScore({
          explicitRating: um.personalRating,
          pairwiseScore: um.pairwiseScore,
          comparisonCount: um.comparisonCount,
        }).score
      : (await recomputePersonalScore(um.mediaId, um.userId))?.score ?? null;

    console.log(
      JSON.stringify({
        dryRun,
        kind: "personal",
        title: um.media.title,
        userId: um.userId,
        before: round(um.computedPersonalScore),
        after: round(after),
      }),
    );
  }

  // --- Consensus (per-item) -----------------------------------------------
  const items = await prisma.mediaItem.findMany({
    select: {
      id: true,
      title: true,
      mediaType: true,
      computedConsensusScore: true,
      externalRatings: {
        select: { source: true, score: true, scale: true, fetchedAt: true },
      },
    },
    orderBy: { title: "asc" },
  });

  for (const item of items) {
    const after = dryRun
      ? calculateConsensusScore(item.externalRatings, {
          mediaType: item.mediaType,
        }).score
      : (await recomputeConsensusScore(item.id)).score;

    console.log(
      JSON.stringify({
        dryRun,
        kind: "consensus",
        title: item.title,
        before: round(item.computedConsensusScore),
        after: round(after),
      }),
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
