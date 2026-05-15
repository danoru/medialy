import { describe, expect, it } from "vitest";
import {
  canonicalTagMetadataForName,
  getDiscoverSubgenresForGenre,
  normalizeGenreName,
  splitGenresAndTags,
} from "@/lib/taxonomy";

describe("taxonomy normalization", () => {
  it("accepts Rhythm as a video game genre", () => {
    expect(normalizeGenreName("rhythm", "VIDEO_GAME")).toBe("Rhythm");
  });

  it("maps Party to Casual during game genre normalization", () => {
    expect(normalizeGenreName("Party", "VIDEO_GAME")).toBe("Casual");
  });

  it("moves Stealth into tags instead of top-level game genres", () => {
    expect(normalizeGenreName("Stealth", "VIDEO_GAME")).toBeNull();
    expect(splitGenresAndTags("VIDEO_GAME", ["Stealth"])).toEqual({
      genres: [],
      tags: ["Stealth"],
    });
  });

  it("moves MMO and Sandbox into tags instead of top-level game genres", () => {
    expect(normalizeGenreName("MMO", "VIDEO_GAME")).toBeNull();
    expect(normalizeGenreName("Sandbox", "VIDEO_GAME")).toBeNull();
    expect(splitGenresAndTags("VIDEO_GAME", ["MMO", "Sandbox"])).toEqual({
      genres: [],
      tags: ["MMO", "Sandbox"],
    });
  });

  it("keeps Body Horror as a subgenre tag, not a movie genre", () => {
    expect(normalizeGenreName("Body Horror", "MOVIE")).toBeNull();
    expect(canonicalTagMetadataForName("Body Horror")).toMatchObject({
      category: "SUBGENRE",
      discoverable: true,
    });
  });

  it("classifies Japan as a country tag", () => {
    expect(canonicalTagMetadataForName("Japan")).toMatchObject({
      category: "COUNTRY",
      countryCode: "JP",
    });
  });
});

describe("discover taxonomy mapping", () => {
  it("does not place Turn-Based RPG under Strategy unless explicitly mapped", () => {
    expect(getDiscoverSubgenresForGenre("VIDEO_GAME", "RPG")).toContain(
      "Turn-Based RPG",
    );
    expect(getDiscoverSubgenresForGenre("VIDEO_GAME", "Strategy")).not.toContain(
      "Turn-Based RPG",
    );
  });

  it("places Kart Racer under Racing", () => {
    expect(getDiscoverSubgenresForGenre("VIDEO_GAME", "Racing")).toContain(
      "Kart Racer",
    );
  });

  it("places Stealth only as a mapped subgenre", () => {
    expect(normalizeGenreName("Stealth", "VIDEO_GAME")).toBeNull();
    expect(getDiscoverSubgenresForGenre("VIDEO_GAME", "Action")).toContain(
      "Stealth",
    );
  });

  it("places Anime under movie and TV animation but not unrelated genres", () => {
    expect(getDiscoverSubgenresForGenre("MOVIE", "Animation")).toContain(
      "Anime",
    );
    expect(getDiscoverSubgenresForGenre("TV_SHOW", "Animation")).toContain(
      "Anime",
    );
    expect(getDiscoverSubgenresForGenre("MOVIE", "Horror")).not.toContain(
      "Anime",
    );
  });
});
