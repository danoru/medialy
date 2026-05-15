import { describe, expect, it } from "vitest";
import {
  foldDiacritics,
  normalizeComparableTitle,
  normalizeSearchText,
} from "@/lib/text-normalization";

describe("text normalization", () => {
  it("folds common accented title characters", () => {
    expect(foldDiacritics("Ghost of Yōtei")).toBe("Ghost of Yotei");
    expect(foldDiacritics("Pokémon")).toBe("Pokemon");
  });

  it("normalizes search text across punctuation and accents", () => {
    expect(normalizeSearchText("Pokémon: Detective Pikachu")).toBe(
      "pokemon detective pikachu",
    );
  });

  it("normalizes comparable titles with article removal", () => {
    expect(normalizeComparableTitle("The Tale of the Princess Kaguya")).toBe(
      "tale of princess kaguya",
    );
  });
});
