import { describe, expect, it } from "vitest";
import {
  inheritableScalars,
  isDeliberateStatus,
  mergeStatus,
  mergeUserMediaFields,
  type MergeableUserMedia,
} from "@/lib/media-merge";

const row = (over: Partial<MergeableUserMedia> = {}): MergeableUserMedia => ({
  status: "UNTRACKED",
  personalRating: null,
  isFavorite: false,
  isArchived: false,
  ...over,
});

const scalars = (over: Record<string, unknown> = {}) =>
  ({
    originalTitle: null,
    description: null,
    releaseDate: null,
    posterUrl: null,
    externalUrl: null,
    metadataJson: null,
    platformsJson: null,
    ...over,
  }) as Parameters<typeof inheritableScalars>[0];

describe("isDeliberateStatus", () => {
  it("treats the not-started statuses as uncommitted", () => {
    expect(isDeliberateStatus("UNTRACKED")).toBe(false);
    expect(isDeliberateStatus("WATCHLIST")).toBe(false);
    expect(isDeliberateStatus("BACKLOG")).toBe(false);
  });

  it("treats deliberate positions as committed", () => {
    for (const status of [
      "IN_PROGRESS",
      "COMPLETED",
      "PAUSED",
      "DROPPED",
      "NOT_INTERESTED",
    ] as const) {
      expect(isDeliberateStatus(status)).toBe(true);
    }
  });
});

describe("mergeStatus", () => {
  it("promotes a deliberate status off the duplicate", () => {
    // The Raid case: someone marked the duplicate watched and never touched
    // the canonical entry.
    expect(mergeStatus("UNTRACKED", "COMPLETED")).toBe("COMPLETED");
  });

  it("keeps the survivor's deliberate status over the duplicate's", () => {
    expect(mergeStatus("COMPLETED", "DROPPED")).toBe("COMPLETED");
  });

  it("does not demote a deliberate survivor to a not-started duplicate", () => {
    expect(mergeStatus("IN_PROGRESS", "WATCHLIST")).toBe("IN_PROGRESS");
  });

  it("prefers the more informative status when neither is deliberate", () => {
    expect(mergeStatus("UNTRACKED", "WATCHLIST")).toBe("WATCHLIST");
    expect(mergeStatus("WATCHLIST", "BACKLOG")).toBe("WATCHLIST");
  });
});

describe("mergeUserMediaFields", () => {
  it("takes the duplicate's rating when the survivor has none", () => {
    const merged = mergeUserMediaFields(
      row(),
      row({ status: "COMPLETED", personalRating: 9 }),
    );
    expect(merged).toEqual({
      status: "COMPLETED",
      personalRating: 9,
      isFavorite: false,
      isArchived: false,
    });
  });

  it("keeps the survivor's rating when both are rated", () => {
    const merged = mergeUserMediaFields(
      row({ status: "COMPLETED", personalRating: 8.5 }),
      row({ status: "COMPLETED", personalRating: 7 }),
    );
    expect(merged.personalRating).toBe(8.5);
  });

  it("keeps a rating of zero rather than falling through to the duplicate", () => {
    const merged = mergeUserMediaFields(
      row({ personalRating: 0 }),
      row({ personalRating: 6 }),
    );
    expect(merged.personalRating).toBe(0);
  });

  it("carries a favorite over from either side", () => {
    expect(
      mergeUserMediaFields(row(), row({ isFavorite: true })).isFavorite,
    ).toBe(true);
    expect(
      mergeUserMediaFields(row({ isFavorite: true }), row()).isFavorite,
    ).toBe(true);
  });

  it("leaves archived state to the survivor", () => {
    expect(
      mergeUserMediaFields(row(), row({ isArchived: true })).isArchived,
    ).toBe(false);
  });
});

describe("inheritableScalars", () => {
  it("fills only the fields the survivor is missing", () => {
    const result = inheritableScalars(
      scalars({ description: "Kept.", posterUrl: null }),
      scalars({ description: "Discarded.", posterUrl: "https://img/a.jpg" }),
    );
    expect(result).toEqual({ posterUrl: "https://img/a.jpg" });
  });

  it("treats blank strings as missing", () => {
    const result = inheritableScalars(
      scalars({ description: "   " }),
      scalars({ description: "Real synopsis." }),
    );
    expect(result).toEqual({ description: "Real synopsis." });
  });

  it("never overwrites a curated value", () => {
    const result = inheritableScalars(
      scalars({
        description: "Curated.",
        releaseDate: new Date("2012-04-13"),
        posterUrl: "https://img/keep.jpg",
      }),
      scalars({
        description: "Scraped.",
        releaseDate: new Date("2011-01-01"),
        posterUrl: "https://img/other.jpg",
      }),
    );
    expect(result).toEqual({});
  });

  it("ignores fields blank on both sides", () => {
    expect(inheritableScalars(scalars(), scalars())).toEqual({});
  });
});
