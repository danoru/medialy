import { describe, expect, it } from "vitest";
import {
  buildFriendTrust,
  buildTasteProfiles,
  friendKey,
  friendSignal,
  observedTaste,
  scoreV2,
  type FriendRating,
  type TasteObservation,
  type V2Item,
} from "./recommendationV2";
import {
  evaluateRecommendations,
  evaluationFold,
} from "./recommendationEvaluation";

function item(id: string, overrides: Partial<V2Item> = {}): V2Item {
  return {
    id,
    title: id,
    mediaType: "MOVIE",
    genres: [{ genre: { name: "Drama" } }],
    tags: [],
    credits: [],
    computedConsensusScore: null,
    consensusConfidence: 0,
    ...overrides,
  };
}
function observation(
  id: string,
  rating: number | null,
  overrides: Partial<TasteObservation> = {},
): TasteObservation {
  return {
    media: item(id),
    personalRating: rating,
    pairwiseScore: 1000,
    comparisonCount: 0,
    status: "COMPLETED",
    isArchived: false,
    ...overrides,
  };
}
function friend(
  rating: number | null,
  overrides: Partial<FriendRating> = {},
): FriendRating {
  return {
    userId: "friend",
    mediaId: "candidate",
    mediaType: "MOVIE",
    rating,
    status: "COMPLETED",
    ...overrides,
  };
}
const genre = (name: string) => [{ genre: { name } }];

describe("v2 taste evidence", () => {
  it("separates unknown, neutral and disliked without fabricated ratings", () => {
    expect(observedTaste(observation("unrated", null))).toBeNull();
    const cold = scoreV2(item("new"), buildTasteProfiles([]));
    expect(cold.score).toBe(50);
    expect(cold.confidence).toBe(0);
    expect(cold.explanations.every((e) => e.value == null)).toBe(true);
    const neutral = scoreV2(
      item("new"),
      buildTasteProfiles([observation("neutral", 6.5)]),
    );
    const disliked = scoreV2(
      item("new"),
      buildTasteProfiles([observation("bad", 0)]),
    );
    expect(neutral.score).toBe(50);
    expect(neutral.confidence).toBeGreaterThan(0);
    expect(disliked.score).toBeLessThan(50);
    expect(disliked.confidence).toBe(neutral.confidence);
  });

  it("learns likes and dislikes separately for each medium", () => {
    const rows = [
      observation("film", 10),
      observation("game", 0, {
        media: item("game", { mediaType: "VIDEO_GAME" }),
      }),
    ];
    const profiles = buildTasteProfiles(rows);
    expect(scoreV2(item("movie"), profiles).score).toBeGreaterThan(50);
    expect(
      scoreV2(item("game2", { mediaType: "VIDEO_GAME" }), profiles).score,
    ).toBeLessThan(50);
    expect(
      scoreV2(item("tv", { mediaType: "TV_SHOW" }), profiles).confidence,
    ).toBe(0);
  });

  it("shrinks one disliked example more than repeated evidence", () => {
    const neutral = Array.from({ length: 20 }, (_, i) =>
      observation(`neutral${i}`, 6.5, {
        media: item(`neutral${i}`, { genres: genre("Comedy") }),
      }),
    );
    const one = [...neutral, observation("bad", 2)];
    const several = [
      ...neutral,
      ...Array.from({ length: 5 }, (_, i) => observation(`bad${i}`, 2)),
    ];
    expect(
      scoreV2(item("candidate"), buildTasteProfiles(several)).score,
    ).toBeLessThan(scoreV2(item("candidate"), buildTasteProfiles(one)).score);
  });

  it("centers preferences on a person's usual rating", () => {
    const background = Array.from({ length: 40 }, (_, i) =>
      observation(`other${i}`, 9, {
        media: item(`other${i}`, { genres: genre("Comedy") }),
      }),
    );
    const profile = buildTasteProfiles([
      ...background,
      observation("relative-dislike", 7),
    ]);
    expect(scoreV2(item("candidate"), profile).score).toBeLessThan(50);
  });

  it("does not multiply scores with duplicated or unobserved metadata", () => {
    const approved = { tag: { name: "Slow burn", status: "APPROVED" } };
    const creator = {
      role: "DIRECTOR",
      contributor: { id: "director", name: "Director" },
    };
    const source = item("favorite", { tags: [approved], credits: [creator] });
    const profiles = buildTasteProfiles([
      observation("favorite", 10, { media: source }),
    ]);
    const candidate = item("candidate", {
      tags: [approved],
      credits: [creator],
    });
    const duplicate = {
      ...candidate,
      genres: [...candidate.genres, ...candidate.genres, ...genre("Unseen")],
      tags: [approved, approved],
      credits: [creator, creator],
    };
    expect(scoreV2(duplicate, profiles)).toEqual(scoreV2(candidate, profiles));
    const duplicateTraining = buildTasteProfiles([
      observation("favorite", 10, {
        media: {
          ...source,
          tags: [approved, approved],
          credits: [creator, creator],
        },
      }),
    ]);
    expect(scoreV2(candidate, duplicateTraining)).toEqual(
      scoreV2(candidate, profiles),
    );
  });

  it("does not learn unapproved tags or transfer roles", () => {
    const tag = { tag: { name: "Unreviewed", status: "PENDING" } };
    const director = {
      role: "DIRECTOR",
      contributor: { id: "person", name: "Person" },
    };
    const profiles = buildTasteProfiles([
      observation("rated", 10, {
        media: item("rated", { genres: [], tags: [tag], credits: [director] }),
      }),
    ]);
    const candidate = item("candidate", {
      genres: [],
      tags: [tag],
      credits: [{ ...director, role: "ACTOR" }],
    });
    expect(scoreV2(candidate, profiles).confidence).toBe(0);
  });

  it("uses explicit low ratings at any status but not status-only dislike", () => {
    expect(
      observedTaste(observation("dropped", 2, { status: "DROPPED" }))?.rating,
    ).toBe(2);
    expect(
      observedTaste(
        observation("dropped", null, { status: "DROPPED", comparisonCount: 8 }),
      ),
    ).toBeNull();
    expect(
      observedTaste(observation("archived", 10, { isArchived: true })),
    ).toBeNull();
  });

  it("excludes held-out titles before computing baseline and features", () => {
    const keep = observation("keep", 3);
    const withheld = observation("withheld", 10);
    expect(
      scoreV2(
        item("candidate"),
        buildTasteProfiles([keep, withheld], new Set(["withheld"])),
      ),
    ).toEqual(scoreV2(item("candidate"), buildTasteProfiles([keep])));
  });

  it("handles known poor consensus as negative evidence, missing consensus as unknown", () => {
    const poor = scoreV2(
      item("poor", { computedConsensusScore: 0, consensusConfidence: 0.8 }),
      new Map(),
    );
    expect(poor.score).toBeLessThan(50);
    expect(poor.confidence).toBeGreaterThan(0);
    expect(poor.explanations.find((e) => e.signal === "consensus")?.value).toBe(
      0,
    );
  });
});

describe("v2 friends", () => {
  it("retains compatibility's effect with just one friend", () => {
    const high = new Map([
      [friendKey("friend", "MOVIE"), { compatibility: 100, overlap: 20 }],
    ]);
    const low = new Map([
      [friendKey("friend", "MOVIE"), { compatibility: 10, overlap: 20 }],
    ]);
    const score = (trust: typeof high) =>
      scoreV2(item("new"), new Map(), friendSignal([friend(10)], trust)).score;
    expect(score(high)).toBeGreaterThan(score(low));
    const sparse = new Map([
      [friendKey("friend", "MOVIE"), { compatibility: 100, overlap: 1 }],
    ]);
    expect(score(high)).toBeGreaterThan(score(sparse));
  });

  it("lets a low friend rating demote despite completion and treats status as weak", () => {
    const score = (rating: FriendRating) =>
      scoreV2(item("new"), new Map(), friendSignal([rating], new Map())).score;
    expect(score(friend(0))).toBeLessThan(50);
    expect(score(friend(null))).toBeGreaterThan(50);
    expect(score(friend(null))).toBeLessThan(score(friend(8)));
    expect(score(friend(null, { status: "WATCHLIST" }))).toBeLessThan(
      score(friend(null)),
    );
  });

  it("increases evidence with independent friends, not duplicate rows", () => {
    const one = friendSignal([friend(9)], new Map());
    expect(friendSignal([friend(9), friend(9)], new Map())).toEqual(one);
    expect(
      friendSignal([friend(9), friend(9, { userId: "second" })], new Map())
        .reliability,
    ).toBeGreaterThan(one.reliability);
  });

  it("excludes held-out overlap and keeps compatibility medium-specific", () => {
    const rows = [
      friend(10, { mediaId: "movie" }),
      friend(0, { mediaId: "game", mediaType: "VIDEO_GAME" }),
    ];
    const viewer = [
      { mediaId: "movie", rating: 10 },
      { mediaId: "game", rating: 10 },
    ];
    const trust = buildFriendTrust(viewer, rows);
    expect(trust.get(friendKey("friend", "MOVIE"))?.compatibility).toBe(100);
    expect(trust.get(friendKey("friend", "VIDEO_GAME"))?.compatibility).toBe(0);
    const excluded = buildFriendTrust(viewer, rows, new Set(["movie"]));
    expect(excluded.has(friendKey("friend", "MOVIE"))).toBe(false);
  });
});

describe("held-out diagnostic", () => {
  it("does not report performance when no valid comparisons exist", () => {
    const result = evaluateRecommendations(
      [observation("only", 10)],
      [],
      "MOVIE",
    );
    expect(result.pairs).toBe(0);
    expect(result.v2Accuracy).toBeNull();
  });

  it("recovers genre preferences from training-only examples", () => {
    const rows = Array.from({ length: 80 }, (_, i) =>
      observation(`rated${i}`, i % 2 ? 2 : 10, {
        media: item(`rated${i}`, {
          genres: genre(i % 2 ? "Disliked" : "Liked"),
          computedConsensusScore: 7,
          consensusConfidence: 0.8,
        }),
      }),
    );
    const result = evaluateRecommendations(rows, [], "MOVIE");
    expect(result.evaluatedTitles).toBe(80);
    expect(result.pairs).toBeGreaterThan(0);
    expect(result.v2Accuracy).toBe(1);
    expect(result.consensusAccuracy).toBe(0.5);
    expect(evaluateRecommendations([...rows].reverse(), [], "MOVIE")).toEqual(
      result,
    );
    expect(evaluationFold("fixed")).toBe(evaluationFold("fixed"));
  });
});
