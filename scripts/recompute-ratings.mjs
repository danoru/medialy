import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const sourceTrustWeights = { METACRITIC: 1 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeScoreForUi(score, min = 850, max = 1350) {
  return clamp(((score - min) / (max - min)) * 100, 0, 100);
}

function calculatePairwiseConfidence(comparisonCount) {
  if (comparisonCount <= 0) return 0.2;
  if (comparisonCount < 3) return 0.45;
  if (comparisonCount < 8) return 0.7;
  return 1;
}

function calculatePersonalScore(item) {
  const pairwiseRating = normalizeScoreForUi(item.pairwiseScore) / 10;
  const pairwiseConfidence = calculatePairwiseConfidence(item.comparisonCount);
  if (item.personalRating == null) {
    return {
      score: Math.round(pairwiseRating * 10) / 10,
      confidence: Math.round(pairwiseConfidence * 0.6 * 100) / 100,
    };
  }

  const relationalWeight = 0.3 * pairwiseConfidence;
  const explicitWeight = 1 - relationalWeight;
  return {
    score:
      Math.round(
        clamp(
          item.personalRating * explicitWeight +
            pairwiseRating * relationalWeight,
          0,
          10,
        ) * 10,
      ) / 10,
    confidence: Math.round(Math.max(0.55, pairwiseConfidence) * 100) / 100,
  };
}

function calculateConsensusScore(ratings) {
  const weighted = ratings
    .map((entry) => {
      if (entry.scale <= 0) return null;
      return {
        normalized: clamp((entry.score / entry.scale) * 10, 0, 10),
        weight: sourceTrustWeights[entry.source] ?? 0.5,
      };
    })
    .filter(Boolean);
  if (weighted.length === 0) return { score: null, confidence: 0 };

  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const score =
    weighted.reduce((sum, entry) => sum + entry.normalized * entry.weight, 0) /
    totalWeight;
  const variance =
    weighted.reduce(
      (sum, entry) => sum + Math.abs(entry.normalized - score),
      0,
    ) / weighted.length;
  const sourceConfidence = clamp(totalWeight / 3, 0.25, 1);
  const agreementConfidence = clamp(1 - variance / 5, 0.3, 1);
  return {
    score: Math.round(score * 10) / 10,
    confidence: Math.round(sourceConfidence * agreementConfidence * 100) / 100,
  };
}

async function main() {
  const items = await prisma.mediaItem.findMany({
    include: { externalRatings: true },
    orderBy: { title: "asc" },
  });

  for (const item of items) {
    const personal = calculatePersonalScore(item);
    const consensus = calculateConsensusScore(item.externalRatings);
    if (!dryRun) {
      await prisma.mediaItem.update({
        where: { id: item.id },
        data: {
          computedPersonalScore: personal.score,
          personalScoreConfidence: personal.confidence,
          computedConsensusScore: consensus.score,
          consensusConfidence: consensus.confidence,
        },
      });
    }
    console.log(
      JSON.stringify({
        dryRun,
        title: item.title,
        personalScore: personal.score,
        personalScoreConfidence: personal.confidence,
        consensusScore: consensus.score,
        consensusConfidence: consensus.confidence,
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
