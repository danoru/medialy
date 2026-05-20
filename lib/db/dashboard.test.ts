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
  it("uses blended quality score instead of recommendation score", () => {
    const grouped = getDashboardOverallTopItemsByMediaType([
      media("steady-quality", "MOVIE", "WATCHLIST", {
        computedConsensusScore: 9,
        computedPersonalScore: 8,
      }),
      media("affinity-only", "MOVIE", "WATCHLIST", {
        computedConsensusScore: 6,
        computedPersonalScore: 6,
      }),
    ]);

    expect(grouped.find((entry) => entry.mediaType === "MOVIE")?.items).toEqual(
      [
        {
          media: media("steady-quality", "MOVIE", "WATCHLIST", {
            computedConsensusScore: 9,
            computedPersonalScore: 8,
          }),
          score: 8.5,
        },
        {
          media: media("affinity-only", "MOVIE", "WATCHLIST", {
            computedConsensusScore: 6,
            computedPersonalScore: 6,
          }),
          score: 6,
        },
      ],
    );
  });

  it("includes active visible items regardless of recommendation status", () => {
    const grouped = getDashboardOverallTopItemsByMediaType([
      media("watchlist", "TV_SHOW", "WATCHLIST", {
        computedPersonalScore: 8,
      }),
      media("completed", "TV_SHOW", "COMPLETED", {
        computedPersonalScore: 9,
      }),
      media("backlog", "TV_SHOW", "BACKLOG", {
        computedPersonalScore: 7,
      }),
    ]);

    expect(
      grouped.find((entry) => entry.mediaType === "TV_SHOW")?.items.map(
        (entry) => entry.media.id,
      ),
    ).toEqual(["completed", "watchlist", "backlog"]);
  });

  it("excludes items without computed personal or consensus scores", () => {
    const grouped = getDashboardOverallTopItemsByMediaType([
      media("personal", "MOVIE", "WATCHLIST", {
        computedPersonalScore: 8,
      }),
      media("consensus", "MOVIE", "WATCHLIST", {
        computedConsensusScore: 7.5,
      }),
      media("explicit-only", "MOVIE", "WATCHLIST", {
        personalRating: 10,
      }),
      media("pairwise-only", "MOVIE", "WATCHLIST", {
        pairwiseScore: 1400,
      }),
    ]);

    expect(
      grouped.find((entry) => entry.mediaType === "MOVIE")?.items.map(
        (entry) => entry.media.id,
      ),
    ).toEqual(["personal", "consensus"]);
  });

  it("returns null for quality score when computed scores are missing", () => {
    expect(
      dashboardQualityScore(
        media("rating", "MOVIE", "WATCHLIST", { personalRating: 7.5 }),
      ),
    ).toBeNull();
    expect(dashboardQualityScore(media("pairwise", "MOVIE"))).toBeNull();
  });

  it("excludes archived and hidden media types", () => {
    const grouped = getDashboardOverallTopItemsByMediaType([
      media("active", "VIDEO_GAME", "WATCHLIST", {
        computedPersonalScore: 7,
      }),
      media("archived", "VIDEO_GAME", "WATCHLIST", {
        computedPersonalScore: 10,
        isArchived: true,
      }),
      media("hidden", "BOOK" as MediaItemDTO["mediaType"], "WATCHLIST", {
        computedPersonalScore: 10,
      }),
    ]);

    expect(
      grouped.find((entry) => entry.mediaType === "VIDEO_GAME")?.items.map(
        (entry) => entry.media.id,
      ),
    ).toEqual(["active"]);
    expect(grouped.map((entry) => entry.mediaType)).toEqual([
      "MOVIE",
      "TV_SHOW",
      "VIDEO_GAME",
    ]);
  });

  it("groups by movies, tv, and games and caps each group at ten", () => {
    const grouped = getDashboardOverallTopItemsByMediaType([
      Array.from({ length: 12 }, (_, index) =>
        media(`movie-${index}`, "MOVIE", "WATCHLIST", {
          computedPersonalScore: 10 - index * 0.1,
        }),
      ),
      media("tv", "TV_SHOW", "WATCHLIST", { computedPersonalScore: 8 }),
      media("game", "VIDEO_GAME", "WATCHLIST", { computedPersonalScore: 8 }),
    ].flat());

    expect(
      grouped.find((entry) => entry.mediaType === "MOVIE")?.items,
    ).toHaveLength(10);
    expect(grouped.find((entry) => entry.mediaType === "TV_SHOW")?.items).toHaveLength(
      1,
    );
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
