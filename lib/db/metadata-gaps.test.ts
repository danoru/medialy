import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import {
  isMetadataGapKey,
  metadataGapChecks,
  validGenresFor,
} from "./metadata-gaps";

function keys(type: Parameters<typeof metadataGapChecks>[0]) {
  return metadataGapChecks(type).map((check) => check.key);
}

describe("metadataGapChecks", () => {
  it("checks director and cast for movies", () => {
    expect(keys("MOVIE")).toEqual(
      expect.arrayContaining(["missing-director", "missing-actor"]),
    );
  });

  it("checks creator and cast for TV shows", () => {
    expect(keys("TV_SHOW")).toEqual(
      expect.arrayContaining(["missing-creator", "missing-actor"]),
    );
  });

  it("checks developer and publisher for video games", () => {
    expect(keys("VIDEO_GAME")).toEqual(
      expect.arrayContaining(["missing-developer", "missing-publisher"]),
    );
  });

  it("has no genre checks for a type with no genre list", () => {
    expect(
      metadataGapChecks("BOOK").some((check) => check.group === "genres"),
    ).toBe(false);
  });
});

describe("validGenresFor", () => {
  it("excludes aliased genres and includes real ones", () => {
    const genres = validGenresFor("MOVIE");
    expect(genres).toContain("Drama");
    expect(genres).not.toContain("Reality");
  });
});

describe("isMetadataGapKey", () => {
  it("rejects unknown keys", () => {
    expect(isMetadataGapKey("MOVIE", "nope")).toBe(false);
    expect(isMetadataGapKey("MOVIE", undefined)).toBe(false);
  });

  it("rejects keys from another type", () => {
    expect(isMetadataGapKey("MOVIE", "missing-developer")).toBe(false);
  });

  it("accepts keys for the type", () => {
    expect(isMetadataGapKey("MOVIE", "missing-director")).toBe(true);
  });
});
