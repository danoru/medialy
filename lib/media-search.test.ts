import { describe, expect, it } from "vitest";
import { matchesMediaTitleSearch } from "@/lib/media-search";

describe("matchesMediaTitleSearch", () => {
  it("matches title fragments by default", () => {
    expect(
      matchesMediaTitleSearch("Mortal Kombat: Annihilation", "kombat"),
    ).toBe(true);
    expect(matchesMediaTitleSearch("Zootopia 2", "kombat")).toBe(false);
  });

  it("treats a trailing asterisk as a title prefix search", () => {
    expect(matchesMediaTitleSearch("Mortal Kombat: Annihilation", "M*")).toBe(
      true,
    );
    expect(matchesMediaTitleSearch("mother!", "M*")).toBe(true);
    expect(matchesMediaTitleSearch("Zootopia 2", "M*")).toBe(false);
  });
});
