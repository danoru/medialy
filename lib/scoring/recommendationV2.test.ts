import { describe, expect, it } from "vitest";
import {
  buildFriendBaselines,
  buildFriendTrust,
  buildTasteProfiles,
  consensusSignal,
  contributorPhrase,
  eraMixSignal,
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
import { buildEraContext, type EraContext, type EraExposure, type EraKey } from "./era";
import { RECOMMENDATION_V2 } from "./config";

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
    for (const signal of ["contributor", "subgenre", "genre", "theme", "era", "cast"] as const) {
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
      tags: [tagged("Slasher")],
      credits: [{ role: "DIRECTOR", contributor: { id: "carpenter", name: "Carpenter" } }],
      computedConsensusScore: 9.5,
      consensusConfidence: 0.9,
    });
    const cold = scoreV2(candidate, buildTasteProfiles([]));
    const warm = scoreV2(
      candidate,
      buildTasteProfiles([
        ...Array.from({ length: 15 }, (_, i) =>
          observation(`h${i}`, 3, {
            media: item(`h${i}`, {
              genres: genre("Horror"),
              tags: [tagged("Slasher")],
              credits: [{ role: "DIRECTOR", contributor: { id: "carpenter", name: "Carpenter" } }],
            }),
          }),
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
      humanReason({ signal: "similarity", value: 80, because: { id: "x", title: "Cure", rating: 9, direction: "above", similarity: 0.6 } }, names),
    ).toBe("Because you rated Cure 9/10");
    expect(
      humanReason({ signal: "theme", value: 70, feature: { label: "Slow burn", direction: "above" } }, names),
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
    ).toBe("Anna, whose taste matches yours 77%, rated it 8.5/10");
    expect(humanReason({ signal: "consensus", value: 100, critic: { score: 9.5 } }, names)).toBe("Critics love it, 9.5/10");
    expect(humanReason({ signal: "consensus", value: null }, names)).toBeNull();
  });

  it("prefers a personal reason over critics when it carries real weight", () => {
    const profiles = buildTasteProfiles([
      ...Array.from({ length: 3 }, (_, i) =>
        observation(`loved${i}`, 10, {
          media: item(`loved${i}`, {
            genres: genre("Horror"),
            tags: [tagged("Slasher")],
            credits: [{ role: "DIRECTOR", contributor: { id: "craven", name: "Craven" } }],
          }),
        }),
      ),
      observation("loved", 10, {
        media: item("loved", {
          genres: genre("Horror"),
          tags: [tagged("Slasher")],
          credits: [{ role: "DIRECTOR", contributor: { id: "craven", name: "Craven" } }],
        }),
      }),
      ...Array.from({ length: 8 }, (_, i) =>
        observation(`mid${i}`, 6.5, { media: item(`mid${i}`, { genres: genre("Drama") }) }),
      ),
    ]);
    const result = scoreV2(
      item("c", {
        genres: genre("Horror"),
        tags: [tagged("Slasher")],
        credits: [{ role: "DIRECTOR", contributor: { id: "craven", name: "Craven" } }],
        computedConsensusScore: 9,
        consensusConfidence: 0.9,
      }),
      profiles,
    );
    expect(result.reason).toMatch(/^Because you rated loved\d? 10\/10$/);
  });
});

describe("v2 explaining title", () => {
  it("names the closest title honestly, even when the viewer rated it below average", () => {
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
    // The dud shares both tags; the gems share one. Closest wins the caption,
    // and the wording says the viewer did not love it.
    expect(similarity.because?.title).toBe("dud");
    expect(similarity.because?.direction).toBe("below");
    expect(humanReason(similarity)).toBe("Most like dud, which you rated 4/10");
  });
});

describe("contributor phrasing", () => {
  it("names the work by medium and role", () => {
    expect(contributorPhrase("MOVIE", "DIRECTOR", "Tony Scott")).toBe("films directed by Tony Scott");
    expect(contributorPhrase("TV_SHOW", "CREATOR", "X")).toBe("shows created by X");
    expect(contributorPhrase("VIDEO_GAME", "DEVELOPER", "Capcom")).toBe("games developed by Capcom");
    expect(contributorPhrase("VIDEO_GAME", "PUBLISHER", "X")).toBe("games published by X");
    expect(contributorPhrase("BOOK", "DIRECTOR", "X")).toBe("titles directed by X");
    expect(contributorPhrase("MOVIE", "WRITER", "X")).toBe("films by X");
  });

  it("uses the phrase in a contributor reason", () => {
    expect(
      humanReason({
        signal: "contributor",
        value: 70,
        feature: { label: "films directed by Tony Scott", direction: "above" },
      }),
    ).toBe("You usually rate films directed by Tony Scott above your average");
  });
});

describe("v2 split feature profiles", () => {
  const tag = (name: string, category: string) => ({
    tag: { name, status: "APPROVED", category },
  });
  const learn = (media: V2Item) =>
    buildTasteProfiles([observation(media.id, 10, { media })]).get("MOVIE")!;
  const signalOf = (candidate: V2Item, profile: ReturnType<typeof learn>, key: string) =>
    scoreV2(candidate, new Map([["MOVIE", profile]])).explanations.find(
      (e) => e.signal === key,
    )!;

  it("feeds a SUBGENRE tag to the subgenre signal and not to theme", () => {
    const media = item("a", { genres: [], tags: [tag("Slasher", "SUBGENRE")] });
    const profile = learn(media);
    expect(profile.subgenres.has("Slasher")).toBe(true);
    expect(profile.themes.has("Slasher")).toBe(false);
    expect(signalOf(media, profile, "subgenre").value).not.toBeNull();
    expect(signalOf(media, profile, "theme").value).toBeNull();
  });

  it("feeds any other approved tag to the theme signal", () => {
    const media = item("a", { genres: [], tags: [tag("Slow burn", "THEME")] });
    const profile = learn(media);
    expect(profile.themes.has("Slow burn")).toBe(true);
    expect(profile.subgenres.has("Slow burn")).toBe(false);
    expect(signalOf(media, profile, "theme").value).not.toBeNull();
    expect(signalOf(media, profile, "subgenre").value).toBeNull();
  });

  it("feeds an ACTOR credit to cast and not to contributor", () => {
    const actor = { role: "ACTOR", contributor: { id: "p1", name: "Star" } };
    const media = item("a", { genres: [], credits: [actor] });
    const profile = learn(media);
    expect(profile.cast.size).toBe(1);
    expect(profile.contributors.size).toBe(0);
    expect(signalOf(media, profile, "cast").value).not.toBeNull();
    expect(signalOf(media, profile, "contributor").value).toBeNull();
  });

  it("feeds a DIRECTOR credit to contributor and not to cast", () => {
    const director = { role: "DIRECTOR", contributor: { id: "p1", name: "Auteur" } };
    const media = item("a", { genres: [], credits: [director] });
    const profile = learn(media);
    expect(profile.contributors.size).toBe(1);
    expect(profile.cast.size).toBe(0);
    expect(signalOf(media, profile, "contributor").value).not.toBeNull();
    expect(signalOf(media, profile, "cast").value).toBeNull();
  });

  it("feeds the release era to the era signal", () => {
    const media = item("a", { genres: [], releaseDate: "2015-06-01" });
    const profile = learn(media);
    expect(profile.eras.has("2010-2019")).toBe(true);
    expect(signalOf(media, profile, "era").value).toBeGreaterThan(50);
    const other = item("b", { genres: [], releaseDate: "1955-06-01" });
    expect(signalOf(other, profile, "era").value).toBeNull();
    expect(signalOf(item("c", { genres: [] }), profile, "era").value).toBeNull();
  });
});

describe("v2 eraMix", () => {
  const dated = (id: string, releaseDate: string | null) => item(id, { releaseDate });
  // A catalog that is 20% 2010s and 80% 1990-2009.
  const catalog: EraContext = buildEraContext([
    ...Array.from({ length: 8 }, (_, i) => ({
      mediaType: "MOVIE",
      releaseDate: `199${i}-01-01`,
      computedConsensusScore: null,
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      mediaType: "MOVIE",
      releaseDate: `201${i}-01-01`,
      computedConsensusScore: null,
    })),
  ]);
  const exposure = (counts: Array<[EraKey, number]>): EraExposure =>
    new Map([
      [
        "MOVIE",
        {
          counts: new Map(counts),
          total: counts.reduce((sum, [, n]) => sum + n, 0),
        },
      ],
    ]);
  const recentHeavy = exposure([["2010-2019", 18], ["1990-2009", 2]]);

  it("is unknown without a date, an era context or exposure", () => {
    expect(eraMixSignal(dated("x", null), catalog, recentHeavy).value).toBeNull();
    expect(eraMixSignal(dated("x", "2015-01-01"), undefined, recentHeavy).value).toBeNull();
    expect(eraMixSignal(dated("x", "2015-01-01"), catalog, undefined).value).toBeNull();
    expect(eraMixSignal(dated("x", "2015-01-01"), catalog, new Map()).value).toBeNull();
    // An era the catalog has nothing in has no yardstick.
    expect(eraMixSignal(dated("x", "1950-01-01"), catalog, recentHeavy).value).toBeNull();
  });

  it("rises above 50 for over-represented eras and falls below it for under-represented ones", () => {
    const over = eraMixSignal(dated("x", "2015-01-01"), catalog, recentHeavy);
    const under = eraMixSignal(dated("y", "1995-01-01"), catalog, recentHeavy);
    expect(over.value).toBeGreaterThan(50);
    expect(under.value).toBeLessThan(50);
    expect(over.feature?.direction).toBe("above");
    expect(under.feature?.direction).toBe("below");
  });

  it("is neutral when the viewer's mix matches the catalog", () => {
    const matching = exposure([["2010-2019", 4], ["1990-2009", 16]]);
    const signal = eraMixSignal(dated("x", "2015-01-01"), catalog, matching);
    expect(signal.value).toBeCloseTo(50, 5);
    expect(signal.feature?.direction).toBe("around");
  });

  it("never swings further than maxSwing", () => {
    const { maxSwing } = RECOMMENDATION_V2.eraMix;
    const rare: EraContext = buildEraContext([
      ...Array.from({ length: 99 }, () => ({
        mediaType: "MOVIE",
        releaseDate: "1995-01-01",
        computedConsensusScore: null,
      })),
      { mediaType: "MOVIE", releaseDate: "2015-01-01", computedConsensusScore: null },
    ]);
    const extremeUp = eraMixSignal(dated("x", "2015-01-01"), rare, exposure([["2010-2019", 1000]]));
    const extremeDown = eraMixSignal(dated("y", "1995-01-01"), rare, exposure([["2010-2019", 1000]]));
    expect(extremeUp.value).toBeCloseTo(50 + maxSwing, 10);
    expect(extremeDown.value).toBeCloseTo(50 - maxSwing, 10);
  });

  it("grows more reliable with library size", () => {
    const reliability = (n: number) =>
      eraMixSignal(dated("x", "2015-01-01"), catalog, exposure([["2010-2019", n]])).reliability;
    expect(reliability(2)).toBeLessThan(reliability(20));
    expect(reliability(20)).toBeLessThan(reliability(200));
    expect(reliability(200)).toBeLessThan(1);
  });

  it("explains itself only when the era is over-represented", () => {
    const over = eraMixSignal(dated("x", "2015-01-01"), catalog, recentHeavy);
    const under = eraMixSignal(dated("y", "1995-01-01"), catalog, recentHeavy);
    expect(humanReason({ signal: "eraMix", ...over })).toBe(
      "You watch a lot of films from the 2010s",
    );
    expect(humanReason({ signal: "eraMix", ...under })).toBeNull();
    expect(humanReason({ signal: "eraMix", value: null })).toBeNull();
  });
});

describe("v2 consensus", () => {
  const critic = (score: number | null, releaseDate: string | null = null) =>
    item("c", {
      computedConsensusScore: score,
      consensusConfidence: 0.8,
      releaseDate,
    });
  const eras = buildEraContext([
    { mediaType: "MOVIE", releaseDate: "1950-01-01", computedConsensusScore: 8.9 },
    { mediaType: "MOVIE", releaseDate: "2015-01-01", computedConsensusScore: 6.5 },
  ]);

  it("uses the catalog neutral when there is no era context", () => {
    const { consensusNeutral, consensusPointScale } = RECOMMENDATION_V2;
    expect(consensusSignal(critic(consensusNeutral)).value).toBe(50);
    expect(consensusSignal(critic(consensusNeutral), eras).value).toBe(50); // undated
    expect(consensusSignal(critic(9)).value).toBe(50 + (9 - consensusNeutral) * consensusPointScale);
    expect(consensusSignal(critic(9, "1950-01-01")).value).toBe(
      consensusSignal(critic(9)).value,
    );
    expect(consensusSignal(critic(null)).value).toBeNull();
  });

  it("judges a critic score against the era's mean", () => {
    const classic = consensusSignal(critic(9.0, "1950-01-01"), eras).value!;
    const recent = consensusSignal(critic(9.0, "2015-01-01"), eras).value!;
    expect(classic).toBeLessThan(recent);
    expect(classic).toBeLessThan(consensusSignal(critic(9.0)).value!);
    expect(recent).toBeGreaterThan(consensusSignal(critic(9.0)).value!);
  });

  it("exposes the critic score and reasons from it", () => {
    const signal = consensusSignal(critic(9.0, "1950-01-01"), eras);
    expect(signal.critic?.score).toBe(9);
    expect(signal.reliability).toBe(0.8);
    expect(humanReason({ signal: "consensus", ...signal })).toBe("Critics love it, 9.0/10");
    // The reason follows the raw score, not the era-adjusted value.
    expect(
      humanReason({ signal: "consensus", value: 10, critic: { score: 6.5 } }),
    ).toBe("Critics are lukewarm, 6.5/10");
  });
});

describe("v2 confidence bound", () => {
  it("stays within 0-1 even with strong evidence on every signal", () => {
    const tag = (name: string, category: string) => ({
      tag: { name, status: "APPROVED", category },
    });
    const features = {
      genres: genre("Horror"),
      tags: [tag("Slasher", "SUBGENRE"), tag("Dread", "MOOD")],
      credits: [
        { role: "DIRECTOR", contributor: { id: "d", name: "Auteur" } },
        { role: "ACTOR", contributor: { id: "a", name: "Star" } },
      ],
      releaseDate: "2015-01-01",
      computedConsensusScore: 9,
      consensusConfidence: 1,
    };
    const profiles = buildTasteProfiles(
      Array.from({ length: 200 }, (_, i) =>
        observation(`r${i}`, 10, { media: item(`r${i}`, features) }),
      ),
    );
    const eras = buildEraContext(
      Array.from({ length: 50 }, (_, i) => ({
        mediaType: "MOVIE",
        releaseDate: i % 2 ? "2015-01-01" : "1995-01-01",
        computedConsensusScore: 7,
      })),
    );
    const exposure: EraExposure = new Map([
      ["MOVIE", { counts: new Map<EraKey, number>([["2010-2019", 100000]]), total: 100000 }],
    ]);
    const full = { value: 100, reliability: 1, evidence: 10, detail: "" };
    const result = scoreV2(item("candidate", features), profiles, full, {
      twins: full,
      eras,
      exposure,
    });
    for (const e of result.explanations) expect(e.value).not.toBeNull();
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
