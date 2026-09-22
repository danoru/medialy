import type { MediaType } from "@prisma/client";
import type { CatalogItemWithUser } from "@/lib/db/catalog";
import {
  dashboardQualityScore,
  type OverallTopRankingContext,
} from "@/lib/db/dashboard";
import { DISCOVER } from "@/lib/scoring/config";
import {
  buildFeatureRarity,
  facetSimilarity,
  type FeatureRarity,
} from "@/lib/scoring/similarity";
import {
  getPromotedDiscoverTagsForMediaType,
  isDiscoverSubgenreForGenre,
  tagMetadataAllowsMediaType,
} from "@/lib/taxonomy";
import { startOfToday } from "@/lib/upcoming";

/**
 * Pure section logic for the Discover page.
 *
 * Every ranked list here is *global*: it runs on the same Quality score the
 * dashboard Top 10 and Canon use, so two viewers see the same Essentials. The
 * viewer only affects two things — titles they have finished, dropped or marked
 * not interested are hidden, and their own highly rated titles seed "If You
 * Liked". Each section excludes what the sections above it already showed, so
 * the page never repeats a title.
 *
 * Nothing in this file touches the database; the page passes in the cached
 * catalog and the cached ranking aggregates.
 */

/** A catalog row with its global quality and reach attached. */
export type DiscoverItem = CatalogItemWithUser & {
  /** 0–10 blend of community and critic scores (`dashboardQualityScore`). */
  quality: number;
  /** Total evidence behind `quality`; breaks ties. */
  evidence: number;
  /** Medialy raters plus external rating sources. */
  reach: number;
};

export type DiscoverSubgenre = {
  name: string;
  count: number;
  items: DiscoverItem[];
};

export type DiscoverWorld = {
  name: string;
  count: number;
  /** Mean Quality across the world; orders worlds without any viewer input. */
  averageQuality: number;
  /** Sorted by Quality desc. */
  items: DiscoverItem[];
  subgenres: DiscoverSubgenre[];
};

export type DiscoverChain = {
  seed: DiscoverItem;
  next: DiscoverItem;
  /** What the pair shares, for the "both are …" caption. */
  sharedFacet: string | null;
};

export type DiscoverSections = {
  essentials: DiscoverItem[];
  gateway: DiscoverItem[];
  hiddenGems: DiscoverItem[];
  ifYouLiked: DiscoverChain[];
};

const CONSUMED_STATUSES = new Set(["COMPLETED", "DROPPED", "NOT_INTERESTED"]);

/**
 * Attaches Quality and reach to every catalog row that has any objective
 * signal. Rows with neither a community rating nor a consensus score are
 * dropped: Discover has nothing to say about them yet.
 */
export function scoreDiscoverItems(
  items: CatalogItemWithUser[],
  context: OverallTopRankingContext,
): DiscoverItem[] {
  return items.flatMap((item) => {
    const community = context.communityByMediaId.get(item.id);
    const consensus = context.consensusByMediaId.get(item.id);
    const ranked = dashboardQualityScore(
      item.computedConsensusScore,
      community,
      consensus,
      context.globalCommunityMean,
      context.globalConsensusMean,
    );
    if (ranked == null) return [];
    return [
      {
        ...item,
        quality: ranked.score,
        evidence: ranked.evidence,
        reach: (community?.voters ?? 0) + (consensus?.sources ?? 0),
      },
    ];
  });
}

/** The viewer has already made up their mind about this title. */
export function isConsumed(item: { status: string }) {
  return CONSUMED_STATUSES.has(item.status);
}

/** Same boundary as the recommendation pool: released before tomorrow. */
export function isReleased(
  item: { releaseDate: Date | string | null },
  now = new Date(),
) {
  if (item.releaseDate == null) return true;
  const tomorrow = startOfToday(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const release =
    item.releaseDate instanceof Date
      ? item.releaseDate
      : new Date(item.releaseDate);
  return release.getTime() < tomorrow.getTime();
}

/**
 * The rows Discover may show this viewer: released, not archived, and not
 * already consumed. Anonymous viewers hide nothing.
 */
export function buildDiscoverPool(
  scored: DiscoverItem[],
  options: { viewerId: string | null; now?: Date },
): DiscoverItem[] {
  const now = options.now ?? new Date();
  return scored.filter((item) => {
    if (!isReleased(item, now)) return false;
    if (options.viewerId == null) return true;
    if (item.isArchived) return false;
    return !isConsumed(item);
  });
}

export function compareByQuality(a: DiscoverItem, b: DiscoverItem) {
  return (
    b.quality - a.quality ||
    b.evidence - a.evidence ||
    a.title.localeCompare(b.title)
  );
}

function approvedTags(item: DiscoverItem) {
  return item.tags.filter((entry) => entry.tag.status === "APPROVED");
}

function subgenreTagNames(
  item: DiscoverItem,
  mediaType: MediaType,
  genre?: string,
) {
  return approvedTags(item)
    .filter(
      (entry) =>
        entry.tag.category === "SUBGENRE" &&
        entry.tag.discoverable &&
        tagMetadataAllowsMediaType(entry.tag.mediaTypesJson, mediaType) &&
        (genre == null || isDiscoverSubgenreForGenre(mediaType, genre, entry.tag.name)),
    )
    .map((entry) => entry.tag.name);
}

/**
 * Groups the pool into genre "worlds" — primary genres plus the promoted
 * discover tags (Animation, Indie) that Discover treats as genre-level lanes.
 * Worlds are ordered by mean Quality, then size.
 */
export function buildWorlds(
  pool: DiscoverItem[],
  mediaType: MediaType,
): DiscoverWorld[] {
  const worlds = new Map<string, DiscoverItem[]>();
  const push = (name: string, item: DiscoverItem) => {
    const current = worlds.get(name) ?? [];
    current.push(item);
    worlds.set(name, current);
  };

  const promoted = new Map(
    getPromotedDiscoverTagsForMediaType(mediaType).map((name) => [
      name.toLowerCase(),
      name,
    ]),
  );

  for (const item of pool) {
    const seen = new Set<string>();
    for (const entry of item.genres) {
      if (seen.has(entry.genre.name)) continue;
      seen.add(entry.genre.name);
      push(entry.genre.name, item);
    }
    for (const entry of approvedTags(item)) {
      const canonical = promoted.get(entry.tag.name.toLowerCase());
      if (!canonical || seen.has(canonical)) continue;
      seen.add(canonical);
      push(canonical, item);
    }
  }

  // Worlds are ordered by a shrunk mean so a four-title world with one
  // beloved film does not outrank a 130-title world of broad 8s.
  const poolMean =
    pool.length > 0
      ? pool.reduce((sum, item) => sum + item.quality, 0) / pool.length
      : 0;
  const rankScore = (sum: number, count: number) =>
    (sum + DISCOVER.worldRankPrior * poolMean) /
    (count + DISCOVER.worldRankPrior);

  return [...worlds.entries()]
    .map(([name, items]) => {
      const sorted = [...items].sort(compareByQuality);
      const sum = sorted.reduce((total, item) => total + item.quality, 0);
      const world: DiscoverWorld = {
        name,
        count: sorted.length,
        averageQuality: sum / sorted.length,
        items: sorted,
        subgenres: buildSubgenres(sorted, mediaType, name),
      };
      return { world, rank: rankScore(sum, sorted.length) };
    })
    .sort(
      (a, b) =>
        b.rank - a.rank ||
        b.world.count - a.world.count ||
        a.world.name.localeCompare(b.world.name),
    )
    .map((entry) => entry.world);
}

function buildSubgenres(
  items: DiscoverItem[],
  mediaType: MediaType,
  genre: string,
): DiscoverSubgenre[] {
  const byTag = new Map<string, DiscoverItem[]>();
  for (const item of items) {
    for (const name of subgenreTagNames(item, mediaType, genre)) {
      const current = byTag.get(name) ?? [];
      current.push(item);
      byTag.set(name, current);
    }
  }
  return [...byTag.entries()]
    .map(([name, tagItems]) => ({
      name,
      count: tagItems.length,
      items: [...tagItems].sort(compareByQuality),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 18);
}

/** Fraction of the pool with strictly lower reach; 0 for the least seen, 1 for the most. */
export function reachPercentiles(pool: DiscoverItem[]) {
  const reaches = pool.map((item) => item.reach).sort((a, b) => a - b);
  const denominator = Math.max(1, pool.length - 1);
  const percentile = new Map<string, number>();
  for (const item of pool) {
    let below = 0;
    while (below < reaches.length && reaches[below] < item.reach) below += 1;
    percentile.set(item.id, below / denominator);
  }
  return percentile;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * The acknowledged best: top Quality among titles with enough reach. Titles
 * the community has barely seen are left for Hidden Gems, unless the pool is
 * too small to fill the shelf without them.
 */
export function pickEssentials(
  pool: DiscoverItem[],
  exclude: ReadonlySet<string>,
  percentile: Map<string, number> = reachPercentiles(pool),
) {
  const { limit, minReachPercentile } = DISCOVER.essentials;
  const candidates = pool.filter((item) => !exclude.has(item.id));
  const seen = candidates
    .filter((item) => (percentile.get(item.id) ?? 0) >= minReachPercentile)
    .sort(compareByQuality)
    .slice(0, limit);
  if (seen.length >= limit) return seen;
  const chosen = new Set(seen.map((item) => item.id));
  const rest = candidates
    .filter((item) => !chosen.has(item.id))
    .sort(compareByQuality)
    .slice(0, limit - seen.length);
  return [...seen, ...rest].sort(compareByQuality);
}

/**
 * Entry points: above-average Quality, widely seen, critics agree, and not
 * defined by rare subgenre tags. If fewer than `limit` clear every bar, the
 * reach, agreement and niche rules relax and only Quality remains.
 */
export function pickGateway(
  pool: DiscoverItem[],
  exclude: ReadonlySet<string>,
  options: { mediaType: MediaType; genre?: string },
  percentile: Map<string, number> = reachPercentiles(pool),
) {
  const { limit, minConsensusConfidence, minReachPercentile, commonSubgenres } =
    DISCOVER.gateway;
  if (pool.length === 0) return [];
  const meanQuality =
    pool.reduce((sum, item) => sum + item.quality, 0) / pool.length;

  const subgenreCounts = new Map<string, number>();
  for (const item of pool) {
    for (const name of subgenreTagNames(item, options.mediaType, options.genre)) {
      subgenreCounts.set(name, (subgenreCounts.get(name) ?? 0) + 1);
    }
  }
  const common = new Set(
    [...subgenreCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, commonSubgenres)
      .map(([name]) => name),
  );
  const isMainstream = (item: DiscoverItem) => {
    const names = subgenreTagNames(item, options.mediaType, options.genre);
    if (names.length === 0) return true;
    const shared = names.filter((name) => common.has(name)).length;
    return shared * 2 >= names.length;
  };

  const candidates = pool.filter(
    (item) => !exclude.has(item.id) && item.quality >= meanQuality,
  );
  const score = (item: DiscoverItem) =>
    item.quality * (0.5 + 0.5 * (percentile.get(item.id) ?? 0));
  const rank = (items: DiscoverItem[]) =>
    [...items].sort(
      (a, b) => score(b) - score(a) || compareByQuality(a, b),
    );

  const strict = candidates.filter(
    (item) =>
      item.consensusConfidence >= minConsensusConfidence &&
      (percentile.get(item.id) ?? 0) >= minReachPercentile &&
      isMainstream(item),
  );
  if (strict.length >= limit) return rank(strict).slice(0, limit);
  return rank(candidates).slice(0, limit);
}

/**
 * High Quality, low reach: at or above the pool's median Quality and in the
 * less-seen part of the pool. Ranked by normalized Quality times obscurity.
 */
export function pickHiddenGems(
  pool: DiscoverItem[],
  exclude: ReadonlySet<string>,
  percentile: Map<string, number> = reachPercentiles(pool),
) {
  const limit = DISCOVER.hiddenGems.limit;
  if (pool.length === 0) return [];
  const qualities = pool.map((item) => item.quality);
  const medianQuality = median(qualities);
  const min = Math.min(...qualities);
  const max = Math.max(...qualities);
  const span = max - min || 1;

  return pool
    .filter(
      (item) =>
        !exclude.has(item.id) &&
        item.quality >= medianQuality &&
        (percentile.get(item.id) ?? 0) <= DISCOVER.hiddenGems.maxReachPercentile,
    )
    .map((item) => ({
      item,
      gem:
        ((item.quality - min) / span) * (1 - (percentile.get(item.id) ?? 0)),
    }))
    .sort((a, b) => b.gem - a.gem || compareByQuality(a.item, b.item))
    .slice(0, limit)
    .map((entry) => entry.item);
}

/** The viewer's own score for a title, if they gave one. */
function personalScore(item: DiscoverItem) {
  return item.computedPersonalScore ?? item.personalRating ?? null;
}

/** Mean of the viewer's own scores across everything they rated of this type. */
export function viewerMeanScore(scoredOfType: DiscoverItem[]) {
  const scores = scoredOfType
    .map(personalScore)
    .filter((score): score is number => score != null);
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

/**
 * Seeds for "If You Liked": the viewer's titles in this world scored at or
 * above their own average, best first. Falls back to the Essentials when the
 * viewer is anonymous or has fewer than two qualifying titles.
 */
export function pickSeeds(
  worldItems: DiscoverItem[],
  essentials: DiscoverItem[],
  viewerMean: number | null,
  limit: number = DISCOVER.ifYouLiked.limit,
) {
  if (viewerMean != null) {
    const own = worldItems
      .filter((item) => {
        const score = personalScore(item);
        return score != null && score >= viewerMean;
      })
      .sort(
        (a, b) =>
          (personalScore(b) ?? 0) - (personalScore(a) ?? 0) ||
          compareByQuality(a, b),
      );
    if (own.length >= 2) return own.slice(0, limit);
  }
  return essentials.slice(0, limit);
}

/**
 * 0–1: the shared facet similarity (director, subgenre, genre, theme, era
 * and place, leads). `rarity` comes from the pool so common genres count
 * less than rare tags.
 */
export function itemSimilarity(
  seed: DiscoverItem,
  candidate: DiscoverItem,
  rarity: FeatureRarity = new Map(),
) {
  return facetSimilarity(seed, candidate, rarity).score;
}

/** The most specific thing two titles share, as the similarity module names it. */
export function sharedFacet(
  seed: DiscoverItem,
  candidate: DiscoverItem,
  rarity: FeatureRarity = new Map(),
): string | null {
  return facetSimilarity(seed, candidate, rarity).shared?.label ?? null;
}

/**
 * For each seed, the most similar unseen title not already on the page. Each
 * partner is used once; chains below the similarity floor are dropped.
 */
export function pickIfYouLiked(
  seeds: DiscoverItem[],
  pool: DiscoverItem[],
  exclude: ReadonlySet<string>,
  rarity: FeatureRarity = new Map(),
): DiscoverChain[] {
  const used = new Set(exclude);
  for (const seed of seeds) used.add(seed.id);
  const chains: DiscoverChain[] = [];
  for (const seed of seeds) {
    let best: { item: DiscoverItem; similarity: number } | null = null;
    for (const candidate of pool) {
      if (used.has(candidate.id)) continue;
      const similarity = itemSimilarity(seed, candidate, rarity);
      if (similarity < DISCOVER.ifYouLiked.minSimilarity) continue;
      if (
        !best ||
        similarity > best.similarity ||
        (similarity === best.similarity &&
          compareByQuality(candidate, best.item) < 0)
      ) {
        best = { item: candidate, similarity };
      }
    }
    if (!best) continue;
    used.add(best.item.id);
    chains.push({
      seed,
      next: best.item,
      sharedFacet: sharedFacet(seed, best.item, rarity),
    });
  }
  return chains;
}

/**
 * All four sections for one world (or subgenre), pairwise disjoint.
 *
 * Gateway is chosen first so entry points are the genuinely widely seen
 * picks rather than whatever Essentials left behind; Essentials then takes
 * the best of the rest with enough reach; Hidden Gems takes the best of what
 * is left below that reach; If You Liked partners come from whatever is
 * still unshown.
 *
 * `worldItems` is every scored row in the world, consumed or not — seeds come
 * from the viewer's own rated titles, which are usually finished. `pool` is
 * the viewer-filtered subset that may actually be shown.
 */
export function buildSections(input: {
  worldItems: DiscoverItem[];
  pool: DiscoverItem[];
  mediaType: MediaType;
  genre?: string;
  viewerMean: number | null;
}): DiscoverSections {
  const percentile = reachPercentiles(input.pool);
  const shown = new Set<string>();

  const gateway = pickGateway(
    input.pool,
    shown,
    { mediaType: input.mediaType, genre: input.genre },
    percentile,
  );
  for (const item of gateway) shown.add(item.id);

  const essentials = pickEssentials(input.pool, shown, percentile);
  for (const item of essentials) shown.add(item.id);

  const hiddenGems = pickHiddenGems(input.pool, shown, percentile);
  for (const item of hiddenGems) shown.add(item.id);

  const seeds = pickSeeds(input.worldItems, essentials, input.viewerMean);
  const ifYouLiked = pickIfYouLiked(
    seeds,
    input.pool,
    shown,
    buildFeatureRarity([...input.worldItems, ...input.pool]),
  );

  return { essentials, gateway, hiddenGems, ifYouLiked };
}
