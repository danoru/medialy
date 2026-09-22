import { describe, expect, it } from "vitest";
import {
  buildFriendBaselines,
  buildFriendTrust,
  buildTasteProfiles,
  friendKey,
  friendSignal,
  humanReason,
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
      buildTasteProfiles([observation("bad", 1)]),
    );
    expect(neutral.score).toBe(50);
    expect(neutral.confidence).toBeGreaterThan(0);
    expect(disliked.score).toBeLessThan(50);
    expect(disliked.confidence).toBe(neutral.confidence);
  });

  it("learns likes and dislikes separately for each medium", () => {
    const rows = [
      observation("film", 10),
      observation("game", 1, {
        media: item("game", { mediaType: "VIDEO_GAME" }),
      }),
    ];
    const profiles = buildTasteProfiles(rows);
    const movie = scoreV2(item("movie"), profiles);
    expect(movie.score).toBeGreaterThan(50);
    expect(
      scoreV2(item("game2", { mediaType: "VIDEO_GAME" }), profiles).score,
    ).toBeLessThan(50);
    // A medium with no history borrows only portable taste (genres, themes)
    // from other media, at reduced reliability. The feature profiles stay
    // per medium.
    const tv = scoreV2(item("tv", { mediaType: "TV_SHOW" }), profiles);
    expect(tv.confidence).toBeGreaterThan(0);
    expect(tv.confidence).toBeLessThan(movie.confidence);
    for (const signal of ["genre", "tag", "contributor"] as const) {
      expect(tv.explanations.find((e) => e.signal === signal)?.value).toBeNull();
    }
  });

  it("reads a stored zero as a placeholder, not a rating", () => {
    expect(observedTaste(observation("zero", 0, { status: "BACKLOG" }))).toBeNull();
    // A completed title with a placeholder 0 and no comparisons has no taste either.
    expect(observedTaste(observation("zero", 0))).toBeNull();
    expect(observedTaste(observation("half", 0.5))?.rating).toBe(0.5);
    const zero = friendSignal([friend(0)], new Map());
    const none = friendSignal([friend(null)], new Map());
    expect(zero.value).toBe(none.value);
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
      genres: [...candidate.genres, ...candidate.genres],
      tags: [approved, approved],
      credits: [creator, creator],
    };
    expect(scoreV2(duplicate, profiles)).toEqual(scoreV2(candidate, profiles));
    // A feature you have never rated is unknown: it lowers confidence and
    // pulls the score toward neutral, never past it.
    const unseen = { ...candidate, genres: [...candidate.genres, ...genre("Unseen")] };
    const known = scoreV2(candidate, profiles);
    const withUnseen = scoreV2(unseen, profiles);
    expect(withUnseen.confidence).toBeLessThan(known.confidence);
    expect(withUnseen.score).toBeGreaterThan(50);
    expect(withUnseen.score).toBeLessThan(known.score);
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
    expect(score(friend(1))).toBeLessThan(50);
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
      friend(1, { mediaId: "game", mediaType: "VIDEO_GAME" }),
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

describe("v2 similarity", () => {
  const tagged = (name: string, category = "SUBGENRE") => ({
    tag: { name, status: "APPROVED", category },
  });
  const director = { role: "DIRECTOR", contributor: { id: "d1", name: "Director" } };

  it("explains a candidate by the closest title you rated", () => {
    const profiles = buildTasteProfiles([
      observation("loved", 10, {
        media: item("loved", { genres: genre("Horror"), tags: [tagged("Slasher")], credits: [director] }),
      }),
      observation("meh", 5, {
        media: item("meh", { genres: genre("Comedy"), tags: [tagged("Romantic Comedy")] }),
      }),
      observation("filler", 7, { media: item("filler", { genres: genre("Drama") }) }),
    ]);
    const result = scoreV2(
      item("candidate", { genres: genre("Horror"), tags: [tagged("Slasher")], credits: [director] }),
      profiles,
    );
    const similarity = result.explanations.find((e) => e.signal === "similarity");
    expect(similarity?.because?.title).toBe("loved");
    expect(similarity?.value).toBeGreaterThan(50);
    expect(result.reason).toContain("loved");
  });

  it("gives a title no extra credit for carrying more tags", () => {
    const profiles = buildTasteProfiles([
      observation("loved", 10, {
        media: item("loved", { genres: genre("Horror"), tags: [tagged("Slasher")] }),
      }),
    ]);
    const lean = item("lean", { genres: genre("Horror"), tags: [tagged("Slasher")] });
    const padded = item("padded", {
      genres: genre("Horror"),
      tags: [tagged("Slasher"), tagged("Extra one"), tagged("Extra two"), tagged("Extra three")],
    });
    const sim = (candidate: V2Item) =>
      scoreV2(candidate, profiles).explanations.find((e) => e.signal === "similarity")!;
    expect(sim(padded).reliability).toBeLessThan(sim(lean).reliability);
  });

  it("ranks a candidate near your dislikes below one near your favorites", () => {
    const profiles = buildTasteProfiles([
      observation("loved", 10, { media: item("loved", { genres: genre("Horror") }) }),
      observation("hated", 2, { media: item("hated", { genres: genre("Musical") }) }),
      ...Array.from({ length: 6 }, (_, i) =>
        observation(`mid${i}`, 6.5, { media: item(`mid${i}`, { genres: genre("Drama") }) }),
      ),
    ]);
    const horror = scoreV2(item("h", { genres: genre("Horror") }), profiles).score;
    const musical = scoreV2(item("m", { genres: genre("Musical") }), profiles).score;
    expect(horror).toBeGreaterThan(50);
    expect(musical).toBeLessThan(50);
  });

  it("borrows portable taste across media only when the medium itself is thin", () => {
    const movies = Array.from({ length: 12 }, (_, i) =>
      observation(`film${i}`, 10, {
        media: item(`film${i}`, { genres: genre("Horror"), tags: [tagged("Dread", "MOOD")] }),
      }),
    );
    const profiles = buildTasteProfiles(movies);
    const game = scoreV2(
      item("game", { mediaType: "VIDEO_GAME", genres: genre("Horror"), tags: [tagged("Dread", "MOOD")] }),
      profiles,
    );
    const similarity = game.explanations.find((e) => e.signal === "similarity")!;
    expect(similarity.value).toBeGreaterThan(50);
    expect(similarity.reliability).toBeLessThan(0.4);
  });
});

describe("v2 friend baselines", () => {
  it("reads a friend's rating relative to that friend's usual rating", () => {
    const generous = [
      ...Array.from({ length: 20 }, (_, i) => friend(9.5, { mediaId: `g${i}` })),
      friend(7, { mediaId: "candidate" }),
    ];
    const harsh = [
      ...Array.from({ length: 20 }, (_, i) => friend(5, { mediaId: `h${i}`, userId: "harsh" })),
      friend(7, { mediaId: "candidate", userId: "harsh" }),
    ];
    const rows = [...generous, ...harsh];
    const baselines = buildFriendBaselines(rows);
    const opinion = (userId: string) =>
      friendSignal(rows.filter((r) => r.mediaId === "candidate" && r.userId === userId), new Map(), baselines).value!;
    expect(opinion("friend")).toBeLessThan(50);
    expect(opinion("harsh")).toBeGreaterThan(50);
  });
});

describe("v2 tiering, twins and reasons", () => {
  const tagged = (name: string, category = "SUBGENRE") => ({
    tag: { name, status: "APPROVED", category },
  });

  it("lets critics lead a brand-new account and step back once the viewer has history", () => {
    const candidate = item("c", {
      genres: genre("Horror"),
      computedConsensusScore: 9.5,
      consensusConfidence: 0.9,
    });
    const cold = scoreV2(candidate, buildTasteProfiles([]));
    const warm = scoreV2(
      candidate,
      buildTasteProfiles([
        ...Array.from({ length: 15 }, (_, i) =>
          observation(`h${i}`, 3, { media: item(`h${i}`, { genres: genre("Horror") }) }),
        ),
        ...Array.from({ length: 15 }, (_, i) =>
          observation(`d${i}`, 8, { media: item(`d${i}`, { genres: genre("Drama") }) }),
        ),
      ]),
    );
    const critics = (result: typeof cold) =>
      result.explanations.find((e) => e.signal === "consensus")!;
    expect(cold.score).toBeGreaterThan(50);
    expect(critics(warm).weight).toBeLessThan(critics(cold).weight);
    // Fifteen disliked horror films outweigh the critics.
    expect(warm.score).toBeLessThan(50);
  });

  it("counts a non-followed user only once the shared history is large enough", () => {
    const twin = "twin";
    const rows = (n: number) => [
      ...Array.from({ length: n }, (_, i) =>
        friend(9, { userId: twin, mediaId: `shared${i}` }),
      ),
      friend(9.5, { userId: twin, mediaId: "candidate" }),
    ];
    const viewer = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ mediaId: `shared${i}`, rating: 9 }));
    const signal = (n: number) =>
      friendSignal(
        rows(n).filter((r) => r.mediaId === "candidate"),
        buildFriendTrust(viewer(n), rows(n)),
        new Map(),
        { minOverlap: 15, noun: "taste-twin" },
      );
    expect(signal(5).value).toBeNull();
    expect(signal(20).value).toBeGreaterThan(50);
    expect(signal(20).person?.userId).toBe(twin);
  });

  it("writes reasons a reader can act on", () => {
    const names = new Map([["anna", "Anna"]]);
    expect(
      humanReason({ signal: "similarity", value: 80, because: { id: "x", title: "Cure", rating: 9 } }, names),
    ).toBe("Because you rated Cure 9/10");
    expect(
      humanReason({ signal: "tag", value: 70, feature: { label: "Slow burn", direction: "above" } }, names),
    ).toBe("You usually rate Slow burn above your average");
    expect(
      humanReason(
        { signal: "friends", value: 80, person: { userId: "anna", rating: 9, status: "COMPLETED", compatibility: 84 } },
        names,
      ),
    ).toBe("Anna rated it 9/10, and your tastes match 84%");
    expect(
      humanReason(
        { signal: "twins", value: 80, person: { userId: "anna", rating: 8.5, status: "COMPLETED", compatibility: 77 } },
        names,
      ),
    ).toBe("Anna, whose your tastes match 77%, rated it 8.5/10");
    expect(humanReason({ signal: "consensus", value: 100 }, names)).toBe("Critics love it, 9.5/10");
    expect(humanReason({ signal: "consensus", value: null }, names)).toBeNull();
  });

  it("prefers a personal reason over critics when it carries real weight", () => {
    const profiles = buildTasteProfiles([
      observation("loved", 10, {
        media: item("loved", { genres: genre("Horror"), tags: [tagged("Slasher")] }),
      }),
      ...Array.from({ length: 8 }, (_, i) =>
        observation(`mid${i}`, 6.5, { media: item(`mid${i}`, { genres: genre("Drama") }) }),
      ),
    ]);
    const result = scoreV2(
      item("c", {
        genres: genre("Horror"),
        tags: [tagged("Slasher")],
        computedConsensusScore: 9,
        consensusConfidence: 0.9,
      }),
      profiles,
    );
    expect(result.reason).toBe("Because you rated loved 10/10");
  });
});

describe("v2 explaining title", () => {
  it("explains a positive signal with a loved title, not the closest disliked one", () => {
    const tagged = (name: string) => ({ tag: { name, status: "APPROVED", category: "SUBGENRE" } });
    const profiles = buildTasteProfiles([
      observation("dud", 4, {
        media: item("dud", { genres: genre("Crime"), tags: [tagged("Neo-noir"), tagged("Heist")] }),
      }),
      ...Array.from({ length: 4 }, (_, i) =>
        observation(`gem${i}`, 9.5, {
          media: item(`gem${i}`, { genres: genre("Crime"), tags: [tagged("Neo-noir")] }),
        }),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        observation(`mid${i}`, 6.5, { media: item(`mid${i}`, { genres: genre("Drama") }) }),
      ),
    ]);
    const result = scoreV2(
      item("c", { genres: genre("Crime"), tags: [tagged("Neo-noir"), tagged("Heist")] }),
      profiles,
    );
    const similarity = result.explanations.find((e) => e.signal === "similarity")!;
    expect(similarity.value).toBeGreaterThan(50);
    expect(similarity.because?.title.startsWith("gem")).toBe(true);
  });
});
