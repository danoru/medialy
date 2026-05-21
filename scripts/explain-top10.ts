/**
 * Debug script: side-by-side compare the OLD naive-average and the NEW
 * Bayesian-shrunk ranking for Overall Top 10 candidates.
 *
 *   pnpm tsx scripts/explain-top10.ts [mediaType] [limit]
 *
 * Defaults: mediaType=MOVIE, limit=20.
 */
import { prisma } from "@/lib/prisma";
import {
  dashboardQualityScore,
  type CommunityRatingEvidence,
  type ConsensusEvidence,
} from "@/lib/db/dashboard";
import { TOP_RANKING } from "@/lib/scoring/config";
import type { MediaType } from "@prisma/client";

function naiveAverage(
  consensus: number | null,
  community: number | null,
): number | null {
  const parts = [consensus, community].filter(
    (v): v is number => typeof v === "number",
  );
  if (parts.length === 0) return null;
  return parts.reduce((sum, v) => sum + v, 0) / parts.length;
}

async function main() {
  const mediaType = (process.argv[2] ?? "MOVIE") as MediaType;
  const limit = Number(process.argv[3] ?? 20);

  const [items, communityRows, sourceRows, globalCommunityAgg, globalConsensusAgg] =
    await Promise.all([
      prisma.mediaItem.findMany({
        where: { mediaType },
        select: { id: true, title: true, computedConsensusScore: true },
      }),
      prisma.userMedia.groupBy({
        by: ["mediaId"],
        where: { isArchived: false, personalRating: { not: null } },
        _avg: { personalRating: true },
        _count: { personalRating: true },
      }),
      prisma.externalRating.groupBy({
        by: ["mediaId"],
        _count: { _all: true },
      }),
      prisma.userMedia.aggregate({
        where: { isArchived: false, personalRating: { not: null } },
        _avg: { personalRating: true },
      }),
      prisma.mediaItem.aggregate({
        where: { computedConsensusScore: { not: null } },
        _avg: { computedConsensusScore: true },
      }),
    ]);

  const communityByMediaId = new Map<string, CommunityRatingEvidence>();
  for (const row of communityRows) {
    if (row._avg.personalRating != null) {
      communityByMediaId.set(row.mediaId, {
        average: row._avg.personalRating,
        voters: row._count.personalRating,
      });
    }
  }
  const consensusByMediaId = new Map<string, ConsensusEvidence>();
  for (const row of sourceRows) {
    consensusByMediaId.set(row.mediaId, { sources: row._count._all });
  }
  const globalCommunityMean =
    globalCommunityAgg._avg.personalRating ?? TOP_RANKING.fallbackPrior;
  const globalConsensusMean =
    globalConsensusAgg._avg.computedConsensusScore ?? TOP_RANKING.fallbackPrior;

  console.log(`\n${mediaType} — Top ${limit} by shrunk score vs. naive average`);
  console.log(
    `Priors: community=${globalCommunityMean.toFixed(2)}, consensus=${globalConsensusMean.toFixed(2)}`,
  );
  console.log(
    `Shrinkage k: user=${TOP_RANKING.shrinkageK.user}, source=${TOP_RANKING.shrinkageK.source}\n`,
  );

  const rows = items.flatMap((item) => {
    const community = communityByMediaId.get(item.id);
    const consensus = consensusByMediaId.get(item.id);
    const ranked = dashboardQualityScore(
      item.computedConsensusScore,
      community,
      consensus,
      globalCommunityMean,
      globalConsensusMean,
    );
    if (ranked == null) return [];
    const naive = naiveAverage(
      item.computedConsensusScore,
      community?.average ?? null,
    );
    return [
      {
        title: item.title,
        consensus: item.computedConsensusScore,
        community: community?.average ?? null,
        voters: community?.voters ?? 0,
        sources: consensus?.sources ?? 0,
        shrunkScore: ranked.score,
        naiveScore: naive,
      },
    ];
  });

  const shrunkTop = [...rows]
    .sort((a, b) => b.shrunkScore - a.shrunkScore)
    .slice(0, limit);

  console.log(
    "Rank | Title                                | Naive | Shrunk | Δ      | Cons (n) | Comm (n)",
  );
  console.log("".padEnd(110, "-"));
  for (const [index, row] of shrunkTop.entries()) {
    const delta = row.naiveScore != null ? row.shrunkScore - row.naiveScore : 0;
    const sign = delta >= 0 ? "+" : "";
    console.log(
      `${String(index + 1).padStart(4)} | ${row.title.padEnd(36).slice(0, 36)} | ${(row.naiveScore ?? 0).toFixed(2).padStart(5)} | ${row.shrunkScore.toFixed(2).padStart(5)} | ${(sign + delta.toFixed(2)).padStart(6)} | ${(row.consensus ?? 0).toFixed(2)} (${String(row.sources).padStart(2)}) | ${(row.community ?? 0).toFixed(2)} (${String(row.voters).padStart(2)})`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
