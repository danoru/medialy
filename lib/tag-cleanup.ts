import type { MediaType } from "@prisma/client";
import {
  canonicalTagDefinitionForName,
  getCanonicalTagDefinitions,
  type CanonicalTagDefinition,
} from "@/lib/taxonomy";

export type CleanupTag = {
  id: string;
  name: string;
  normalizedName: string;
  media: Array<{ mediaId: string }>;
};

export type TagCleanupPlan = {
  canonicalDefinitions: CanonicalTagDefinition[];
  canonicalRows: Array<{
    tagId: string;
    currentName: string;
    definition: CanonicalTagDefinition;
  }>;
  missingCanonicalDefinitions: CanonicalTagDefinition[];
  aliasMerges: Array<{
    sourceTagId: string;
    sourceName: string;
    targetName: string;
    targetNormalizedName: string;
    mediaIds: string[];
  }>;
  nonCanonicalDeletes: Array<{
    tagId: string;
    name: string;
    mediaIds: string[];
  }>;
  summary: {
    totalTags: number;
    canonicalRowsKept: number;
    canonicalRowsCreated: number;
    aliasRowsMerged: number;
    nonCanonicalRowsDeleted: number;
    mediaLinksMoved: number;
    mediaLinksDeleted: number;
    tagRowsDeleted: number;
  };
};

export function buildTagCleanupPlan(
  tags: CleanupTag[],
  canonicalDefinitions = getCanonicalTagDefinitions(),
): TagCleanupPlan {
  const canonicalByNormalizedName = new Map(
    canonicalDefinitions.map((definition) => [
      definition.normalizedName,
      definition,
    ]),
  );
  const existingCanonicalKeys = new Set<string>();
  const canonicalRows: TagCleanupPlan["canonicalRows"] = [];
  const aliasMerges: TagCleanupPlan["aliasMerges"] = [];
  const nonCanonicalDeletes: TagCleanupPlan["nonCanonicalDeletes"] = [];

  for (const tag of tags) {
    const definition =
      canonicalByNormalizedName.get(tag.normalizedName) ??
      canonicalTagDefinitionForName(tag.name);

    if (!definition) {
      nonCanonicalDeletes.push({
        tagId: tag.id,
        name: tag.name,
        mediaIds: tag.media.map((entry) => entry.mediaId),
      });
      continue;
    }

    if (tag.normalizedName === definition.normalizedName) {
      existingCanonicalKeys.add(definition.normalizedName);
      canonicalRows.push({
        tagId: tag.id,
        currentName: tag.name,
        definition,
      });
      continue;
    }

    aliasMerges.push({
      sourceTagId: tag.id,
      sourceName: tag.name,
      targetName: definition.name,
      targetNormalizedName: definition.normalizedName,
      mediaIds: tag.media.map((entry) => entry.mediaId),
    });
  }

  const missingCanonicalDefinitions = canonicalDefinitions.filter(
    (definition) => !existingCanonicalKeys.has(definition.normalizedName),
  );
  const mediaLinksMoved = aliasMerges.reduce(
    (total, merge) => total + merge.mediaIds.length,
    0,
  );
  const mediaLinksDeleted = nonCanonicalDeletes.reduce(
    (total, tag) => total + tag.mediaIds.length,
    0,
  );

  return {
    canonicalDefinitions,
    canonicalRows,
    missingCanonicalDefinitions,
    aliasMerges,
    nonCanonicalDeletes,
    summary: {
      totalTags: tags.length,
      canonicalRowsKept: canonicalRows.length,
      canonicalRowsCreated: missingCanonicalDefinitions.length,
      aliasRowsMerged: aliasMerges.length,
      nonCanonicalRowsDeleted: nonCanonicalDeletes.length,
      mediaLinksMoved,
      mediaLinksDeleted,
      tagRowsDeleted: aliasMerges.length + nonCanonicalDeletes.length,
    },
  };
}

export function canonicalTagUpsertData(definition: CanonicalTagDefinition) {
  return {
    name: definition.name,
    normalizedName: definition.normalizedName,
    status: "APPROVED" as const,
    category: definition.category,
    discoverable: definition.discoverable,
    mediaTypesJson: definition.mediaTypes
      ? JSON.stringify(definition.mediaTypes satisfies MediaType[])
      : null,
    countryCode: definition.countryCode ?? null,
    approvedAt: new Date(),
  };
}
