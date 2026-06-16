import { describe, expect, it } from "vitest";
import {
  buildGenreShelves,
  compareCanonItems,
  itemsForGenre,
  rankCanonItems,
  subgenreOptions,
  toCanonCandidate,
  type CanonCandidate,
  type CanonItem,
} from "@/lib/db/canon";
import type {
  CommunityRatingEvidence,
  ConsensusEvidence,
  OverallTopRankingContext,
} from "@/lib/db/dashboard";

function candidate(
  id: string,
  overrides: Partial<CanonCandidate> = {},
): CanonCandidate {
  return {
    id,
    title: id,
    mediaType: "MOVIE",
    posterUrl: null,
    year: 2000,
    genres: [],
    subgenres: [],
    leadCredit: null,
    computedConsensusScore: null,
    ...overrides,
  };
}

function rankingContext(
  community: Record<string, CommunityRatingEvidence> = {},
  consensus: Record<string, ConsensusEvidence> = {},
  globals: { community?: number; consensus?: number } = {},
): OverallTopRankingContext {
  return {
    communityByMediaId: new Map(Object.entries(community)),
    consensusByMediaId: new Map(Object.entries(consensus)),
    globalCommunityMean: globals.community ?? 7,
    globalConsensusMean: globals.consensus ?? 7,
  };
}

function item(id: string, overrides: Partial<CanonItem> = {}): CanonItem {
  return {
    id,
    title: id,
    mediaType: "MOVIE",
    posterUrl: null,
    year: 2000,
    genres: [],
    subgenres: [],
    leadCredit: null,
    score: 8,
    evidence: 5,
    ...overrides,
  };
}

describe("rankCanonItems", () => {
  it("drops items with no objective signal and sorts by quality desc", () => {
    const ranked = rankCanonItems(
      [
        candidate("no-signal"),
        candidate("low", { computedConsensusScore: 6 }),
        candidate("high", { computedConsensusScore: 9 }),
      ],
      rankingContext({}, { low: { sources: 5 }, high: { sources: 5 } }),
    );

    expect(ranked.map((entry) => entry.id)).toEqual(["high", "low"]);
  });

  it("breaks score ties on evidence, then title (compareCanonItems)", () => {
    const a = item("Zed", { score: 8, evidence: 2 });
    const b = item("Ada", { score: 8, evidence: 9 });
    const c = item("Abe", { score: 8, evidence: 2 });

    const sorted = [a, b, c].sort(compareCanonItems);
    expect(sorted.map((entry) => entry.id)).toEqual(["Ada", "Abe", "Zed"]);
  });
});

describe("buildGenreShelves", () => {
  const ranked = [
    item("a", { genres: ["Crime", "Drama"], score: 9 }),
    item("b", { genres: ["Crime"], score: 8 }),
    item("c", { genres: ["Crime"], score: 7 }),
    item("d", { genres: ["Drama"], score: 6 }),
  ];

  it("skips genres below the minimum and caps shelf size", () => {
    const shelves = buildGenreShelves(ranked, { shelfSize: 2, minItems: 3 });

    // Crime has 3 items (>= min); Drama has 2 (< min) -> dropped.
    expect(shelves.map((shelf) => shelf.genre)).toEqual(["Crime"]);
    const crime = shelves[0];
    expect(crime.total).toBe(3);
    expect(crime.items.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("orders shelves by total desc, then genre name", () => {
    const shelves = buildGenreShelves(ranked, { shelfSize: 10, minItems: 1 });
    expect(shelves.map((shelf) => `${shelf.genre}:${shelf.total}`)).toEqual([
      "Crime:3",
      "Drama:2",
    ]);
  });
});

describe("itemsForGenre", () => {
  const ranked = [
    item("noir", { genres: ["Crime"], subgenres: ["Noir"] }),
    item("heist", { genres: ["Crime"], subgenres: ["Heist"] }),
    item("scifi", { genres: ["Sci-Fi"], subgenres: ["Cyberpunk"] }),
  ];

  it("filters to the genre", () => {
    expect(itemsForGenre(ranked, "Crime").map((entry) => entry.id)).toEqual([
      "noir",
      "heist",
    ]);
  });

  it("narrows to a subgenre when provided", () => {
    expect(
      itemsForGenre(ranked, "Crime", "Noir").map((entry) => entry.id),
    ).toEqual(["noir"]);
  });
});

describe("toCanonCandidate", () => {
  it("derives genres, drops non-discoverable/unapproved subgenre tags", () => {
    const candidateRow = toCanonCandidate(
      {
        id: "x",
        title: "X",
        mediaType: "MOVIE",
        posterUrl: null,
        releaseDate: new Date("1999-03-31T00:00:00"),
        computedConsensusScore: 9,
        genres: [{ genre: { name: "Sci-Fi" } }],
        tags: [
          {
            tag: {
              name: "Cyberpunk",
              status: "APPROVED",
              category: "SUBGENRE",
              discoverable: true,
              mediaTypesJson: null,
            },
          },
          {
            tag: {
              name: "Pending Sub",
              status: "PENDING",
              category: "SUBGENRE",
              discoverable: true,
              mediaTypesJson: null,
            },
          },
          {
            tag: {
              name: "Hidden Sub",
              status: "APPROVED",
              category: "SUBGENRE",
              discoverable: false,
              mediaTypesJson: null,
            },
          },
        ],
      },
      "MOVIE",
    );

    expect(candidateRow.year).toBe(1999);
    expect(candidateRow.genres).toContain("Sci-Fi");
    expect(candidateRow.subgenres).toEqual(["Cyberpunk"]);
  });

  it("picks the lead credit by media type, ignoring actors", () => {
    const credits = [
      {
        role: "ACTOR" as const,
        order: 0,
        contributor: { name: "Some Actor", kind: "PERSON" as const },
      },
      {
        role: "DIRECTOR" as const,
        order: 1,
        contributor: { name: "Lana Wachowski", kind: "PERSON" as const },
      },
      {
        role: "DEVELOPER" as const,
        order: 0,
        contributor: { name: "FromSoftware", kind: "COMPANY" as const },
      },
    ];
    const base = {
      id: "x",
      title: "X",
      posterUrl: null,
      releaseDate: null,
      computedConsensusScore: 9,
      genres: [],
      tags: [],
      credits,
    };

    expect(
      toCanonCandidate({ ...base, mediaType: "MOVIE" }, "MOVIE").leadCredit,
    ).toEqual({ role: "DIRECTOR", name: "Lana Wachowski" });
    expect(
      toCanonCandidate({ ...base, mediaType: "VIDEO_GAME" }, "VIDEO_GAME")
        .leadCredit,
    ).toEqual({ role: "DEVELOPER", name: "FromSoftware" });
    // TV has no CREATOR credit here, so there's no lead.
    expect(
      toCanonCandidate({ ...base, mediaType: "TV_SHOW" }, "TV_SHOW").leadCredit,
    ).toBeNull();
  });
});

describe("subgenreOptions", () => {
  it("keeps only taxonomy-recognised subgenres for the genre", () => {
    // "Made Up" isn't in the discover taxonomy, so it should be filtered out
    // even though it's present on an item; a real subgenre survives.
    const ranked = [
      item("a", { genres: ["Horror"], subgenres: ["Slasher", "Made Up"] }),
      item("b", { genres: ["Horror"], subgenres: ["Slasher"] }),
    ];
    const options = subgenreOptions(ranked, "MOVIE", "Horror");
    expect(options).not.toContain("Made Up");
  });
});
