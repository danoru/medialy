import { describe, expect, it } from "vitest";
import { diversify, pickSimilarity, usualErasFrom, usualGenresFrom } from "./diversity";
import { brierScore, calibratedMatch, fitLogistic } from "./calibration";

const item = (
  id: string,
  score: number,
  genres: string[],
  extra: { tags?: string[]; creators?: string[]; franchise?: string } = {},
) => ({
  id,
  score,
  genres,
  tags: extra.tags ?? [],
  creators: extra.creators ?? [],
  franchise: extra.franchise ?? null,
});

describe("diversify", () => {
  it("does not fill a row with one franchise", () => {
    const ranked = [
      item("mcu1", 90, ["Action"], { franchise: "mcu" }),
      item("mcu2", 89, ["Action"], { franchise: "mcu" }),
      item("mcu3", 88, ["Action"], { franchise: "mcu" }),
      item("drama", 80, ["Drama"]),
      item("horror", 78, ["Horror"]),
    ];
    const picks = diversify(ranked, { limit: 3 }).map((p) => p.id);
    expect(picks[0]).toBe("mcu1");
    expect(picks).toContain("drama");
    expect(picks.filter((id) => id.startsWith("mcu")).length).toBeLessThan(3);
  });

  it("reserves one slot for a pick outside the usual genres when it clears the floor", () => {
    const ranked = [
      item("a", 90, ["Drama"]),
      item("b", 88, ["Drama", "Romance"]),
      item("c", 86, ["Thriller"]),
      item("d", 84, ["Drama"]),
      item("wild", 62, ["Musical"]),
      item("dud", 40, ["Western"]),
    ];
    const picks = diversify(ranked, {
      limit: 5,
      usualGenres: new Set(["Drama", "Romance", "Thriller"]),
    }).map((p) => p.id);
    expect(picks).toHaveLength(5);
    expect(picks).toContain("wild");
    expect(picks).not.toContain("dud");
  });

  it("keeps the row dependable when nothing adventurous is good enough", () => {
    const ranked = [
      item("a", 90, ["Drama"]),
      item("b", 88, ["Drama"]),
      item("dud", 40, ["Western"]),
    ];
    const picks = diversify(ranked, {
      limit: 3,
      usualGenres: new Set(["Drama"]),
    }).map((p) => p.id);
    expect(picks).toEqual(["a", "b", "dud"]);
  });

  it("treats a shared director as near-duplicate", () => {
    const a = item("a", 1, ["Drama"], { creators: ["nolan"] });
    const b = item("b", 1, ["Horror"], { creators: ["nolan"] });
    const c = item("c", 1, ["Drama"]);
    expect(pickSimilarity(a, b)).toBeGreaterThan(pickSimilarity(a, c));
  });

  it("finds the viewer's usual genres from what they rated most", () => {
    const usual = usualGenresFrom([
      ["Drama"], ["Drama", "Romance"], ["Drama"], ["Horror"], ["Romance"], ["Comedy"],
    ]);
    expect(usual).toEqual(new Set(["Drama", "Romance", "Comedy"]));
  });
});

describe("calibration", () => {
  it("fits a rising curve when higher scores are liked more often", () => {
    const samples = Array.from({ length: 200 }, (_, i) => {
      const score = 20 + (i % 60);
      return { score, above: (i * 7919) % 100 < score };
    });
    const fit = fitLogistic(samples);
    expect(fit).not.toBeNull();
    expect(fit!.slope).toBeGreaterThan(0);
    expect(brierScore(samples, fit!)!).toBeLessThan(
      brierScore(samples, { intercept: 0, slope: 0 })!,
    );
    expect(calibratedMatch(80, fit!)).toBeGreaterThan(calibratedMatch(40, fit!));
  });

  it("refuses to fit on too little or one-sided data", () => {
    expect(fitLogistic([])).toBeNull();
    expect(
      fitLogistic(Array.from({ length: 30 }, () => ({ score: 60, above: true }))),
    ).toBeNull();
  });

  it("maps the raw score to a 0–100 chance with the stored curve", () => {
    expect(calibratedMatch(50)).toBeGreaterThan(40);
    expect(calibratedMatch(50)).toBeLessThan(55);
    expect(calibratedMatch(70)).toBeGreaterThan(85);
    expect(calibratedMatch(30)).toBeLessThan(10);
  });
});

describe("diversify by era", () => {
  const dated = (id: string, score: number, genre: string, era: string | null) => ({
    ...item(id, score, [genre]),
    era,
  });

  it("reserves the adventurous slot for a good pick from outside the usual eras", () => {
    const ranked = [
      dated("a", 90, "Drama", "1990-2009"),
      dated("b", 88, "Thriller", "1990-2009"),
      dated("c", 86, "Comedy", "1990-2009"),
      dated("d", 84, "Horror", "1990-2009"),
      dated("wild", 62, "Western", "pre-1970"),
      dated("dud", 40, "Musical", "2020+"),
    ];
    const picks = diversify(ranked, {
      limit: 4,
      usualEras: new Set(["1990-2009"]),
    }).map((p) => p.id);
    expect(picks).toHaveLength(4);
    expect(picks).toContain("wild");
    expect(picks).not.toContain("dud");
    expect(picks).not.toContain("d");
  });

  it("stays dependable when no outside-era pick clears the floor or has an era", () => {
    const ranked = [
      dated("a", 90, "Drama", "1990-2009"),
      dated("b", 88, "Thriller", "1990-2009"),
      dated("dud", 40, "Musical", "pre-1970"),
      dated("undated", 70, "Comedy", null),
    ];
    const picks = diversify(ranked, {
      limit: 3,
      usualEras: new Set(["1990-2009"]),
    }).map((p) => p.id);
    expect(picks).toEqual(["a", "b", "undated"]);
  });
});

describe("usualErasFrom", () => {
  it("is empty below the minimum number of tracked titles", () => {
    expect(usualErasFrom(new Map([["2010-2019", 9]]))).toEqual(new Set());
    expect(usualErasFrom(new Map())).toEqual(new Set());
  });

  it("takes the smallest set of most-tracked eras covering the share", () => {
    expect(
      usualErasFrom(
        new Map([["1990-2009", 5], ["2010-2019", 3], ["pre-1970", 2]]),
      ),
    ).toEqual(new Set(["1990-2009", "2010-2019"]));
    expect(
      usualErasFrom(new Map([["2010-2019", 8], ["pre-1970", 2]])),
    ).toEqual(new Set(["2010-2019"]));
    expect(usualErasFrom(new Map([["a", 3], ["b", 3], ["c", 3], ["d", 3]]))).toEqual(
      new Set(["a", "b", "c"]),
    );
  });

  it("honours an explicit minimum", () => {
    expect(usualErasFrom(new Map([["2010-2019", 4]]), 4)).toEqual(new Set(["2010-2019"]));
  });
});
