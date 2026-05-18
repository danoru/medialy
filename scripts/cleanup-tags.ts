import { prisma } from "@/lib/prisma";
import {
  buildTagCleanupPlan,
  canonicalTagUpsertData,
  type CleanupTag,
  type TagCleanupPlan,
} from "@/lib/tag-cleanup";
import { getCanonicalTagDefinitions } from "@/lib/taxonomy";

const apply = process.argv.includes("--apply");

async function main() {
  const canonicalDefinitions = getCanonicalTagDefinitions();

  if (!apply) {
    const tags = await fetchTags();
    const plan = buildTagCleanupPlan(tags, canonicalDefinitions);
    printPlan(plan, "DRY RUN");
    console.log("");
    console.log("Run `pnpm.cmd run tags:cleanup` to apply this cleanup.");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    for (const definition of canonicalDefinitions) {
      const data = canonicalTagUpsertData(definition);
      await tx.tag.upsert({
        where: { normalizedName: definition.normalizedName },
        update: data,
        create: data,
      });
    }

    const tags = await tx.tag.findMany({
      include: { media: { select: { mediaId: true } } },
      orderBy: { name: "asc" },
    });
    const plan = buildTagCleanupPlan(tags, canonicalDefinitions);
    const canonicalRowsByNormalizedName = new Map(
      plan.canonicalRows.map((row) => [
        row.definition.normalizedName,
        row.tagId,
      ]),
    );

    for (const merge of plan.aliasMerges) {
      const targetTagId = canonicalRowsByNormalizedName.get(
        merge.targetNormalizedName,
      );
      if (!targetTagId || merge.mediaIds.length === 0) continue;

      await tx.mediaTag.createMany({
        data: merge.mediaIds.map((mediaId) => ({ mediaId, tagId: targetTagId })),
        skipDuplicates: true,
      });
    }

    const tagIdsToDelete = [
      ...plan.aliasMerges.map((merge) => merge.sourceTagId),
      ...plan.nonCanonicalDeletes.map((tag) => tag.tagId),
    ];

    if (tagIdsToDelete.length > 0) {
      await tx.mediaTag.deleteMany({
        where: { tagId: { in: tagIdsToDelete } },
      });
      await tx.tag.deleteMany({ where: { id: { in: tagIdsToDelete } } });
    }

    return plan;
  });

  printPlan(result, "APPLIED");
}

async function fetchTags(): Promise<CleanupTag[]> {
  return prisma.tag.findMany({
    include: { media: { select: { mediaId: true } } },
    orderBy: { name: "asc" },
  });
}

function printPlan(plan: TagCleanupPlan, label: string) {
  console.log(`Canonical tag cleanup ${label}`);
  console.log(JSON.stringify(plan.summary, null, 2));

  if (plan.aliasMerges.length > 0) {
    console.log("");
    console.log("Alias rows to merge:");
    console.table(
      plan.aliasMerges.slice(0, 25).map((merge) => ({
        source: merge.sourceName,
        target: merge.targetName,
        mediaLinks: merge.mediaIds.length,
      })),
    );
    if (plan.aliasMerges.length > 25) {
      console.log(`...and ${plan.aliasMerges.length - 25} more alias rows.`);
    }
  }

  if (plan.nonCanonicalDeletes.length > 0) {
    console.log("");
    console.log("Non-canonical rows to delete:");
    console.table(
      plan.nonCanonicalDeletes.slice(0, 25).map((tag) => ({
        name: tag.name,
        mediaLinks: tag.mediaIds.length,
      })),
    );
    if (plan.nonCanonicalDeletes.length > 25) {
      console.log(
        `...and ${plan.nonCanonicalDeletes.length - 25} more non-canonical rows.`,
      );
    }
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
