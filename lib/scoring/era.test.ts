import { describe, expect, it } from "vitest";
import {
  buildEraContext,
  buildEraExposure,
  eraLabel,
  eraOf,
  ERAS,
} from "./era";

describe("eraOf", () => {
  it("buckets by release year at the era boundaries", () => {
    expect(eraOf("1969-12-31")).toBe("pre-1970");
    expect(eraOf("1970-01-01")).toBe("1970-1989");
    expect(eraOf("1989-12-31")).toBe("1970-1989");
    expect(eraOf("1990-01-01")).toBe("1990-2009");
    expect(eraOf("2009-12-31")).toBe("1990-2009");
    expect(eraOf("2010-01-01")).toBe("2010-2019");
    expect(eraOf("2019-12-31")).toBe("2010-2019");
    expect(eraOf("2020-01-01")).toBe("2020+");
    expect(eraOf(new Date(Date.UTC(2031, 5, 1)))).toBe("2020+");
  });

  it("returns null for missing or invalid dates", () => {
    expect(eraOf(null)).toBeNull();
    expect(eraOf(undefined)).toBeNull();
    expect(eraOf("")).toBeNull();
    expect(eraOf("not a date")).toBeNull();
    expect(eraOf(new Date("nope"))).toBeNull();
  });

  it("labels every era", () => {
    expect(eraLabel("2010-2019")).toBe("the 2010s");
    for (const era of ERAS) expect(eraLabel(era.key)).toBe(era.label);
  });
});

describe("buildEraContext", () => {
  const entry = (
    mediaType: string,
    releaseDate: string | null,
    computedConsensusScore: number | null,
  ) => ({ mediaType, releaseDate, computedConsensusScore });

  it("makes each medium's era shares sum to 1, ignoring undated titles", () => {
    const context = buildEraContext([
      entry("MOVIE", "1950-01-01", 9),
      entry("MOVIE", "1995-01-01", 7),
      entry("MOVIE", "2005-01-01", 7),
      entry("MOVIE", "2015-01-01", 6),
      entry("MOVIE", null, 10),
      entry("VIDEO_GAME", "2021-01-01", null),
    ]);
    const sum = (medium: string) =>
      [...context.share.get(medium)!.values()].reduce((a, b) => a + b, 0);
    expect(sum("MOVIE")).toBeCloseTo(1, 10);
    expect(sum("VIDEO_GAME")).toBeCloseTo(1, 10);
    expect(context.share.get("MOVIE")?.get("1990-2009")).toBeCloseTo(0.5, 10);
    expect(context.share.get("MOVIE")?.get("pre-1970")).toBeCloseTo(0.25, 10);
    expect(context.share.get("VIDEO_GAME")?.get("2020+")).toBe(1);
  });

  it("averages critic scores only over titles that have one", () => {
    const context = buildEraContext([
      entry("MOVIE", "1950-01-01", 9),
      entry("MOVIE", "1951-01-01", 8),
      entry("MOVIE", "1952-01-01", null),
      entry("MOVIE", "2015-01-01", null),
    ]);
    expect(context.criticMean.get("MOVIE")?.get("pre-1970")).toBeCloseTo(8.5, 10);
    // An era whose titles all lack a score has no mean at all, but still has a share.
    expect(context.criticMean.get("MOVIE")?.has("2010-2019")).toBe(false);
    expect(context.share.get("MOVIE")?.get("2010-2019")).toBeCloseTo(0.25, 10);
  });

  it("is empty for an empty catalog", () => {
    const context = buildEraContext([]);
    expect(context.share.size).toBe(0);
    expect(context.criticMean.size).toBe(0);
  });
});

describe("buildEraExposure", () => {
  const row = (
    id: string,
    releaseDate: string | null,
    overrides: { status?: string; isArchived?: boolean; mediaType?: string } = {},
  ) => ({
    media: { id, mediaType: overrides.mediaType ?? "MOVIE", releaseDate },
    status: overrides.status ?? "COMPLETED",
    isArchived: overrides.isArchived ?? false,
  });

  it("counts tracked titles per era and medium", () => {
    const exposure = buildEraExposure([
      row("a", "2015-01-01"),
      row("b", "2016-01-01", { status: "BACKLOG" }),
      row("c", "1950-01-01", { status: "WATCHLIST" }),
      row("g", "2021-01-01", { mediaType: "VIDEO_GAME" }),
    ]);
    const movies = exposure.get("MOVIE")!;
    expect(movies.total).toBe(3);
    expect(movies.counts.get("2010-2019")).toBe(2);
    expect(movies.counts.get("pre-1970")).toBe(1);
    expect(exposure.get("VIDEO_GAME")?.total).toBe(1);
  });

  it("ignores archived, untracked, not-interested and undated rows", () => {
    const exposure = buildEraExposure([
      row("archived", "2015-01-01", { isArchived: true }),
      row("untracked", "2015-01-01", { status: "UNTRACKED" }),
      row("skip", "2015-01-01", { status: "NOT_INTERESTED" }),
      row("undated", null),
      row("kept", "2015-01-01"),
    ]);
    expect(exposure.get("MOVIE")?.total).toBe(1);
    expect(exposure.get("MOVIE")?.counts.get("2010-2019")).toBe(1);
  });

  it("counts a media id once", () => {
    const exposure = buildEraExposure([
      row("dup", "2015-01-01"),
      row("dup", "2015-01-01", { status: "BACKLOG" }),
    ]);
    expect(exposure.get("MOVIE")?.total).toBe(1);
  });
});
