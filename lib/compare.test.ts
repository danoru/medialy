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
    comparisonCount: 0,
    pairwiseScore: 1000,
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

  it("does not select watchlist or backlog items", () => {
    const watchlist = {
      ...item("watchlist", "MOVIE", ["Drama"]),
      status: "WATCHLIST" as const,
    };
    const backlog = {
      ...item("backlog", "MOVIE", ["Drama"]),
      status: "BACKLOG" as const,
    };
    const completed = item("completed", "MOVIE", ["Drama"]);

    const pair = selectComparisonPair([watchlist, backlog, completed], [], {
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
