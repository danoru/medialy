export const GENRE_WEIGHT = 5;
export const TAG_WEIGHT = 1.5;

type TaxonomyInput = {
  genres: string[];
  tags: string[];
};

export function calculateTaxonomySimilarity(
  first: TaxonomyInput,
  second: TaxonomyInput,
) {
  const sharedGenres = countShared(first.genres, second.genres);
  const sharedTags = countShared(first.tags, second.tags);
  const genreCapacity = Math.max(first.genres.length, second.genres.length, 1);
  const tagCapacity = Math.max(first.tags.length, second.tags.length, 1);
  const genreScore = (sharedGenres / genreCapacity) * GENRE_WEIGHT;
  const tagScore = (sharedTags / tagCapacity) * TAG_WEIGHT;
  const maximum = GENRE_WEIGHT + TAG_WEIGHT;

  return {
    score: Math.round(((genreScore + tagScore) / maximum) * 100),
    sharedGenres,
    sharedTags,
  };
}

function countShared(first: string[], second: string[]) {
  const firstSet = new Set(first.map(normalizeComparableTaxonomy));
  return second.filter((value) =>
    firstSet.has(normalizeComparableTaxonomy(value)),
  ).length;
}

function normalizeComparableTaxonomy(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
