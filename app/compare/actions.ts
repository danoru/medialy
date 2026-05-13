"use server";

import { revalidatePath } from "next/cache";
import { isComparisonEligibleStatus } from "@/lib/compare";
import { applyEloResult } from "@/lib/scoring";
import { prisma } from "@/lib/prisma";

export async function saveComparison(formData: FormData) {
  const winnerId = String(formData.get("winnerId") ?? "");
  const loserId = String(formData.get("loserId") ?? "");
  const context = String(formData.get("context") ?? "OVERALL") as "OVERALL";
  const notes = String(formData.get("notes") ?? "").trim();
  if (!winnerId || !loserId || winnerId === loserId) return;

  await prisma.$transaction(async (tx) => {
    const [winner, loser] = await Promise.all([
      tx.mediaItem.findUniqueOrThrow({ where: { id: winnerId } }),
      tx.mediaItem.findUniqueOrThrow({ where: { id: loserId } }),
    ]);
    if (
      winner.isArchived ||
      loser.isArchived ||
      !isComparisonEligibleStatus(winner.status) ||
      !isComparisonEligibleStatus(loser.status) ||
      winner.mediaType !== loser.mediaType
    ) {
      throw new Error(
        "Comparisons must use two active, eligible items from the same media type.",
      );
    }
    const updated = applyEloResult({
      winnerScore: winner.pairwiseScore,
      loserScore: loser.pairwiseScore,
      winnerComparisonCount: winner.comparisonCount,
      loserComparisonCount: loser.comparisonCount,
    });

    await tx.pairwiseComparison.create({
      data: { winnerId, loserId, context, notes: notes || null },
    });
    await tx.mediaItem.update({
      where: { id: winnerId },
      data: {
        pairwiseScore: updated.winnerScore,
        comparisonCount: { increment: 1 },
      },
    });
    await tx.mediaItem.update({
      where: { id: loserId },
      data: {
        pairwiseScore: updated.loserScore,
        comparisonCount: { increment: 1 },
      },
    });
  });

  revalidatePath("/compare");
  revalidatePath("/media");
  revalidatePath("/dashboard");
}
