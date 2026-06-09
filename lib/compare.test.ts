import { describe, expect, it } from "vitest";
import {
  selectComparisonPair,
  type ComparisonSelectionItem,
} from "@/lib/compare";

function item(
  id: string,
  mediaType: ComparisonSelectionItem["mediaType"],
  genres: string[] = [],
): ComparisonSelectionItem {
  return {
    id,
    mediaType,
    status: "COMPLETED",
    personalRating: null,
    comparisonCount: 0,
    pairwiseScore: 1000,
    releaseDate: null,
    posterUrl: null,
    genres: genres.map((name) => ({ genre: { name } })),
  };
}

function pairIds(
  pair: readonly [ComparisonSelectionItem, ComparisonSelectionItem] | null,
) {
  return pair
    ?.map((entry) => entry.id)
    .sort()
    .join("::");
}

describe("comparison selection", () => {
  it("never selects pairs across media types", () => {
    const pair = selectComparisonPair(
      [item("game", "VIDEO_GAME"), item("movie", "MOVIE")],
      [],
      { random: () => 0 },
    );

    expect(pair).toBeNull();
  });

  it("only selects experienced statuses (not untracked/not-interested/watchlist/backlog)", () => {
    const watchlist = {
      ...item("watchlist", "MOVIE", ["Drama"]),
      status: "WATCHLIST" as const,
    };
    const backlog = {
      ...item("backlog", "MOVIE", ["Drama"]),
      status: "BACKLOG" as const,
    };
    const untracked = {
      ...item("untracked", "MOVIE", ["Drama"]),
      status: "UNTRACKED" as const,
    };
    const notInterested = {
      ...item("not-interested", "MOVIE", ["Drama"]),
      status: "NOT_INTERESTED" as const,
    };
    const completed = item("completed", "MOVIE", ["Drama"]);

    const pair = selectComparisonPair(
      [watchlist, backlog, untracked, notInterested, completed],
      [],
      { random: () => 0 },
    );

    // Only one eligible (COMPLETED) item remains, so no pair can be formed.
    expect(pair).toBeNull();
  });

  it("allows started-but-not-completed statuses as fallback", () => {
    const dropped = {
      ...item("dropped", "MOVIE", ["Drama"]),
      status: "DROPPED" as const,
    };
    const inProgress = {
      ...item("in-progress", "MOVIE", ["Drama"]),
      status: "IN_PROGRESS" as const,
    };

    const pair = selectComparisonPair([dropped, inProgress], [], {
      random: () => 0,
    });

    expect(pairIds(pair)).toBe("dropped::in-progress");
  });

  it("does not select unreleased items", () => {
    const currentDate = new Date("2026-05-16T12:00:00.000Z");
    const released = {
      ...item("released", "VIDEO_GAME", ["Action"]),
      releaseDate: new Date("2026-05-15T12:00:00.000Z"),
    };
    const future = {
      ...item("future", "VIDEO_GAME", ["Action"]),
      releaseDate: new Date("2026-05-17T12:00:00.000Z"),
    };

    const pair = selectComparisonPair([released, future], [], {
      currentDate,
      random: () => 0,
    });

    expect(pair).toBeNull();
  });

  it("keeps focused comparisons in the focused item's media type", () => {
    const pair = selectComparisonPair(
      [
        item("focus-game", "VIDEO_GAME", ["RPG"]),
        item("other-game", "VIDEO_GAME", ["RPG"]),
        item("movie", "MOVIE", ["RPG"]),
      ],
      [],
      { focusId: "focus-game", random: () => 0 },
    );

    expect(pairIds(pair)).toBe("focus-game::other-game");
  });

  it("prefers same-genre pairs when enough candidates exist", () => {
    const pair = selectComparisonPair(
      [
        item("action-1", "VIDEO_GAME", ["Action"]),
        item("action-2", "VIDEO_GAME", ["Action"]),
        item("action-3", "VIDEO_GAME", ["Action"]),
        item("puzzle", "VIDEO_GAME", ["Puzzle"]),
      ],
      [],
      { random: () => 0 },
    );

    expect(pair?.[0].genres[0]?.genre.name).toBe("Action");
    expect(pair?.[1].genres[0]?.genre.name).toBe("Action");
  });

  it("avoids recent pairs when alternatives exist", () => {
    const pair = selectComparisonPair(
      [
        item("first", "VIDEO_GAME"),
        item("second", "VIDEO_GAME"),
        item("third", "VIDEO_GAME"),
      ],
      [{ winnerId: "first", loserId: "second" }],
      { random: () => 0 },
    );

    expect(pairIds(pair)).not.toBe("first::second");
  });
});
