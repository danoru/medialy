import type { ContributorKind, CreditRole, MediaType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  LOVED_MARGIN,
  PEOPLE_SHRINK_K,
  buildPeopleIndex,
  collaborators,
  isSeen,
  personArt,
  personStats,
  personalScore,
  primaryMediaType,
  recentPeople,
  rolesLabel,
  searchPeople,
  titleNoun,
  topPeople,
  unfinishedBusiness,
  userMeans,
  type PeopleSourceRow,
} from "./people";

type CreditInput = PeopleSourceRow["credits"][number];

function credit(
  id: string,
  role: CreditRole = "DIRECTOR",
  order = 0,
  name = id,
  kind: ContributorKind = "PERSON",
): CreditInput {
  return { role, order, contributor: { id, name, kind } };
}

function makeRow(
  id: string,
  overrides: Partial<PeopleSourceRow> = {},
): PeopleSourceRow {
  // A refined score always rests on a real rating in these fixtures, unless a
  // test says otherwise by passing `personalRating` itself.
  const personalRating =
    "personalRating" in overrides
      ? overrides.personalRating!
      : (overrides.computedPersonalScore ?? null);
  return {
    id,
    title: id,
    mediaType: "MOVIE",
    posterUrl: null,
    releaseDate: null,
    computedConsensusScore: null,
    credits: [],
    status: "UNTRACKED",
    computedPersonalScore: null,
    pairwiseScore: 1000,
    comparisonCount: 0,
    isArchived: false,
    completedAt: null,
    ...overrides,
    personalRating,
  };
}

/** A rated movie by one director. */
function rated(id: string, directorId: string, score: number) {
  return makeRow(id, {
    personalRating: score,
    computedPersonalScore: score,
    status: "COMPLETED",
    credits: [credit(directorId)],
  });
}

/** A movie by one director that the viewer hasn't touched. */
function untouched(id: string, directorId: string) {
  return makeRow(id, { credits: [credit(directorId)] });
}

describe("buildPeopleIndex", () => {
  it("groups credits by contributor across titles", () => {
    const a = makeRow("a", { credits: [credit("p1"), credit("p2", "ACTOR", 1)] });
    const b = makeRow("b", { credits: [credit("p1")] });
    const index = buildPeopleIndex([a, b]);
    expect(index.size).toBe(2);
    expect(index.get("p1")!.credits.map((c) => c.row.id)).toEqual(["a", "b"]);
    expect(index.get("p2")!.credits.map((c) => c.row.id)).toEqual(["a"]);
  });

  it("merges two roles on the same title into one credit with the min order", () => {
    const row = makeRow("a", {
      credits: [credit("p1", "ACTOR", 3), credit("p1", "DIRECTOR", 1)],
    });
    const entry = buildPeopleIndex([row]).get("p1")!;
    expect(entry.credits).toHaveLength(1);
    expect(entry.credits[0].roles).toEqual(["ACTOR", "DIRECTOR"]);
    expect(entry.credits[0].order).toBe(1);
  });
});

describe("personalScore and isSeen", () => {
  it("prefers the computed score over the explicit rating", () => {
    const row = makeRow("a", { computedPersonalScore: 7.5, personalRating: 9 });
    expect(personalScore(row)).toBe(7.5);
  });

  it("falls back to an explicit rating", () => {
    expect(personalScore(makeRow("a", { personalRating: 8 }))).toBe(8);
  });

  it("does not treat a stored 0 as a rating", () => {
    const row = makeRow("a", { personalRating: 0 });
    expect(personalScore(row)).toBeNull();
    expect(isSeen(row)).toBe(false);
  });

  it("ignores archived rows entirely", () => {
    const row = makeRow("a", {
      isArchived: true,
      computedPersonalScore: 9,
      status: "COMPLETED",
    });
    expect(personalScore(row)).toBeNull();
    expect(isSeen(row)).toBe(false);
  });

  it("counts experienced statuses as seen", () => {
    for (const status of ["COMPLETED", "IN_PROGRESS", "PAUSED", "DROPPED"] as const) {
      expect(isSeen(makeRow("a", { status }))).toBe(true);
    }
  });

  it("does not count a watchlist entry alone as seen", () => {
    expect(isSeen(makeRow("a", { status: "WATCHLIST" }))).toBe(false);
  });

  it("counts a scored row as seen regardless of status", () => {
    expect(isSeen(makeRow("a", { computedPersonalScore: 6 }))).toBe(true);
  });
});

describe("userMeans", () => {
  it("averages scores per media type, skipping unscored and archived rows", () => {
    const means = userMeans([
      makeRow("m1", { computedPersonalScore: 8 }),
      makeRow("m2", { personalRating: 6 }),
      makeRow("m3"),
      makeRow("m4", { computedPersonalScore: 1, isArchived: true }),
      makeRow("t1", { mediaType: "TV_SHOW", computedPersonalScore: 9 }),
    ]);
    expect(means.get("MOVIE")).toBe(7);
    expect(means.get("TV_SHOW")).toBe(9);
    expect(means.has("BOOK")).toBe(false);
  });
});

describe("personStats", () => {
  const rows = [
    rated("a", "p1", 9),
    rated("b", "p1", 7),
    untouched("c", "p1"),
    makeRow("d", { isArchived: true, credits: [credit("p1")] }),
    makeRow("e", { mediaType: "TV_SHOW", computedPersonalScore: 10, credits: [credit("p1")] }),
  ];
  const entry = buildPeopleIndex(rows).get("p1")!;

  it("computes average, shrinkage and delta, scoped to the media type", () => {
    const stats = personStats(entry, "MOVIE", 6);
    expect(stats.rated.map((r) => r.score)).toEqual([9, 7]);
    expect(stats.average).toBe(8);
    expect(stats.shrunk).toBeCloseTo((16 + PEOPLE_SHRINK_K * 6) / (2 + PEOPLE_SHRINK_K));
    expect(stats.shrunk).toBe(7);
    expect(stats.delta).toBe(2);
  });

  it("pulls the shrunk score toward the mean", () => {
    const stats = personStats(entry, "MOVIE", 6);
    expect(stats.shrunk!).toBeLessThan(stats.average!);
    expect(stats.shrunk!).toBeGreaterThan(6);
  });

  it("excludes archived rows from unseen", () => {
    const stats = personStats(entry, "MOVIE", 6);
    expect(stats.credits).toHaveLength(4);
    expect(stats.seen.map((c) => c.row.id)).toEqual(["a", "b"]);
    expect(stats.unseen.map((c) => c.row.id)).toEqual(["c"]);
  });

  it("uses the plain average when there is no mean", () => {
    const stats = personStats(entry, "MOVIE", null);
    expect(stats.shrunk).toBe(8);
    expect(stats.delta).toBeNull();
  });

  it("returns null stats when nothing is rated", () => {
    const stats = personStats(entry, "VIDEO_GAME", 6);
    expect(stats.average).toBeNull();
    expect(stats.shrunk).toBeNull();
    expect(stats.delta).toBeNull();
  });

  it("filters by role", () => {
    const mixed = buildPeopleIndex([
      makeRow("x", { credits: [credit("p", "DIRECTOR")], computedPersonalScore: 9 }),
      makeRow("y", { credits: [credit("p", "ACTOR", 0)], computedPersonalScore: 5 }),
    ]).get("p")!;
    expect(personStats(mixed, "MOVIE", 6, ["DIRECTOR"]).average).toBe(9);
    expect(personStats(mixed, "MOVIE", 6, ["ACTOR"]).average).toBe(5);
    expect(personStats(mixed, "MOVIE", 6).credits).toHaveLength(2);
  });
});

describe("topPeople", () => {
  it("excludes a person with a single 10/10 under the default minRated", () => {
    const index = buildPeopleIndex([rated("a", "solo", 10)]);
    expect(topPeople(index, "MOVIE", 6, ["DIRECTOR"])).toEqual([]);
    expect(topPeople(index, "MOVIE", 6, ["DIRECTOR"], { minRated: 1 })).toHaveLength(1);
  });

  it("lets three 9s beat two 9.5s through shrinkage when the mean is 6", () => {
    // three 9s: (27 + 12) / 5 = 7.8; two 9.5s: (19 + 12) / 4 = 7.75
    const index = buildPeopleIndex([
      rated("a1", "three", 9),
      rated("a2", "three", 9),
      rated("a3", "three", 9),
      rated("b1", "two", 9.5),
      rated("b2", "two", 9.5),
    ]);
    const result = topPeople(index, "MOVIE", 6, ["DIRECTOR"]);
    expect(result.map((r) => r.entry.id)).toEqual(["three", "two"]);
    expect(result[0].stats.shrunk).toBeCloseTo(7.8);
    expect(result[1].stats.shrunk).toBeCloseTo(7.75);
  });

  it("breaks ties by rated count, then by name", () => {
    // Equal shrunk score (7 with mean 6): two 8s => (16+12)/4, four... use
    // identical samples for the name tie, and a mean-equal pair for count.
    const index = buildPeopleIndex([
      rated("z1", "zed", 8),
      rated("z2", "zed", 8),
      rated("a1", "amy", 8),
      rated("a2", "amy", 8),
    ]);
    // same shrunk and count; "amy" sorts before "zed" by name
    const byName = topPeople(index, "MOVIE", 6, ["DIRECTOR"]);
    expect(byName.map((r) => r.entry.id)).toEqual(["amy", "zed"]);

    // With mean 6, four 6s and two 6s both shrink to exactly 6; more ratings first.
    const index2 = buildPeopleIndex([
      rated("m1", "many", 6),
      rated("m2", "many", 6),
      rated("m3", "many", 6),
      rated("m4", "many", 6),
      rated("f1", "aaa-few", 6),
      rated("f2", "aaa-few", 6),
    ]);
    const byCount = topPeople(index2, "MOVIE", 6, ["DIRECTOR"]);
    expect(byCount.map((r) => r.entry.id)).toEqual(["many", "aaa-few"]);
  });

  it("respects the limit", () => {
    const index = buildPeopleIndex([
      rated("a1", "a", 9),
      rated("a2", "a", 9),
      rated("b1", "b", 8),
      rated("b2", "b", 8),
    ]);
    expect(topPeople(index, "MOVIE", 6, ["DIRECTOR"], { limit: 1 })).toHaveLength(1);
  });
});

describe("unfinishedBusiness", () => {
  it("returns [] when the mean is null", () => {
    const index = buildPeopleIndex([
      rated("a", "p", 9),
      rated("b", "p", 9),
      untouched("c", "p"),
    ]);
    expect(unfinishedBusiness(index, "MOVIE", null)).toEqual([]);
  });

  it("requires a lift of at least LOVED_MARGIN", () => {
    // mean 6, two 6.2s => shrunk 6.1, lift 0.1 < LOVED_MARGIN
    const index = buildPeopleIndex([
      rated("a", "meh", 6.2),
      rated("b", "meh", 6.2),
      untouched("c", "meh"),
    ]);
    expect(0.1).toBeLessThan(LOVED_MARGIN);
    expect(unfinishedBusiness(index, "MOVIE", 6)).toEqual([]);
  });

  it("requires at least one unseen title", () => {
    const index = buildPeopleIndex([rated("a", "p", 9), rated("b", "p", 9)]);
    expect(unfinishedBusiness(index, "MOVIE", 6)).toEqual([]);
  });

  it("includes a loved person with an unseen title", () => {
    const index = buildPeopleIndex([
      rated("a", "p", 9),
      rated("b", "p", 9),
      untouched("c", "p"),
    ]);
    const result = unfinishedBusiness(index, "MOVIE", 6);
    expect(result.map((r) => r.entry.id)).toEqual(["p"]);
    expect(result[0].stats.unseen).toHaveLength(1);
  });

  it("ranks more unseen titles higher at equal lift", () => {
    const index = buildPeopleIndex([
      rated("a1", "few", 8),
      rated("a2", "few", 8),
      untouched("a3", "few"),
      rated("b1", "lots", 8),
      rated("b2", "lots", 8),
      untouched("b3", "lots"),
      untouched("b4", "lots"),
      untouched("b5", "lots"),
    ]);
    const result = unfinishedBusiness(index, "MOVIE", 6);
    expect(result.map((r) => r.entry.id)).toEqual(["lots", "few"]);
  });
});

describe("recentPeople", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, n));

  it("only uses completed, non-archived titles of the type with a completedAt, newest first", () => {
    const rows = [
      makeRow("old", { status: "COMPLETED", completedAt: day(1), credits: [credit("p-old")] }),
      makeRow("new", { status: "COMPLETED", completedAt: day(20), credits: [credit("p-new")] }),
      makeRow("nodate", { status: "COMPLETED", credits: [credit("p-nodate")] }),
      makeRow("prog", { status: "IN_PROGRESS", completedAt: day(25), credits: [credit("p-prog")] }),
      makeRow("arch", {
        status: "COMPLETED",
        completedAt: day(26),
        isArchived: true,
        credits: [credit("p-arch")],
      }),
      makeRow("tv", {
        mediaType: "TV_SHOW",
        status: "COMPLETED",
        completedAt: day(27),
        credits: [credit("p-tv")],
      }),
    ];
    const index = buildPeopleIndex(rows);
    const result = recentPeople(index, rows, "MOVIE");
    expect(result.map((r) => r.entry.id)).toEqual(["p-new", "p-old"]);
    expect(result[0].from.id).toBe("new");
  });

  it("dedupes people across titles", () => {
    const rows = [
      makeRow("a", { status: "COMPLETED", completedAt: day(10), credits: [credit("p")] }),
      makeRow("b", { status: "COMPLETED", completedAt: day(5), credits: [credit("p")] }),
    ];
    const result = recentPeople(buildPeopleIndex(rows), rows, "MOVIE");
    expect(result).toHaveLength(1);
    expect(result[0].from.id).toBe("a");
  });

  it("includes only actors billed in the top two", () => {
    const rows = [
      makeRow("a", {
        status: "COMPLETED",
        completedAt: day(10),
        credits: [
          credit("dir", "DIRECTOR", 0),
          credit("a0", "ACTOR", 0),
          credit("a1", "ACTOR", 1),
          credit("a2", "ACTOR", 2),
        ],
      }),
    ];
    const result = recentPeople(buildPeopleIndex(rows), rows, "MOVIE");
    expect(result.map((r) => r.entry.id)).toEqual(["dir", "a0", "a1"]);
  });

  it("respects the limit", () => {
    const rows = [
      makeRow("a", {
        status: "COMPLETED",
        completedAt: day(10),
        credits: [credit("d1"), credit("d2", "DIRECTOR", 1), credit("d3", "DIRECTOR", 2)],
      }),
    ];
    const result = recentPeople(buildPeopleIndex(rows), rows, "MOVIE", { limit: 2 });
    expect(result).toHaveLength(2);
  });
});

describe("collaborators", () => {
  const rows = [
    makeRow("a", { credits: [credit("p"), credit("c1", "ACTOR", 0), credit("c2", "ACTOR", 1)] }),
    makeRow("b", { credits: [credit("p"), credit("c1", "ACTOR", 0)] }),
    makeRow("c", { credits: [credit("p"), credit("c1", "ACTOR", 0), credit("c2", "ACTOR", 1)] }),
    makeRow("tv", {
      mediaType: "TV_SHOW",
      credits: [credit("p", "CREATOR"), credit("c3", "ACTOR", 0)],
    }),
    makeRow("tv2", {
      mediaType: "TV_SHOW",
      credits: [credit("p", "CREATOR"), credit("c3", "ACTOR", 0)],
    }),
  ];
  const index = buildPeopleIndex(rows);

  it("counts shared titles within the type and excludes the person", () => {
    const result = collaborators(index, "p", "MOVIE");
    expect(result.map((r) => [r.entry.id, r.shared])).toEqual([
      ["c1", 3],
      ["c2", 2],
    ]);
    expect(result.some((r) => r.entry.id === "p")).toBe(false);
  });

  it("only counts the requested type", () => {
    const result = collaborators(index, "p", "TV_SHOW");
    expect(result.map((r) => [r.entry.id, r.shared])).toEqual([["c3", 2]]);
  });

  it("respects minShared", () => {
    const result = collaborators(index, "p", "MOVIE", { minShared: 3 });
    expect(result.map((r) => r.entry.id)).toEqual(["c1"]);
  });

  it("returns [] for an unknown person", () => {
    expect(collaborators(index, "nobody", "MOVIE")).toEqual([]);
  });
});

describe("searchPeople", () => {
  it("folds accents and case", () => {
    const index = buildPeopleIndex([
      makeRow("a", { credits: [credit("ag", "DIRECTOR", 0, "Alejandro González Iñárritu")] }),
      makeRow("b", { credits: [credit("other", "DIRECTOR", 0, "Someone Else")] }),
    ]);
    const result = searchPeople(index, "Inarritu");
    expect(result.map((r) => r.entry.id)).toEqual(["ag"]);
    expect(searchPeople(index, "GONZALEZ")).toHaveLength(1);
  });

  it("treats a trailing * as a prefix match", () => {
    const index = buildPeopleIndex([
      makeRow("a", { credits: [credit("p1", "DIRECTOR", 0, "Anna Lee")] }),
      makeRow("b", { credits: [credit("p2", "DIRECTOR", 0, "Joanna Bell")] }),
    ]);
    expect(searchPeople(index, "ann").map((r) => r.entry.id).sort()).toEqual(["p1", "p2"]);
    expect(searchPeople(index, "ann*").map((r) => r.entry.id)).toEqual(["p1"]);
  });

  it("ranks people with more seen titles first", () => {
    const index = buildPeopleIndex([
      makeRow("a", { credits: [credit("p1", "DIRECTOR", 0, "Sam Stranger")] }),
      makeRow("b", { credits: [credit("p1", "DIRECTOR", 0, "Sam Stranger")] }),
      makeRow("c", { status: "COMPLETED", credits: [credit("p2", "DIRECTOR", 0, "Sam Known")] }),
    ]);
    const result = searchPeople(index, "sam");
    expect(result.map((r) => r.entry.id)).toEqual(["p2", "p1"]);
    expect(result[0].seen).toBe(1);
  });

  it("returns [] for an empty query", () => {
    const index = buildPeopleIndex([makeRow("a", { credits: [credit("p1")] })]);
    expect(searchPeople(index, "")).toEqual([]);
    expect(searchPeople(index, "   ")).toEqual([]);
    expect(searchPeople(index, "*")).toEqual([]);
  });
});

describe("labels and helpers", () => {
  it("orders roles behind the camera first", () => {
    expect(rolesLabel(["ACTOR", "DIRECTOR"])).toBe("Director · Actor");
    expect(rolesLabel(["ACTOR"])).toBe("Actor");
    expect(rolesLabel(new Set<CreditRole>(["PUBLISHER", "DEVELOPER"]))).toBe(
      "Developer · Publisher",
    );
  });

  it("titleNoun handles singular and plural", () => {
    expect(titleNoun("MOVIE", 1)).toBe("film");
    expect(titleNoun("MOVIE")).toBe("films");
    expect(titleNoun("TV_SHOW", 1)).toBe("show");
    expect(titleNoun("VIDEO_GAME", 3)).toBe("games");
    expect(titleNoun("BOOK", 1)).toBe("title");
    expect(titleNoun("BOOK", 2)).toBe("titles");
  });

  it("primaryMediaType returns the type with the most credits", () => {
    const mk = (id: string, mediaType: MediaType) =>
      makeRow(id, { mediaType, credits: [credit("p")] });
    const index = buildPeopleIndex([
      mk("a", "TV_SHOW"),
      mk("b", "MOVIE"),
      mk("c", "MOVIE"),
    ]);
    expect(primaryMediaType(index.get("p")!)).toBe("MOVIE");
    expect(primaryMediaType({ id: "x", name: "x", kind: "PERSON", credits: [] })).toBeNull();
  });
});

describe("personArt", () => {
  const poster = (id: string, overrides: Partial<PeopleSourceRow> = {}) =>
    makeRow(id, { posterUrl: `https://img/${id}.jpg`, ...overrides });

  it("prefers your highest-rated title, then the best reviewed", () => {
    const rows = [
      poster("acclaimed", { computedConsensusScore: 9.5 }),
      poster("yours", { personalRating: 8, computedPersonalScore: 8, computedConsensusScore: 6 }),
    ];
    expect(personArt(rows)?.title).toBe("yours");
    expect(personArt([poster("a", { computedConsensusScore: 7 }), poster("b", { computedConsensusScore: 9 })])?.title).toBe("b");
  });

  it("skips excluded titles and titles without a poster", () => {
    const rows = [
      poster("inception", { personalRating: 9, computedPersonalScore: 9 }),
      poster("tenet", { computedConsensusScore: 7 }),
      makeRow("no-poster", { personalRating: 10, computedPersonalScore: 10 }),
    ];
    expect(personArt(rows, new Set(["inception"]))).toEqual({
      posterUrl: "https://img/tenet.jpg",
      title: "tenet",
    });
    expect(personArt([rows[0]], new Set(["inception"]))).toBeNull();
  });
});
