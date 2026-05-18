import { describe, expect, it } from "vitest";
import {
  buildTagCleanupPlan,
  canonicalTagUpsertData,
  type CleanupTag,
} from "@/lib/tag-cleanup";

describe("tag cleanup planning", () => {
  it("keeps canonical rows and reports missing canonical rows", () => {
    const plan = buildTagCleanupPlan([
      tag("tag-action-rpg", "Action RPG", "actionrpg", ["media-1"]),
    ]);

    expect(plan.canonicalRows).toEqual([
      expect.objectContaining({
        tagId: "tag-action-rpg",
        currentName: "Action RPG",
        definition: expect.objectContaining({ name: "Action RPG" }),
      }),
    ]);
    expect(plan.nonCanonicalDeletes).not.toContainEqual(
      expect.objectContaining({ tagId: "tag-action-rpg" }),
    );
    expect(plan.summary.canonicalRowsCreated).toBeGreaterThan(0);
  });

  it("moves alias links to the canonical target before deleting alias rows", () => {
    const plan = buildTagCleanupPlan([
      tag("tag-japanese", "Japanese", "japanese", ["media-1", "media-2"]),
      tag("tag-japan", "Japan", "japan", ["media-3"]),
    ]);

    expect(plan.aliasMerges).toEqual([
      {
        sourceTagId: "tag-japanese",
        sourceName: "Japanese",
        targetName: "Japan",
        targetNormalizedName: "japan",
        mediaIds: ["media-1", "media-2"],
      },
    ]);
    expect(plan.summary.mediaLinksMoved).toBe(2);
    expect(plan.summary.tagRowsDeleted).toBe(1);
  });

  it("deletes non-canonical rows and their media links", () => {
    const plan = buildTagCleanupPlan([
      tag("tag-random", "Space Buddy Comedy", "spacebuddycomedy", [
        "media-1",
      ]),
    ]);

    expect(plan.nonCanonicalDeletes).toEqual([
      {
        tagId: "tag-random",
        name: "Space Buddy Comedy",
        mediaIds: ["media-1"],
      },
    ]);
    expect(plan.summary.mediaLinksDeleted).toBe(1);
    expect(plan.summary.tagRowsDeleted).toBe(1);
  });

  it("builds canonical upsert data from the allowlist", () => {
    const plan = buildTagCleanupPlan([]);
    const anime = plan.canonicalDefinitions.find(
      (definition) => definition.name === "Anime",
    );

    expect(anime).toBeDefined();
    expect(canonicalTagUpsertData(anime!)).toMatchObject({
      name: "Anime",
      normalizedName: "anime",
      status: "APPROVED",
      category: "SUBGENRE",
      discoverable: true,
      mediaTypesJson: '["MOVIE","TV_SHOW"]',
      countryCode: null,
    });
  });
});

function tag(
  id: string,
  name: string,
  normalizedName: string,
  mediaIds: string[] = [],
): CleanupTag {
  return {
    id,
    name,
    normalizedName,
    media: mediaIds.map((mediaId) => ({ mediaId })),
  };
}
