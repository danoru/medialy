import { describe, expect, it } from "vitest";
import type { CatalogItemWithUser } from "@/lib/db/catalog";
import type { OverallTopRankingContext } from "@/lib/db/dashboard";
import { DEFAULT_USER_MEDIA } from "@/lib/db/user-media";
import {
  buildDiscoverPool,
  buildSections,
  buildWorlds,
  itemSimilarity,
  pickHiddenGems,
  pickSeeds,
  scoreDiscoverItems,
  viewerMeanScore,
  type DiscoverItem,
} from "./discover";

type Spec = {
  id: string;
  consensus?: number | null;
  consensusConfidence?: number;
  sources?: number;
  average?: number;
  voters?: number;
  genres?: string[];
  subgenres?: string[];
  tags?: string[];
  credits?: string[];
  status?: CatalogItemWithUser["status"];
  personalRating?: number | null;
  releaseDate?: Date | null;
};

const tag = (name: string, category: "SUBGENRE" | "THEME") => ({
  tag: {
    name,
    status: "APPROVED" as const,
    category,
    discoverable: true,
    mediaTypesJson: null,
    countryCode: null,
  },
});

function catalogItem(spec: Spec): CatalogItemWithUser {
  return {
    ...DEFAULT_USER_MEDIA,
    id: spec.id,
    title: spec.id,
    originalTitle: null,
    mediaType: "MOVIE",
    releaseDate: spec.releaseDate ?? new Date("2020-01-01"),
    posterUrl: null,
    externalUrl: null,
    computedConsensusScore: spec.consensus === undefined ? 7 : spec.consensus,
    consensusConfidence: spec.consensusConfidence ?? 0.8,
    updatedAt: new Date("2026-01-01"),
    genres: (spec.genres ?? ["Horror"]).map((name) => ({ genre: { name } })),
    tags: [
      ...(spec.subgenres ?? []).map((name) => tag(name, "SUBGENRE")),
      ...(spec.tags ?? []).map((name) => tag(name, "THEME")),
    ],
    credits: (spec.credits ?? []).map((id, order) => ({
      role: "DIRECTOR" as const,
      order,
      contributor: { id, name: id, kind: "PERSON" as const },
    })),
    status: spec.status ?? "UNTRACKED",
    personalRating: spec.personalRating ?? null,
    computedPersonalScore: spec.personalRating ?? null,
  };
}

function context(specs: Spec[]): OverallTopRankingContext {
  return {
    communityByMediaId: new Map(
      specs
        .filter((spec) => (spec.voters ?? 0) > 0)
        .map((spec) => [
          spec.id,
          { average: spec.average ?? 7, voters: spec.voters ?? 0 },
        ]),
    ),
    consensusByMediaId: new Map(
      specs
        .filter((spec) => (spec.sources ?? 0) > 0)
        .map((spec) => [spec.id, { sources: spec.sources ?? 0 }]),
    ),
    globalCommunityMean: 7,
    globalConsensusMean: 7,
  };
}

function score(specs: Spec[]): DiscoverItem[] {
  return scoreDiscoverItems(specs.map(catalogItem), context(specs));
}

/**
 * A horror world: a handful of widely seen classics, a middle, and some
 * well-liked titles almost nobody has weighed in on.
 */
function horrorWorld(): Spec[] {
  const specs: Spec[] = [];
  for (let i = 0; i < 8; i += 1) {
    specs.push({
      id: `classic-${i}`,
      consensus: 9 - i * 0.1,
      average: 9 - i * 0.1,
      voters: 30 - i,
      sources: 6,
      subgenres: ["Slasher", "Folk Horror"],
      credits: [`director-${i}`],
    });
  }
  for (let i = 0; i < 10; i += 1) {
    specs.push({
      id: `middle-${i}`,
      consensus: 7.5 - i * 0.1,
      average: 7.5 - i * 0.1,
      voters: 10,
      sources: 4,
      subgenres: i % 2 ? ["Slasher"] : ["Body Horror"],
    });
  }
  for (let i = 0; i < 6; i += 1) {
    specs.push({
      id: `gem-${i}`,
      consensus: 8.6 - i * 0.05,
      consensusConfidence: 0.4,
      sources: 1,
      subgenres: ["Found Footage"],
      credits: [`director-${i}`],
    });
  }
  for (let i = 0; i < 6; i += 1) {
    specs.push({
      id: `filler-${i}`,
      consensus: 5.5,
      voters: 3,
      sources: 2,
    });
  }
  return specs;
}

function sections(specs: Spec[], viewerId: string | null = null) {
  const scored = score(specs);
  const pool = buildDiscoverPool(scored, { viewerId });
  return buildSections({
    worldItems: scored,
    pool,
    mediaType: "MOVIE",
    genre: "Horror",
    viewerMean: viewerMeanScore(scored),
  });
}

describe("discover scoring", () => {
  it("drops titles with no community rating and no consensus", () => {
    const scored = score([
      { id: "known", consensus: 8, sources: 2 },
      { id: "unknown", consensus: null, sources: 0, voters: 0 },
    ]);
    expect(scored.map((item) => item.id)).toEqual(["known"]);
  });

  it("measures reach as raters plus sources", () => {
    const [item] = score([{ id: "a", voters: 4, sources: 3 }]);
    expect(item.reach).toBe(7);
  });
});

describe("discover pool", () => {
  const specs: Spec[] = [
    { id: "finished", status: "COMPLETED", sources: 2 },
    { id: "dropped", status: "DROPPED", sources: 2 },
    { id: "never", status: "NOT_INTERESTED", sources: 2 },
    { id: "queued", status: "WATCHLIST", sources: 2 },
    { id: "fresh", sources: 2 },
    { id: "upcoming", sources: 2, releaseDate: new Date("2099-01-01") },
  ];

  it("hides finished, dropped and not-interested titles from a signed-in viewer", () => {
    const pool = buildDiscoverPool(score(specs), { viewerId: "me" });
    expect(pool.map((item) => item.id).sort()).toEqual(["fresh", "queued"]);
  });

  it("hides nothing but unreleased titles from an anonymous viewer", () => {
    const pool = buildDiscoverPool(score(specs), { viewerId: null });
    expect(pool.map((item) => item.id).sort()).toEqual(
      ["dropped", "finished", "fresh", "never", "queued"],
    );
  });
});

describe("discover sections", () => {
  it("never shows the same title in two sections", () => {
    const result = sections(horrorWorld());
    const lists = [
      result.essentials,
      result.gateway,
      result.hiddenGems,
      result.ifYouLiked.map((chain) => chain.next),
    ];
    const ids = lists.flat().map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const list of lists) expect(list.length).toBeGreaterThan(0);
  });

  it("ranks essentials by global quality, not the viewer's own scores", () => {
    const specs = horrorWorld();
    specs.find((spec) => spec.id === "filler-0")!.personalRating = 10;
    const result = sections(specs, "me");
    const qualities = result.essentials.map((item) => item.quality);
    expect(qualities).toEqual([...qualities].sort((a, b) => b - a));
    expect(result.essentials.map((item) => item.id)).not.toContain("filler-0");
  });

  it("picks gateway titles that are widely seen and mainstream", () => {
    const result = sections(horrorWorld());
    expect(result.gateway).toHaveLength(4);
    for (const item of result.gateway) {
      expect(item.id.startsWith("classic-")).toBe(true);
    }
  });

  it("keeps the shelves distinct even when quality order alone would merge them", () => {
    const result = sections(horrorWorld());
    const essentialIds = new Set(result.essentials.map((item) => item.id));
    for (const item of result.gateway) {
      expect(essentialIds.has(item.id)).toBe(false);
    }
    for (const item of result.hiddenGems) {
      expect(essentialIds.has(item.id)).toBe(false);
    }
    // Essentials draws from the widely seen part of the pool.
    for (const item of result.essentials) {
      expect(item.reach).toBeGreaterThanOrEqual(10);
    }
  });

  it("picks hidden gems from the well-liked but rarely seen titles", () => {
    const result = sections(horrorWorld());
    const ids = result.hiddenGems.map((item) => item.id);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id.startsWith("gem-")).toBe(true);
  });

  it("never treats the most-seen title as a hidden gem", () => {
    const scored = score(horrorWorld());
    const gems = pickHiddenGems(scored, new Set());
    const mostSeen = [...scored].sort((a, b) => b.reach - a.reach)[0];
    expect(gems.map((item) => item.id)).not.toContain(mostSeen.id);
  });

  it("pairs each seed with a similar unseen title and names what they share", () => {
    const result = sections(horrorWorld());
    const seedIds = new Set(result.ifYouLiked.map((chain) => chain.seed.id));
    for (const chain of result.ifYouLiked) {
      expect(seedIds.has(chain.next.id)).toBe(false);
      expect(itemSimilarity(chain.seed, chain.next)).toBeGreaterThanOrEqual(0.25);
      expect(chain.sharedFacet).not.toBeNull();
    }
  });

  it("seeds chains from the viewer's own favorites when they have them", () => {
    const specs = horrorWorld();
    for (const id of ["gem-0", "gem-1", "middle-3"]) {
      const spec = specs.find((entry) => entry.id === id)!;
      spec.status = "COMPLETED";
      spec.personalRating = 9;
    }
    specs.find((entry) => entry.id === "filler-1")!.personalRating = 4;
    const result = sections(specs, "me");
    const seeds = result.ifYouLiked.map((chain) => chain.seed.id).sort();
    expect(seeds).toEqual(["gem-0", "gem-1", "middle-3"]);
    // A finished title is a seed, never a partner.
    for (const chain of result.ifYouLiked) {
      expect(["gem-0", "gem-1", "middle-3"]).not.toContain(chain.next.id);
    }
  });

  it("falls back to the essentials as seeds for anonymous viewers", () => {
    const scored = score(horrorWorld());
    const essentials = scored.slice(0, 4);
    expect(pickSeeds(scored, essentials, null)).toEqual(essentials);
    expect(pickSeeds(scored, essentials, 7)).toEqual(essentials);
  });
});

describe("discover worlds", () => {
  it("orders worlds by quality and promotes discover tags to worlds", () => {
    const scored = score([
      { id: "a", genres: ["Drama"], consensus: 9, sources: 3 },
      { id: "b", genres: ["Drama"], consensus: 9, sources: 3 },
      { id: "c", genres: ["Comedy"], consensus: 6, sources: 3 },
      { id: "d", genres: ["Comedy"], tags: ["Animation"], consensus: 6, sources: 3 },
    ]);
    const worlds = buildWorlds(scored, "MOVIE");
    expect(worlds[0].name).toBe("Drama");
    const animation = worlds.find((world) => world.name === "Animation");
    expect(animation?.items.map((item) => item.id)).toEqual(["d"]);
  });

  it("does not let a tiny world with one great title outrank a large strong world", () => {
    const specs: Spec[] = [{ id: "solo", genres: ["Musical"], consensus: 9.5, sources: 3 }];
    for (let i = 0; i < 30; i += 1) {
      specs.push({ id: `drama-${i}`, genres: ["Drama"], consensus: 8, sources: 3 });
    }
    for (let i = 0; i < 6; i += 1) {
      specs.push({ id: `filler-${i}`, genres: ["Comedy"], consensus: 5, sources: 3 });
    }
    const worlds = buildWorlds(score(specs), "MOVIE");
    expect(worlds.map((world) => world.name)).toEqual(["Drama", "Musical", "Comedy"]);
  });
});
