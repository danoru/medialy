import { describe, expect, it } from "vitest";
import {
  dashboardQualityScore,
  getDashboardOverallTopItemsByMediaType,
  getDashboardTopRecommendationsByMediaType,
  getDashboardTonightPicksByMediaType,
  dashboardUpcomingOrderBy,
  getDashboardUpcomingWhere,
  type CommunityRatingEvidence,
  type ConsensusEvidence,
  type OverallTopRankingContext,
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
  it("ranks broad-evidence items above thin-evidence outliers", () => {
    // A: one user rated 10, no critic sources. Should be heavily shrunk.
    // B: five users averaging 9, six critic sources averaging 9. Holds value.
    const grouped = getDashboardOverallTopItemsByMediaType(
      [
        media("thin-outlier", "MOVIE"),
        media("broad-consensus", "MOVIE", "UNTRACKED", {
          computedConsensusScore: 9,
        }),
      ],
      rankingContext(
        {
          "thin-outlier": { average: 10, voters: 1 },
          "broad-consensus": { average: 9, voters: 5 },
        },
        { "broad-consensus": { sources: 6 } },
        { community: 7.5, consensus: 7.5 },
      ),
    );

    const ids = grouped
      .find((entry) => entry.mediaType === "MOVIE")
      ?.items.map((entry) => entry.media.id);
    expect(ids).toEqual(["broad-consensus", "thin-outlier"]);
  });

  it("ignores per-viewer state (status, archived, personal score)", () => {
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
      rankingContext(),
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
          // Viewer personal score must NOT rescue an item with no objective signal.
          computedPersonalScore: 9,
        }),
        media("pairwise-only", "MOVIE", "WATCHLIST", { pairwiseScore: 1400 }),
      ],
      rankingContext(
        { "community-only": { average: 8, voters: 4 } },
        {},
        { community: 7, consensus: 7 },
      ),
    );

    const ids = grouped
      .find((entry) => entry.mediaType === "MOVIE")
      ?.items.map((entry) => entry.media.id);
    expect(ids).toEqual(["community-only", "consensus-only"]);
  });

  it("dashboardQualityScore returns null when both objective signals are missing", () => {
    expect(dashboardQualityScore(null, null, null, 7, 7)).toBeNull();
    expect(dashboardQualityScore(undefined, undefined, undefined, 7, 7)).toBeNull();
  });

  it("dashboardQualityScore pulls a 1-vote 10/10 toward the prior", () => {
    // With prior 7.5 and shrinkageK.user=3, 1 vote of 10 lands at ~8.13.
    const ranked = dashboardQualityScore(
      null,
      { average: 10, voters: 1 },
      null,
      7.5,
      7.5,
    );
    expect(ranked).not.toBeNull();
    expect(ranked!.score).toBeCloseTo(8.125, 5);
    expect(ranked!.evidence).toBe(1);
  });

  it("filters out hidden media types but keeps visible groups", () => {
    const grouped = getDashboardOverallTopItemsByMediaType(
      [
        media("game", "VIDEO_GAME", "WATCHLIST", { computedConsensusScore: 7 }),
        media("hidden", "BOOK" as MediaItemDTO["mediaType"], "WATCHLIST", {
          computedConsensusScore: 10,
        }),
      ],
      rankingContext(),
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
        media("game", "VIDEO_GAME", "WATCHLIST", { computedConsensusScore: 8 }),
      ].flat(),
      rankingContext(),
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
