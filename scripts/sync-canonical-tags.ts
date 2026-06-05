/**
 * Non-destructive canonical tag sync.
 *
 * Unlike `scripts/cleanup-tags.ts`, this never deletes non-canonical tags
 * (e.g. THEME tags the taxonomy doesn't model yet). It only:
 *   1. upserts canonical metadata onto existing rows (fixes drifted
 *      `discoverable`, category, mediaTypes — e.g. Indie -> FORMAT,
 *      Card Battler -> SUBGENRE) and creates any missing canonical rows, and
 *   2. applies alias merges (moves media links to the canonical row, deletes
 *      the alias source) — e.g. "Found Footage Horror" -> "Found Footage".
 *
 * Run with `--apply` to write; omit for a dry run.
 */
import { prisma } from "@/lib/prisma";
import { buildTagCleanupPlan, canonicalTagUpsertData } from "@/lib/tag-cleanup";
import { getCanonicalTagDefinitions } from "@/lib/taxonomy";

const apply = process.argv.includes("--apply");

async function main() {
  const canonicalDefinitions = getCanonicalTagDefinitions();

  if (!apply) {
    const tags = await prisma.tag.findMany({
      include: { media: { select: { mediaId: true } } },
      orderBy: { name: "asc" },
    });
    const plan = buildTagCleanupPlan(tags, canonicalDefinitions);
    console.log("Canonical tag sync DRY RUN");
    console.log(
      JSON.stringify(
        {
          canonicalUpserts: canonicalDefinitions.length,
          aliasMerges: plan.aliasMerges.map((m) => ({
            from: m.sourceName,
            to: m.targetName,
            links: m.mediaIds.length,
          })),
          preserved: plan.nonCanonicalDeletes.map((t) => t.name),
        },
        null,
        2,
      ),
    );
    console.log("\nRun with --apply to write.");
    return;
  }

  const summary = await prisma.$transaction(
    async (tx) => {
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
      plan.canonicalRows.map((row) => [row.definition.normalizedName, row.tagId]),
    );

    let linksMoved = 0;
    for (const merge of plan.aliasMerges) {
      const targetTagId = canonicalRowsByNormalizedName.get(
        merge.targetNormalizedName,
      );
      if (!targetTagId || merge.mediaIds.length === 0) continue;
      const created = await tx.mediaTag.createMany({
        data: merge.mediaIds.map((mediaId) => ({ mediaId, tagId: targetTagId })),
        skipDuplicates: true,
      });
      linksMoved += created.count;
    }

    const aliasSourceIds = plan.aliasMerges.map((m) => m.sourceTagId);
    if (aliasSourceIds.length > 0) {
      await tx.mediaTag.deleteMany({ where: { tagId: { in: aliasSourceIds } } });
      await tx.tag.deleteMany({ where: { id: { in: aliasSourceIds } } });
    }

    return {
      canonicalUpserted: canonicalDefinitions.length,
      aliasRowsMerged: aliasSourceIds.length,
      linksMoved,
      nonCanonicalPreserved: plan.nonCanonicalDeletes.length,
    };
    },
    { maxWait: 15000, timeout: 120000 },
  );

  console.log("Canonical tag sync APPLIED");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
