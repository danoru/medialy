import { describe, expect, it } from "vitest";
import {
  dashboardQualityScore,
  getDashboardOverallTopItemsByMediaType,
  getDashboardTopRecommendationsByMediaType,
  getDashboardTonightPicksByMediaType,
  dashboardUpcomingOrderBy,
  getDashboardUpcomingWhere,
} from "@/lib/db/dashboard";
import type { MediaItemDTO, Recommendation } from "@/lib/types";

function media(
  id: string,
  mediaType: MediaItemDTO["mediaType"],
  status: MediaItemDTO["status"] = "UNTRACKED",
  overrides: Partial<MediaItemDTO> = {},
): MediaItemDTO {
  return {
    id,
    title: id,
    mediaType,
    status,
    pairwiseScore: 1000,
    comparisonCount: 0,
    isFavorite: false,
    isArchived: false,
    genres: [],
    tags: [],
    ...overrides,
  };
}

function recommendation(
  id: string,
  mediaType: MediaItemDTO["mediaType"],
  score: number,
): Recommendation {
  return {
    media: media(id, mediaType),
    score,
    confidence: 0,
    reasons: [],
  };
}

describe("dashboard upcoming query", () => {
  it("selects the next non-archived upcoming items without status filtering", () => {
    const today = new Date("2026-05-13T00:00:00");

    expect(getDashboardUpcomingWhere(today)).toEqual({
      mediaType: { in: ["MOVIE", "TV_SHOW", "VIDEO_GAME"] },
      releaseDate: { gte: today },
    });
  });

  it("sorts upcoming dashboard items by date, then title", () => {
    expect(dashboardUpcomingOrderBy).toEqual([
      { releaseDate: "asc" },
      { title: "asc" },
    ]);
  });
});

describe("dashboard recommendation top 10", () => {
  it("keeps the legacy recommendation grouping capped by media type", () => {
    const grouped = getDashboardTopRecommendationsByMediaType(
      Array.from({ length: 12 }, (_, index) =>
        recommendation(`movie-${index}`, "MOVIE", 100 - index),
      ),
    );

    expect(
      grouped.find((entry) => entry.mediaType === "MOVIE")?.items,
    ).toHaveLength(10);
  });
});

describe("dashboard overall top 10", () => {
  it("blends external consensus with the community average rating", () => {
    const grouped = getDashboardOverallTopItemsByMediaType(
      [
        media("steady-quality", "MOVIE", "WATCHLIST", {
          computedConsensusScore: 9,
        }),
        media("lower-quality", "MOVIE", "WATCHLIST", {
          computedConsensusScore: 6,
        }),
      ],
      new Map([
        ["steady-quality", 8],
        ["lower-quality", 6],
      ]),
    );

    expect(grouped.find((entry) => entry.mediaType === "MOVIE")?.items).toEqual(
      [
        {
          media: media("steady-quality", "MOVIE", "WATCHLIST", {
            computedConsensusScore: 9,
          }),
          score: 8.5,
        },
        {
          media: media("lower-quality", "MOVIE", "WATCHLIST", {
            computedConsensusScore: 6,
          }),
          score: 6,
        },
      ],
    );
  });

  it("ignores per-viewer state (status, archived, personal score)", () => {
    // The viewer-specific fields on the DTO must not affect either inclusion
    // or ordering — same ranking for every user.
    const grouped = getDashboardOverallTopItemsByMediaType(
      [
        media("viewer-completed", "TV_SHOW", "COMPLETED", {
          computedConsensusScore: 9,
          computedPersonalScore: 1,
        }),
        media("viewer-archived", "TV_SHOW", "WATCHLIST", {
          computedConsensusScore: 8,
          isArchived: true,
        }),
        media("viewer-untracked", "TV_SHOW", "UNTRACKED", {
          computedConsensusScore: 7,
        }),
      ],
      new Map(),
    );

    expect(
      grouped
        .find((entry) => entry.mediaType === "TV_SHOW")
        ?.items.map((entry) => entry.media.id),
    ).toEqual(["viewer-completed", "viewer-archived", "viewer-untracked"]);
  });

  it("excludes items with neither consensus nor community rating", () => {
    const grouped = getDashboardOverallTopItemsByMediaType(
      [
        media("consensus-only", "MOVIE", "WATCHLIST", {
          computedConsensusScore: 7.5,
        }),
        media("community-only", "MOVIE", "WATCHLIST"),
        media("no-signal", "MOVIE", "WATCHLIST", {
          // Viewer personal score must NOT rescue an item missing both objective signals.
          computedPersonalScore: 9,
        }),
        media("pairwise-only", "MOVIE", "WATCHLIST", {
          pairwiseScore: 1400,
        }),
      ],
      new Map([["community-only", 8]]),
    );

    expect(
      grouped
        .find((entry) => entry.mediaType === "MOVIE")
        ?.items.map((entry) => entry.media.id),
    ).toEqual(["community-only", "consensus-only"]);
  });

  it("returns null quality score when both objective signals are missing", () => {
    expect(dashboardQualityScore(null, null)).toBeNull();
    expect(dashboardQualityScore(undefined, undefined)).toBeNull();
    expect(dashboardQualityScore(8, null)).toBe(8);
    expect(dashboardQualityScore(null, 6)).toBe(6);
    expect(dashboardQualityScore(8, 6)).toBe(7);
  });

  it("filters out hidden media types but keeps visible groups", () => {
    const grouped = getDashboardOverallTopItemsByMediaType(
      [
        media("game", "VIDEO_GAME", "WATCHLIST", {
          computedConsensusScore: 7,
        }),
        media("hidden", "BOOK" as MediaItemDTO["mediaType"], "WATCHLIST", {
          computedConsensusScore: 10,
        }),
      ],
      new Map(),
    );

    expect(
      grouped
        .find((entry) => entry.mediaType === "VIDEO_GAME")
        ?.items.map((entry) => entry.media.id),
    ).toEqual(["game"]);
    expect(grouped.map((entry) => entry.mediaType)).toEqual([
      "MOVIE",
      "TV_SHOW",
      "VIDEO_GAME",
    ]);
  });

  it("groups by movies, tv, and games and caps each group at ten", () => {
    const grouped = getDashboardOverallTopItemsByMediaType(
      [
        Array.from({ length: 12 }, (_, index) =>
          media(`movie-${index}`, "MOVIE", "WATCHLIST", {
            computedConsensusScore: 10 - index * 0.1,
          }),
        ),
        media("tv", "TV_SHOW", "WATCHLIST", { computedConsensusScore: 8 }),
        media("game", "VIDEO_GAME", "WATCHLIST", {
          computedConsensusScore: 8,
        }),
      ].flat(),
      new Map(),
    );

    expect(
      grouped.find((entry) => entry.mediaType === "MOVIE")?.items,
    ).toHaveLength(10);
    expect(
      grouped.find((entry) => entry.mediaType === "TV_SHOW")?.items,
    ).toHaveLength(1);
    expect(
      grouped.find((entry) => entry.mediaType === "VIDEO_GAME")?.items,
    ).toHaveLength(1);
  });
});

describe("dashboard tonight picks", () => {
  it("uses the top five personalized recommendations for each media type", () => {
    const moviePick = recommendation("movie-1", "MOVIE", 96);
    const gamePick = recommendation("game-1", "VIDEO_GAME", 93);
    const grouped = getDashboardTonightPicksByMediaType([
      moviePick,
      recommendation("movie-2", "MOVIE", 91),
      gamePick,
    ]);

    expect(
      grouped.find((entry) => entry.mediaType === "MOVIE")?.recommendations[0],
    ).toEqual(moviePick);
    expect(
      grouped.find((entry) => entry.mediaType === "MOVIE")?.recommendations[1],
    ).toEqual(recommendation("movie-2", "MOVIE", 91));
    expect(
      grouped.find((entry) => entry.mediaType === "VIDEO_GAME")
        ?.recommendations[0],
    ).toEqual(gamePick);
    expect(
      grouped.find((entry) => entry.mediaType === "TV_SHOW")?.recommendations,
    ).toEqual([]);
  });
});
