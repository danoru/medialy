import { describe, expect, it } from "vitest";
import {
  buildFeatureRarity,
  facetSimilarity,
  type SimilarityItem,
} from "./similarity";
import { calculateRatingCompatibility, pearson } from "./compatibility";

const tag = (name: string, category: string) => ({
  tag: { name, status: "APPROVED", category },
});
const credit = (role: string, id: string, name = id) => ({
  role,
  contributor: { id, name },
});
const film = (
  genres: string[],
  extra: Partial<SimilarityItem> & { year?: number } = {},
): SimilarityItem => ({
  genres: genres.map((name) => ({ genre: { name } })),
  tags: extra.tags ?? [],
  credits: extra.credits ?? [],
  releaseDate: extra.year ? new Date(`${extra.year}-06-01`) : null,
});

const daysOfThunder = film(["Action", "Drama", "Sports"], {
  tags: [tag("Motorsports", "SUBGENRE")],
  credits: [credit("DIRECTOR", "scott", "Tony Scott"), credit("ACTOR", "cruise", "Tom Cruise")],
  year: 1990,
});
const f1 = film(["Action", "Drama"], {
  tags: [tag("Motorsports", "SUBGENRE")],
  credits: [credit("DIRECTOR", "kosinski"), credit("ACTOR", "pitt")],
  year: 2025,
});
const topGun = film(["Action", "Drama"], {
  tags: [tag("Aviation", "SUBGENRE")],
  credits: [credit("DIRECTOR", "scott", "Tony Scott"), credit("ACTOR", "cruise", "Tom Cruise")],
  year: 1986,
});
const sevenSamurai = film(["Action", "Drama"], {
  tags: [tag("Samurai", "SUBGENRE")],
  credits: [credit("DIRECTOR", "kurosawa"), credit("ACTOR", "mifune")],
  year: 1954,
});
const filler = Array.from({ length: 40 }, (_, i) =>
  film(i % 2 ? ["Drama"] : ["Drama", "Romance"], {
    tags: i % 5 === 0 ? [tag("Coming of Age", "SUBGENRE")] : [],
  }),
);
const rarity = buildFeatureRarity([daysOfThunder, f1, topGun, sevenSamurai, ...filler]);

describe("facet similarity", () => {
  it("ranks a same-subgenre or same-director film far above a genre-only match", () => {
    const sim = (other: SimilarityItem) => facetSimilarity(daysOfThunder, other, rarity).score;
    expect(sim(topGun)).toBeGreaterThan(sim(f1));
    expect(sim(f1)).toBeGreaterThan(sim(sevenSamurai) * 2);
  });

  it("weights rare genres more than common ones", () => {
    const sportsDrama = film(["Drama", "Sports"]);
    const romanceDrama = film(["Drama", "Romance"]);
    const dramaOnly = film(["Drama"]);
    const withSports = facetSimilarity(sportsDrama, film(["Sports"]), rarity).facets.genre!;
    const withDrama = facetSimilarity(romanceDrama, dramaOnly, rarity).facets.genre!;
    expect(withSports).toBeGreaterThan(withDrama);
  });

  it("does not let two barely-tagged titles look like twins", () => {
    const a = film(["Drama"]);
    const b = film(["Drama"]);
    const result = facetSimilarity(a, b, rarity);
    expect(result.coverage).toBeLessThan(0.5);
    expect(result.score).toBeLessThan(0.6);
  });

  it("names the most specific shared thing", () => {
    expect(facetSimilarity(daysOfThunder, topGun, rarity).shared).toEqual({
      facet: "director",
      label: "Tony Scott",
    });
    expect(facetSimilarity(daysOfThunder, f1, rarity).shared?.label).toBe("Motorsports");
    expect(facetSimilarity(daysOfThunder, sevenSamurai, rarity).shared?.facet).toBe("genre");
  });

  it("uses only portable facets across media", () => {
    const full = facetSimilarity(daysOfThunder, topGun, rarity);
    const portable = facetSimilarity(daysOfThunder, topGun, rarity, { portable: true });
    expect(portable.facets.director).toBeNull();
    expect(portable.facets.actor).toBeNull();
    expect(portable.score).toBeLessThan(full.score);
  });

  it("gives one shared lead most of the actor credit and two the whole of it", () => {
    const one = facetSimilarity(daysOfThunder, topGun, rarity).facets.actor;
    const both = facetSimilarity(
      daysOfThunder,
      film(["Action"], { credits: [credit("ACTOR", "cruise"), credit("ACTOR", "duvall")] }),
      rarity,
    );
    const twoLeads = facetSimilarity(
      film(["Action"], { credits: [credit("ACTOR", "cruise"), credit("ACTOR", "duvall")] }),
      film(["Action"], { credits: [credit("ACTOR", "cruise"), credit("ACTOR", "duvall")] }),
      rarity,
    ).facets.actor;
    expect(one).toBeCloseTo(0.7);
    expect(both.facets.actor).toBeCloseTo(0.7);
    expect(twoLeads).toBe(1);
  });
});

describe("compatibility with correlation", () => {
  const pairsFrom = (mine: number[], theirs: number[]) =>
    mine.map((viewerRating, i) => ({ viewerRating, otherRating: theirs[i] }));

  it("rewards a harsh rater who agrees on which films are better", () => {
    const mine = [9, 8, 6, 7, 5, 9, 4, 8, 6, 7];
    const harshButAligned = mine.map((v) => v - 2);
    const closeButRandom = [8, 6, 8, 5, 7, 7, 6, 6, 8, 5];
    const aligned = calculateRatingCompatibility(pairsFrom(mine, harshButAligned));
    const random = calculateRatingCompatibility(pairsFrom(mine, closeButRandom));
    expect(aligned.correlation).toBeCloseTo(1);
    expect(aligned.compatibilityScore).toBeGreaterThan(random.compatibilityScore);
  });

  it("keeps the distance-only score for tiny overlaps", () => {
    const result = calculateRatingCompatibility(pairsFrom([9, 8], [8, 8]));
    expect(result.correlation).toBeNull();
    expect(result.compatibilityScore).toBe(94);
  });

  it("returns no correlation when one side never varies", () => {
    expect(pearson(pairsFrom([9, 9, 9, 9, 9, 9, 9, 9], [1, 5, 9, 2, 7, 3, 8, 4]))).toBeNull();
  });
});
