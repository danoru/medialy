import type { MediaType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildRatingHistogram,
  lensShares,
  mergeActivity,
  relativeLabel,
  topGenres,
  type ProfileTile,
} from "./profile";

function tile(id: string, mediaType: MediaType = "MOVIE"): ProfileTile {
  return { id, title: id, mediaType, posterUrl: null, releaseDate: null };
}

describe("buildRatingHistogram", () => {
  it("skips null ratings and buckets the rest, with a rounded average", () => {
    const result = buildRatingHistogram([
      { rating: 8.5, consensus: null },
      { rating: 0.2, consensus: null },
      { rating: 10, consensus: null },
      { rating: null, consensus: 5 },
    ]);
    const expected = new Array(10).fill(0);
    expected[8] = 1; // 8.5 rounds to 9
    expected[0] = 1; // 0.2 floors to the first bucket
    expected[9] = 1; // 10 is the last bucket
    expect(result.buckets).toEqual(expected);
    expect(result.count).toBe(3);
    expect(result.average).toBe(6.2); // (8.5 + 0.2 + 10) / 3 = 6.2333...
    // the only row with a consensus also had a null rating, so it never
    // enters the delta calculation
    expect(result.consensusDelta).toBeNull();
  });

  it("averages (rating - consensus) only over rows that have both", () => {
    const result = buildRatingHistogram([
      { rating: 9, consensus: 7 }, // delta 2
      { rating: 7, consensus: 8 }, // delta -1
      { rating: 5, consensus: null }, // no consensus, ignored for delta
    ]);
    expect(result.consensusDelta).toBe(0.5); // (2 + -1) / 2
  });

  it("returns ten zero buckets and nulls for empty input", () => {
    const result = buildRatingHistogram([]);
    expect(result.buckets).toEqual(new Array(10).fill(0));
    expect(result.count).toBe(0);
    expect(result.average).toBeNull();
    expect(result.consensusDelta).toBeNull();
  });
});

describe("lensShares", () => {
  it("sums per-lens counts, drops zeros and OVERALL, and sorts strongest first", () => {
    const result = lensShares([
      { context: "STORY", count: 6 },
      { context: "STORY", count: 4 }, // sums with the entry above -> 10
      { context: "VISUALS", count: 5 },
      { context: "MUSIC", count: 0 },
      { context: "REWATCHABILITY", count: 3 },
      { context: "COMFORT", count: 0 },
      { context: "SOCIAL", count: 2 },
      { context: null, count: 100 }, // OVERALL, ignored
    ]);
    // total across the seven lenses = 10 + 5 + 0 + 0 + 3 + 0 + 2 = 20
    expect(result).toEqual([
      { label: "Story", count: 10, share: 50 },
      { label: "Visuals", count: 5, share: 25 },
      { label: "Rewatch", count: 3, share: 15 },
      { label: "Social", count: 2, share: 10 },
    ]);
  });

  it("returns an empty list when there are no counted comparisons", () => {
    expect(lensShares([])).toEqual([]);
    expect(lensShares([{ context: null, count: 5 }])).toEqual([]);
  });
});

describe("mergeActivity", () => {
  const library = [
    {
      // rated + completed movie -> one "rated" event, type-aware label
      status: "COMPLETED" as const,
      personalRating: 8,
      updatedAt: new Date("2026-09-10T00:00:00Z"),
      media: tile("m1", "MOVIE"),
    },
    {
      // rated + completed game -> "Played", string date
      status: "COMPLETED" as const,
      personalRating: 9,
      updatedAt: "2026-09-11T00:00:00Z",
      media: tile("m2", "VIDEO_GAME"),
    },
    {
      // rated but untracked -> statusLabel is null
      status: "UNTRACKED" as const,
      personalRating: 5,
      updatedAt: new Date("2026-09-09T00:00:00Z"),
      media: tile("m3", "MOVIE"),
    },
    {
      // completed, unrated -> "completed" event
      status: "COMPLETED" as const,
      personalRating: null,
      updatedAt: new Date("2026-09-08T00:00:00Z"),
      media: tile("m4", "BOOK"),
    },
    {
      // neither rated nor completed -> no event at all
      status: "WATCHLIST" as const,
      personalRating: null,
      updatedAt: new Date("2026-09-20T00:00:00Z"),
      media: tile("m5", "MOVIE"),
    },
  ];

  const comparisons = [
    {
      id: "c1",
      createdAt: new Date("2026-09-12T00:00:00Z"),
      context: "STORY" as const,
      winner: tile("w1"),
      loser: tile("l1"),
    },
    {
      id: "c2",
      createdAt: "2026-09-07T00:00:00Z",
      context: null,
      winner: tile("w2"),
      loser: tile("l2"),
    },
  ];

  it("builds rated/completed/compared events with the right labels", () => {
    const events = mergeActivity(library, comparisons, 10);
    expect(events.map((e) => e.id)).toEqual([
      "compared:c1",
      "rated:m2",
      "rated:m1",
      "rated:m3",
      "completed:m4",
      "compared:c2",
    ]);
    expect(events).toHaveLength(6);

    const rated1 = events.find((e) => e.id === "rated:m1");
    expect(rated1).toMatchObject({ kind: "rated", rating: 8, statusLabel: "Watched" });

    const rated2 = events.find((e) => e.id === "rated:m2");
    expect(rated2).toMatchObject({ kind: "rated", rating: 9, statusLabel: "Played" });

    const rated3 = events.find((e) => e.id === "rated:m3");
    expect(rated3).toMatchObject({ kind: "rated", rating: 5, statusLabel: null });

    const completed4 = events.find((e) => e.id === "completed:m4");
    expect(completed4).toMatchObject({ kind: "completed", statusLabel: "Read" });

    const compared1 = events.find((e) => e.id === "compared:c1");
    expect(compared1).toMatchObject({ kind: "compared", lens: "Story" });

    const compared2 = events.find((e) => e.id === "compared:c2");
    expect(compared2).toMatchObject({ kind: "compared", lens: null });
  });

  it("sorts newest first across mixed string/Date timestamps and respects the limit", () => {
    const limited = mergeActivity(library, comparisons, 2);
    expect(limited.map((e) => e.id)).toEqual(["compared:c1", "rated:m2"]);
  });

  it("defaults the limit to 5", () => {
    const events = mergeActivity(library, comparisons);
    expect(events).toHaveLength(5);
    expect(events.map((e) => e.id)).not.toContain("compared:c2");
  });

  it("dates a completed, unrated row by completedAt, not updatedAt", () => {
    const events = mergeActivity(
      [
        {
          status: "COMPLETED" as const,
          personalRating: null,
          updatedAt: new Date("2026-09-01T00:00:00Z"),
          completedAt: new Date("2026-09-10T00:00:00Z"),
          media: tile("c1", "MOVIE"),
        },
      ],
      [],
      10,
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "completed",
      id: "completed:c1",
      occurredAt: new Date("2026-09-10T00:00:00Z"),
      statusLabel: "Watched",
    });
  });

  it("emits both a rated and a completed event when a row has both a rating and completedAt", () => {
    const events = mergeActivity(
      [
        {
          status: "COMPLETED" as const,
          personalRating: 7,
          updatedAt: new Date("2026-09-01T00:00:00Z"),
          completedAt: new Date("2026-09-10T00:00:00Z"),
          media: tile("c2", "VIDEO_GAME"),
        },
      ],
      [],
      10,
    );
    expect(events.map((e) => e.id).sort()).toEqual(["completed:c2", "rated:c2"]);

    const rated = events.find((e) => e.id === "rated:c2");
    expect(rated).toMatchObject({
      kind: "rated",
      occurredAt: new Date("2026-09-01T00:00:00Z"),
      rating: 7,
      statusLabel: "Played",
    });

    const completed = events.find((e) => e.id === "completed:c2");
    expect(completed).toMatchObject({
      kind: "completed",
      occurredAt: new Date("2026-09-10T00:00:00Z"),
      statusLabel: "Played",
    });
  });

  it("yields only a rated event when a rated row has no completedAt (undefined or null)", () => {
    const eventsUndefined = mergeActivity(
      [
        {
          status: "COMPLETED" as const,
          personalRating: 6,
          updatedAt: new Date("2026-09-01T00:00:00Z"),
          media: tile("c3", "BOOK"),
        },
      ],
      [],
      10,
    );
    expect(eventsUndefined.map((e) => e.id)).toEqual(["rated:c3"]);

    const eventsNull = mergeActivity(
      [
        {
          status: "COMPLETED" as const,
          personalRating: 6,
          updatedAt: new Date("2026-09-01T00:00:00Z"),
          completedAt: null,
          media: tile("c4", "BOOK"),
        },
      ],
      [],
      10,
    );
    expect(eventsNull.map((e) => e.id)).toEqual(["rated:c4"]);
  });

  it("falls back to updatedAt for a completed, unrated row with no completedAt (legacy rows)", () => {
    const events = mergeActivity(
      [
        {
          status: "COMPLETED" as const,
          personalRating: null,
          updatedAt: new Date("2026-09-05T00:00:00Z"),
          media: tile("c5", "MOVIE"),
        },
      ],
      [],
      10,
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "completed",
      id: "completed:c5",
      occurredAt: new Date("2026-09-05T00:00:00Z"),
      statusLabel: "Watched",
    });
  });

  it("sorts a two-year-old completion after a rating from yesterday, regardless of array order", () => {
    const oldCompletion = {
      status: "COMPLETED" as const,
      personalRating: null,
      updatedAt: new Date("2024-09-15T00:00:00Z"),
      completedAt: new Date("2024-09-15T00:00:00Z"), // two years before "now" (2026-09-15)
      media: tile("old", "MOVIE"),
    };
    const recentRating = {
      status: "COMPLETED" as const,
      personalRating: 8,
      updatedAt: new Date("2026-09-14T00:00:00Z"), // yesterday
      media: tile("recent", "MOVIE"),
    };

    const eventsOldFirst = mergeActivity([oldCompletion, recentRating], [], 10);
    expect(eventsOldFirst.map((e) => e.id)).toEqual(["rated:recent", "completed:old"]);

    const eventsRecentFirst = mergeActivity([recentRating, oldCompletion], [], 10);
    expect(eventsRecentFirst.map((e) => e.id)).toEqual(["rated:recent", "completed:old"]);
  });
});

describe("topGenres", () => {
  const rows = [
    { genres: ["Action", "Drama"] },
    { genres: ["Action"] },
    { genres: ["Drama"] },
    { genres: ["Comedy"] },
    { genres: ["Zeta"] },
  ];

  it("counts genres and breaks ties alphabetically", () => {
    // Action and Drama both count 2 (Action < Drama); Comedy and Zeta both
    // count 1 (Comedy < Zeta)
    expect(topGenres(rows)).toEqual(["Action", "Drama", "Comedy"]);
  });

  it("respects the limit", () => {
    expect(topGenres(rows, 1)).toEqual(["Action"]);
    expect(topGenres(rows, 2)).toEqual(["Action", "Drama"]);
  });

  it("returns an empty list for rows with no genres", () => {
    expect(topGenres([{ genres: [] }, { genres: [] }])).toEqual([]);
  });
});

describe("relativeLabel", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  const secondsAgo = (s: number) => new Date(now.getTime() - s * 1000);

  it("just now, for anything under a minute", () => {
    expect(relativeLabel(secondsAgo(10), now)).toBe("just now");
  });

  it("minutes", () => {
    expect(relativeLabel(secondsAgo(5 * 60), now)).toBe("5m ago");
  });

  it("hours", () => {
    expect(relativeLabel(secondsAgo(2 * 3600), now)).toBe("2h ago");
  });

  it("days, under a week", () => {
    expect(relativeLabel(secondsAgo(3 * 86400), now)).toBe("3d ago");
  });

  it("weeks, under 30 days", () => {
    expect(relativeLabel(secondsAgo(14 * 86400), now)).toBe("2w ago");
  });

  it("months", () => {
    expect(relativeLabel(secondsAgo(60 * 86400), now)).toBe("2mo ago");
  });

  it("years", () => {
    expect(relativeLabel(secondsAgo(400 * 86400), now)).toBe("1y ago");
  });

  it("also accepts a string date", () => {
    expect(relativeLabel(now.toISOString(), now)).toBe("just now");
  });
});
