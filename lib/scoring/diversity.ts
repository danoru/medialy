import { DIVERSITY } from "@/lib/scoring/config";

/**
 * Turns a ranked list into a short set worth showing together.
 *
 * Maximal marginal relevance: each pick is the candidate with the best
 * `score − λ × (similarity to the closest pick so far)`, so a row of five
 * does not become five entries in the same franchise or five films by one
 * director. Then one "adventurous" slot goes to the best candidate outside
 * the viewer's usual genres, provided it clears a relevance floor; if none
 * does, the slot stays dependable.
 */

export type DiversifiableItem = {
  id: string;
  /** Ranking score; the same scale the floor is set on. */
  score: number;
  genres: string[];
  tags: string[];
  /** Non-actor creator ids: directors, creators, studios. */
  creators: string[];
  /** Franchise / collection key when known. */
  franchise?: string | null;
};

/** 0–1 overlap on the facets that make two picks feel like the same pick. */
export function pickSimilarity(a: DiversifiableItem, b: DiversifiableItem) {
  if (a.franchise && a.franchise === b.franchise) return 1;
  const shared = (x: string[], y: string[]) => {
    if (x.length === 0 || y.length === 0) return 0;
    const set = new Set(x);
    const common = y.filter((v) => set.has(v)).length;
    return common / Math.min(x.length, y.length);
  };
  if (shared(a.creators, b.creators) > 0) return DIVERSITY.sameCreatorSimilarity;
  return (
    DIVERSITY.genreShare * shared(a.genres, b.genres) +
    DIVERSITY.tagShare * shared(a.tags, b.tags)
  );
}

export function diversify<T extends DiversifiableItem>(
  ranked: T[],
  options: {
    limit: number;
    /** Genres the viewer usually reaches for; the adventurous pick avoids them. */
    usualGenres?: ReadonlySet<string>;
    /** Minimum score for the adventurous pick. */
    floor?: number;
  },
): T[] {
  const limit = Math.max(0, options.limit);
  if (limit === 0 || ranked.length === 0) return [];
  const candidates = [...ranked].sort((a, b) => b.score - a.score);
  const picks: T[] = [];
  const remaining = new Set(candidates.map((c) => c.id));

  const dependableSlots =
    options.usualGenres && options.usualGenres.size > 0
      ? Math.max(1, limit - DIVERSITY.adventurousSlots)
      : limit;

  while (picks.length < dependableSlots && remaining.size > 0) {
    let best: T | null = null;
    let bestValue = -Infinity;
    for (const candidate of candidates) {
      if (!remaining.has(candidate.id)) continue;
      const penalty = picks.reduce(
        (max, pick) => Math.max(max, pickSimilarity(candidate, pick)),
        0,
      );
      const value = candidate.score - DIVERSITY.lambda * penalty * 100;
      if (value > bestValue) {
        best = candidate;
        bestValue = value;
      }
    }
    if (!best) break;
    picks.push(best);
    remaining.delete(best.id);
  }

  if (picks.length < limit && options.usualGenres && options.usualGenres.size > 0) {
    const floor = options.floor ?? DIVERSITY.adventurousFloor;
    const adventurous = candidates.find(
      (candidate) =>
        remaining.has(candidate.id) &&
        candidate.score >= floor &&
        candidate.genres.length > 0 &&
        candidate.genres.every((genre) => !options.usualGenres!.has(genre)),
    );
    if (adventurous) {
      picks.push(adventurous);
      remaining.delete(adventurous.id);
    }
  }

  // Top up dependably if the adventurous slot went unfilled.
  for (const candidate of candidates) {
    if (picks.length >= limit) break;
    if (!remaining.has(candidate.id)) continue;
    picks.push(candidate);
    remaining.delete(candidate.id);
  }
  return picks;
}

/** The viewer's usual genres: the ones carrying most of their rated titles. */
export function usualGenresFrom(
  ratedGenres: Iterable<string[]>,
  top: number = DIVERSITY.usualGenreCount,
): Set<string> {
  const counts = new Map<string, number>();
  for (const genres of ratedGenres) {
    for (const genre of new Set(genres)) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return new Set(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, top)
      .map(([genre]) => genre),
  );
}
