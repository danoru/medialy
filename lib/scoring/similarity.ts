import { SIMILARITY_FACETS } from "@/lib/scoring/config";

/**
 * How alike two titles are, as a set of facets a person would recognise:
 * the same director, the same subgenre, the same genres, the same themes,
 * the same era and place, the same leads. Each facet is a set overlap, so
 * "almost everything in common" scores near 1 and "two broad genres out of
 * five things" scores low. Rare features count more than common ones
 * (Sports says more than Drama), which is the `rarity` map.
 *
 * Facets that either title lacks are dropped and the rest renormalized, so
 * an untagged title is not punished for missing data, but it cannot reach a
 * high score on genres alone either: `coverage` reports how much of the
 * possible weight was actually compared.
 */

export type SimilarityItem = {
  id?: string;
  genres: Array<{ genre: { name: string } }>;
  tags: Array<{ tag: { name: string; status?: string; category?: string | null } }>;
  credits: Array<{ role: string; contributor: { id: string; name: string } }>;
  releaseDate?: Date | string | null;
};

export type FacetKey = keyof typeof SIMILARITY_FACETS.weights;

export type FacetSimilarity = {
  /** 0–1, weighted over the facets both titles have. */
  score: number;
  /** 0–1, share of facet weight that could be compared. */
  coverage: number;
  /** Per-facet overlap, or null when either title lacks the facet. */
  facets: Record<FacetKey, number | null>;
  /** The most specific thing they share, for captions. */
  shared: { facet: FacetKey; label: string } | null;
};

/** Feature key → weight from rarity: common features count less. */
export type FeatureRarity = Map<string, number>;

const CREATOR_ROLES = new Set(["DIRECTOR", "CREATOR", "DEVELOPER", "PUBLISHER"]);
const THEME_CATEGORIES = new Set(["THEME", "MOOD", "MECHANIC"]);

/** A title's facets, extracted once. */
type Prepared = {
  genres: Set<string>;
  subgenres: Set<string>;
  themes: Set<string>;
  countries: Set<string>;
  allTags: string[];
  creators: Map<string, string>;
  actors: Map<string, string>;
  decade: number | null;
};

// The engine compares every candidate against every rated title, so the
// per-title set-up is cached on the item object itself.
const prepared = new WeakMap<SimilarityItem, Prepared>();

function prepare(item: SimilarityItem): Prepared {
  const cached = prepared.get(item);
  if (cached) return cached;
  const genres = new Set(item.genres.map((entry) => `g:${entry.genre.name}`));
  const subgenres = new Set<string>();
  const themes = new Set<string>();
  const countries = new Set<string>();
  const allTags: string[] = [];
  for (const entry of item.tags) {
    if (entry.tag.status != null && entry.tag.status !== "APPROVED") continue;
    const key = `t:${entry.tag.name}`;
    allTags.push(key);
    const category = entry.tag.category ?? "";
    if (category === "SUBGENRE") subgenres.add(key);
    else if (THEME_CATEGORIES.has(category)) themes.add(key);
    else if (category === "COUNTRY") countries.add(key);
  }
  const creators = new Map<string, string>();
  const actors = new Map<string, string>();
  for (const credit of item.credits) {
    if (CREATOR_ROLES.has(credit.role)) {
      creators.set(credit.contributor.id, credit.contributor.name);
    } else if (credit.role === "ACTOR") {
      actors.set(credit.contributor.id, credit.contributor.name);
    }
  }
  let decade: number | null = null;
  if (item.releaseDate) {
    const date =
      item.releaseDate instanceof Date
        ? item.releaseDate
        : new Date(item.releaseDate);
    if (Number.isFinite(date.getTime())) {
      decade = Math.floor(date.getUTCFullYear() / 10) * 10;
    }
  }
  const result = { genres, subgenres, themes, countries, allTags, creators, actors, decade };
  prepared.set(item, result);
  return result;
}

const genreKeys = (item: SimilarityItem) => prepare(item).genres;
const subgenreKeys = (item: SimilarityItem) => prepare(item).subgenres;
const themeKeys = (item: SimilarityItem) => prepare(item).themes;
const countryKeys = (item: SimilarityItem) => prepare(item).countries;
const creatorIds = (item: SimilarityItem) => prepare(item).creators;
const actorIds = (item: SimilarityItem) => prepare(item).actors;
const decadeOf = (item: SimilarityItem) => prepare(item).decade;

/**
 * Rarity weights for genres and tags across a catalog: `log(N / df)`, floored
 * so even the commonest feature still counts a little. Keys match the ones
 * the facet functions produce (`g:` genres, `t:` tags).
 */
export function buildFeatureRarity(items: SimilarityItem[]): FeatureRarity {
  const counts = new Map<string, number>();
  for (const item of items) {
    const facets = prepare(item);
    const keys = new Set<string>([...facets.genres, ...facets.allTags]);
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = Math.max(1, items.length);
  return new Map(
    [...counts].map(([key, df]) => [
      key,
      Math.max(SIMILARITY_FACETS.rarityFloor, Math.log(total / df)),
    ]),
  );
}

/** Weighted Jaccard: shared weight over union weight. */
function weightedOverlap(
  a: Set<string>,
  b: Set<string>,
  rarity: FeatureRarity,
): number {
  let shared = 0;
  let union = 0;
  const weight = (key: string) => rarity.get(key) ?? SIMILARITY_FACETS.defaultRarity;
  for (const key of a) {
    union += weight(key);
    if (b.has(key)) shared += weight(key);
  }
  for (const key of b) if (!a.has(key)) union += weight(key);
  return union > 0 ? shared / union : 0;
}

function firstShared(a: Set<string>, b: Set<string>, rarity: FeatureRarity) {
  let best: { key: string; weight: number } | null = null;
  for (const key of a) {
    if (!b.has(key)) continue;
    const weight = rarity.get(key) ?? SIMILARITY_FACETS.defaultRarity;
    if (!best || weight > best.weight) best = { key, weight };
  }
  return best ? best.key.slice(2) : null;
}

export function facetSimilarity(
  a: SimilarityItem,
  b: SimilarityItem,
  rarity: FeatureRarity,
  options: { portable?: boolean } = {},
): FacetSimilarity {
  const facets: Record<FacetKey, number | null> = {
    director: null,
    subgenre: null,
    genre: null,
    theme: null,
    culture: null,
    actor: null,
  };
  let shared: FacetSimilarity["shared"] = null;
  const note = (facet: FacetKey, label: string | null) => {
    if (label && !shared) shared = { facet, label };
  };

  // Facets in order of how specific a shared one is.
  if (!options.portable) {
    const ca = creatorIds(a);
    const cb = creatorIds(b);
    if (ca.size > 0 && cb.size > 0) {
      const common = [...ca].find(([id]) => cb.has(id));
      facets.director = common ? 1 : 0;
      note("director", common ? common[1] : null);
    }
    const sa = subgenreKeys(a);
    const sb = subgenreKeys(b);
    if (sa.size > 0 && sb.size > 0) {
      facets.subgenre = weightedOverlap(sa, sb, rarity);
      note("subgenre", firstShared(sa, sb, rarity));
    }
    const aa = actorIds(a);
    const ab = actorIds(b);
    if (aa.size > 0 && ab.size > 0) {
      const common = [...aa].filter(([id]) => ab.has(id));
      facets.actor =
        common.length === 0
          ? 0
          : common.length === 1
            ? SIMILARITY_FACETS.singleActorCredit
            : 1;
      note("actor", common[0]?.[1] ?? null);
    }
  }

  const ta = themeKeys(a);
  const tb = themeKeys(b);
  if (ta.size > 0 && tb.size > 0) {
    facets.theme = weightedOverlap(ta, tb, rarity);
    note("theme", firstShared(ta, tb, rarity));
  }

  const ga = genreKeys(a);
  const gb = genreKeys(b);
  if (ga.size > 0 && gb.size > 0) {
    facets.genre = weightedOverlap(ga, gb, rarity);
    note("genre", firstShared(ga, gb, rarity));
  }

  const da = decadeOf(a);
  const db = decadeOf(b);
  const ka = countryKeys(a);
  const kb = countryKeys(b);
  const cultureParts: number[] = [];
  if (da != null && db != null) {
    const gap = Math.abs(da - db);
    cultureParts.push(gap === 0 ? 1 : gap === 10 ? 0.5 : 0);
  }
  if (ka.size > 0 && kb.size > 0) {
    const country = firstShared(ka, kb, rarity);
    cultureParts.push(country ? 1 : 0);
    note("culture", country);
  }
  if (cultureParts.length > 0) {
    facets.culture =
      cultureParts.reduce((sum, value) => sum + value, 0) / cultureParts.length;
  }

  let weighted = 0;
  let available = 0;
  let possible = 0;
  for (const facet of Object.keys(facets) as FacetKey[]) {
    const weight = SIMILARITY_FACETS.weights[facet];
    possible += weight;
    const value = facets[facet];
    if (value == null) continue;
    available += weight;
    weighted += weight * value;
  }
  const coverage = possible > 0 ? available / possible : 0;
  // A facet that cannot be compared contributes nothing: two titles that
  // share only a release decade are not alike, however little else we know.
  const score = possible > 0 ? weighted / possible : 0;

  return { score, coverage, facets, shared };
}
