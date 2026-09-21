/**
 * Pure, deterministic v2 recommendation engine. No database reads.
 *
 * Every signal answers "how much will this viewer like the candidate?" as a
 * 0–100 value centered on 50, plus a 0–1 reliability that says how much
 * evidence backs it. The score is 50 plus the weighted, reliability-scaled
 * deviations; confidence is the sum of weight × reliability. Unknown is
 * therefore different from neutral: an unknown signal moves nothing and adds
 * no confidence, a neutral one adds confidence while moving nothing.
 *
 * Signals:
 *  - similarity: "because you rated X" — the candidate's nearest rated
 *    titles, weighted by how far above or below the viewer's usual rating
 *    they landed. Cosine over genres, tags, creators and country, so a title
 *    with more tags gets no extra credit.
 *  - genre / tag / contributor: signed per-medium feature profiles. Unknown
 *    features lower reliability instead of disappearing; breadth of agreement
 *    raises it.
 *  - friends: followers' opinions centered on each friend's own usual rating,
 *    weighted by overlap-shrunk compatibility.
 *  - consensus: critics, with their own confidence as reliability.
 */
import { calculatePersonalScore } from "./personalScore";
import { clamp } from "./pairwise";
import { calculateRatingCompatibility } from "./compatibility";
import { RECOMMENDATION_V2 } from "./config";

export type V2Tag = {
  name: string;
  status: string;
  category?: string | null;
};
export type V2Item = {
  id: string;
  title: string;
  mediaType: string;
  genres: Array<{ genre: { name: string } }>;
  tags: Array<{ tag: V2Tag }>;
  credits: Array<{ role: string; contributor: { id: string; name: string } }>;
  computedConsensusScore: number | null;
  consensusConfidence: number;
};
export type TasteObservation = {
  media: V2Item;
  personalRating: number | null;
  pairwiseScore: number;
  comparisonCount: number;
  status: string;
  isArchived: boolean;
};
type Feature = {
  sum: number;
  evidence: number;
  label: string;
  titles: Set<string>;
};
/** A rated title kept for nearest-neighbour scoring. */
export type TasteExample = {
  id: string;
  title: string;
  rating: number;
  /** Rating minus the medium baseline, in 0–100 points, clamped ±50. */
  residual: number;
  weight: number;
  vector: Map<string, number>;
  /** Genres and portable tags only, for cross-medium comparison. */
  portable: Map<string, number>;
};
export type TasteProfile = {
  baseline: number;
  ratedCount: number;
  genres: Map<string, Feature>;
  tags: Map<string, Feature>;
  contributors: Map<string, Feature>;
  examples: TasteExample[];
};
export type Signal = {
  value: number | null; // 0–100; null is unknown, 50 is neutral
  reliability: number; // 0–1; amount of independent supporting evidence
  evidence: number;
  detail: string;
  /** The single title that best explains this signal, when there is one. */
  because?: { id: string; title: string; rating: number };
};
export type SignalKey = keyof typeof RECOMMENDATION_V2.weights;
export type V2Explanation = Signal & {
  signal: SignalKey;
  label: string;
  weight: number;
  contribution: number; // signed points relative to neutral 50
};
export type V2Score = {
  score: number;
  confidence: number;
  reason: string;
  explanations: V2Explanation[];
};

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  similarity: "Similar to titles you rated",
  genre: "Genre taste",
  tag: "Tag taste",
  contributor: "Creator taste",
  friends: "Friends",
  consensus: "Critic consensus",
};

const unknown = (detail: string): Signal => ({
  value: null,
  reliability: 0,
  evidence: 0,
  detail,
});
const unique = (values: string[]) => [...new Set(values)];
const creditKey = (credit: V2Item["credits"][number]) =>
  `${credit.role}:${credit.contributor.id}`;
function roleWeight(role: string): number {
  return (
    RECOMMENDATION_V2.roleWeights[
      role as keyof typeof RECOMMENDATION_V2.roleWeights
    ] ?? 0
  );
}
function tagWeight(category: string | null | undefined): number {
  const weights: Record<string, number> =
    RECOMMENDATION_V2.similarity.tagCategoryWeights;
  const weight = category ? weights[category] : undefined;
  return weight ?? weights.default;
}
function approvedTags(item: V2Item) {
  return item.tags.filter((entry) => entry.tag.status === "APPROVED");
}
function isPortableTag(tag: V2Tag) {
  return (RECOMMENDATION_V2.similarity.portableTagCategories as readonly string[]).includes(
    tag.category ?? "",
  );
}

/**
 * A stored rating that expresses an opinion, or null. The rating control
 * bottoms out at a half star, so a stored 0 cannot have been entered by a
 * person; it is a placeholder and is read as no rating at all.
 */
export function explicitRating(value: number | null | undefined) {
  return value != null && value >= RECOMMENDATION_V2.minExplicitRating
    ? value
    : null;
}

/**
 * The taste a row expresses, or null when it expresses none. Explicit ratings
 * count at any status; a status alone is never a dislike.
 */
export function observedTaste(row: TasteObservation) {
  if (row.isArchived) return null;
  const explicit = explicitRating(row.personalRating);
  if (explicit == null && row.status !== "COMPLETED") return null;
  const result = calculatePersonalScore({
    explicitRating: explicit,
    pairwiseScore: row.pairwiseScore,
    comparisonCount: row.comparisonCount,
  });
  if (result.score == null) return null;
  return {
    rating: result.score,
    weight: explicit != null ? 1 : result.confidence,
  };
}

/** Weighted feature vector for cosine similarity. Duplicates collapse to one entry. */
export function itemVector(item: V2Item): Map<string, number> {
  const vector = new Map<string, number>();
  for (const name of unique(item.genres.map((g) => g.genre.name))) {
    vector.set(`g:${name}`, RECOMMENDATION_V2.similarity.genreWeight);
  }
  const seenTags = new Set<string>();
  for (const entry of approvedTags(item)) {
    if (seenTags.has(entry.tag.name)) continue;
    seenTags.add(entry.tag.name);
    vector.set(`t:${entry.tag.name}`, tagWeight(entry.tag.category));
  }
  const seenCredits = new Set<string>();
  for (const credit of item.credits) {
    const key = creditKey(credit);
    const weight = roleWeight(credit.role);
    if (weight <= 0 || seenCredits.has(key)) continue;
    seenCredits.add(key);
    vector.set(`c:${key}`, weight);
  }
  return vector;
}

/** Genres plus theme/mood/country tags: the part of taste that crosses media. */
export function portableVector(item: V2Item): Map<string, number> {
  const vector = new Map<string, number>();
  for (const name of unique(item.genres.map((g) => g.genre.name))) {
    vector.set(`g:${name}`, RECOMMENDATION_V2.similarity.genreWeight);
  }
  for (const entry of approvedTags(item)) {
    if (!isPortableTag(entry.tag)) continue;
    vector.set(`t:${entry.tag.name}`, tagWeight(entry.tag.category));
  }
  return vector;
}

export function cosine(a: Map<string, number>, b: Map<string, number>) {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [key, weight] of a) {
    na += weight * weight;
    const other = b.get(key);
    if (other != null) dot += weight * other;
  }
  for (const weight of b.values()) nb += weight * weight;
  return dot === 0 ? 0 : dot / Math.sqrt(na * nb);
}

export function buildTasteProfiles(
  rows: TasteObservation[],
  excludeIds: ReadonlySet<string> = new Set(),
) {
  const groups = new Map<
    string,
    Array<{ row: TasteObservation; rating: number; weight: number }>
  >();
  const seen = new Set<string>();
  for (const row of rows) {
    if (excludeIds.has(row.media.id) || seen.has(row.media.id)) continue;
    seen.add(row.media.id);
    const observed = observedTaste(row);
    if (!observed) continue;
    const group = groups.get(row.media.mediaType) ?? [];
    group.push({ row, ...observed });
    groups.set(row.media.mediaType, group);
  }
  const profiles = new Map<string, TasteProfile>();
  for (const [medium, group] of groups) {
    group.sort((a, b) => a.row.media.id.localeCompare(b.row.media.id));
    const totalWeight = group.reduce((sum, item) => sum + item.weight, 0);
    const baseline =
      (group.reduce((sum, item) => sum + item.rating * item.weight, 0) +
        RECOMMENDATION_V2.baselinePrior * RECOMMENDATION_V2.fallbackRating) /
      (totalWeight + RECOMMENDATION_V2.baselinePrior);
    const profile: TasteProfile = {
      baseline,
      ratedCount: group.length,
      genres: new Map(),
      tags: new Map(),
      contributors: new Map(),
      examples: [],
    };
    for (const { row, rating, weight } of group) {
      const residual = clamp(
        (rating - baseline) * RECOMMENDATION_V2.ratingPointScale,
        -50,
        50,
      );
      const add = (map: Map<string, Feature>, key: string, label: string) => {
        const feature = map.get(key) ?? {
          sum: 0,
          evidence: 0,
          label,
          titles: new Set<string>(),
        };
        feature.sum += residual * weight;
        feature.evidence += weight;
        feature.titles.add(row.media.id);
        map.set(key, feature);
      };
      for (const genre of unique(row.media.genres.map((g) => g.genre.name)))
        add(profile.genres, genre, genre);
      for (const tag of unique(approvedTags(row.media).map((t) => t.tag.name)))
        add(profile.tags, tag, tag);
      const credits = new Map(row.media.credits.map((c) => [creditKey(c), c]));
      for (const [key, credit] of credits) {
        if (roleWeight(credit.role) > 0)
          add(
            profile.contributors,
            key,
            `${credit.contributor.name} (${credit.role.toLowerCase()})`,
          );
      }
      profile.examples.push({
        id: row.media.id,
        title: row.media.title,
        rating,
        residual,
        weight,
        vector: itemVector(row.media),
        portable: portableVector(row.media),
      });
    }
    profiles.set(medium, profile);
  }
  return profiles;
}

/**
 * Nearest rated titles. Same-medium neighbours use the full vector; when the
 * viewer has little history in this medium, other media contribute through
 * the portable vector at reduced reliability.
 */
export function similaritySignal(
  item: V2Item,
  profiles: Map<string, TasteProfile>,
): Signal {
  const { neighbours, minSimilarity, prior, crossMediumFactor } =
    RECOMMENDATION_V2.similarity;
  const vector = itemVector(item);
  const portable = portableVector(item);

  const score = (
    examples: TasteExample[],
    pick: (example: TasteExample) => Map<string, number>,
    against: Map<string, number>,
    factor: number,
  ) => {
    const matched = examples
      .filter((example) => example.id !== item.id)
      .map((example) => ({ example, sim: cosine(against, pick(example)) }))
      .filter((entry) => entry.sim >= minSimilarity)
      .sort(
        (a, b) =>
          b.sim - a.sim || a.example.id.localeCompare(b.example.id),
      )
      .slice(0, neighbours);
    if (matched.length === 0) return null;
    let weighted = 0;
    let support = 0;
    for (const { example, sim } of matched) {
      const w = sim * sim * example.weight;
      weighted += w * example.residual;
      support += w;
    }
    if (support <= 0) return null;
    const reliability = (support / (support + prior)) * factor;
    const best = [...matched].sort(
      (a, b) =>
        Math.abs(b.example.residual) * b.sim -
          Math.abs(a.example.residual) * a.sim ||
        a.example.id.localeCompare(b.example.id),
    )[0].example;
    return {
      value: clamp(50 + weighted / support, 0, 100),
      reliability,
      evidence: matched.length,
      best,
    };
  };

  const own = profiles.get(item.mediaType);
  const same = own
    ? score(own.examples, (e) => e.vector, vector, 1)
    : null;
  let result = same;
  if (!same || same.reliability < RECOMMENDATION_V2.similarity.crossMediumBelow) {
    const others = [...profiles.entries()]
      .filter(([medium]) => medium !== item.mediaType)
      .flatMap(([, profile]) => profile.examples);
    const cross = score(others, (e) => e.portable, portable, crossMediumFactor);
    if (cross && (!result || cross.reliability > result.reliability)) {
      result = cross;
    }
  }
  if (!result) {
    return unknown(
      own
        ? "Nothing you have rated resembles this title yet."
        : "No rated history for this medium yet.",
    );
  }
  const direction =
    result.best.residual > 0 ? "above" : result.best.residual < 0 ? "below" : "at";
  return {
    value: result.value,
    reliability: result.reliability,
    evidence: result.evidence,
    because: {
      id: result.best.id,
      title: result.best.title,
      rating: result.best.rating,
    },
    detail: `Closest to ${result.best.title}, which you rated ${formatRating(result.best.rating)} (${direction} your usual). ${result.evidence} similar rated title${result.evidence === 1 ? "" : "s"} considered.`,
  };
}

function formatRating(value: number) {
  return Number.isInteger(value) ? `${value}/10` : `${value.toFixed(1)}/10`;
}

/**
 * Signed feature evidence. The value is the reliability-weighted mean of the
 * known features' residuals; the reliability grows with how many of the
 * candidate's features are known and how well each is supported, so a title
 * whose features you have never rated moves the score little, and three
 * loved genres beat one.
 */
function featureSignal(
  keys: Array<{ key: string; strength: number }>,
  features: Map<string, Feature> | undefined,
): Signal {
  if (!features) return unknown("No rated history for this medium yet.");
  const distinct = [...new Map(keys.map((key) => [key.key, key])).values()].filter(
    (key) => key.strength > 0,
  );
  if (distinct.length === 0) return unknown("No features to compare.");
  const matched = distinct.flatMap(({ key, strength }) => {
    const feature = features.get(key);
    if (!feature) return [];
    const reliability =
      (feature.evidence / (feature.evidence + RECOMMENDATION_V2.featurePrior)) *
      strength;
    return [{ feature, delta: feature.sum / feature.evidence, reliability }];
  });
  if (matched.length === 0)
    return unknown("No matching rated history for these features.");
  const support = matched.reduce((sum, m) => sum + m.reliability, 0);
  const delta = matched.reduce((sum, m) => sum + m.delta * m.reliability, 0) / support;
  const reliability = support / (distinct.length + RECOMMENDATION_V2.featureBreadthPrior);
  const strongest = [...matched].sort(
    (a, b) =>
      Math.abs(b.delta * b.reliability) - Math.abs(a.delta * a.reliability) ||
      a.feature.label.localeCompare(b.feature.label),
  )[0];
  const count = strongest.feature.titles.size;
  const direction =
    strongest.delta > 0 ? "above" : strongest.delta < 0 ? "below" : "around";
  return {
    value: clamp(50 + delta, 0, 100),
    reliability,
    evidence: new Set(matched.flatMap((m) => [...m.feature.titles])).size,
    detail: `${strongest.feature.label}: you usually rate this ${direction} your average, from ${count} rated title${count === 1 ? "" : "s"}. ${matched.length} of ${distinct.length} feature${distinct.length === 1 ? "" : "s"} known.`,
  };
}

export type FriendRating = {
  userId: string;
  mediaId: string;
  mediaType: string;
  rating: number | null;
  status: string;
};
export type FriendTrust = { compatibility: number; overlap: number };
export const friendKey = (userId: string, medium: string) =>
  `${medium}:${userId}`;

export function buildFriendTrust(
  viewer: Array<{ mediaId: string; rating: number }>,
  friends: FriendRating[],
  excludeIds: ReadonlySet<string> = new Set(),
) {
  const ownRatings = new Map(
    viewer
      .filter((r) => !excludeIds.has(r.mediaId))
      .map((r) => [r.mediaId, r.rating]),
  );
  const pairs = new Map<
    string,
    Array<{ viewerRating: number; otherRating: number }>
  >();
  const seen = new Set<string>();
  for (const row of friends) {
    if (seen.has(`${row.userId}:${row.mediaId}`)) continue;
    seen.add(`${row.userId}:${row.mediaId}`);
    const own = ownRatings.get(row.mediaId);
    if (row.rating == null || own == null || excludeIds.has(row.mediaId))
      continue;
    const key = friendKey(row.userId, row.mediaType);
    const group = pairs.get(key) ?? [];
    group.push({ viewerRating: own, otherRating: row.rating });
    pairs.set(key, group);
  }
  return new Map(
    [...pairs].map(([key, group]) => {
      const result = calculateRatingCompatibility(group);
      return [
        key,
        {
          compatibility: result.compatibilityScore,
          overlap: result.overlapCount,
        },
      ];
    }),
  );
}

/**
 * Each friend's usual rating per medium, shrunk toward the fallback so a
 * friend with two ratings does not get an extreme baseline. A friend's 7 means
 * something different when they average 9 than when they average 6.
 */
export function buildFriendBaselines(friends: FriendRating[]) {
  const sums = new Map<string, { sum: number; count: number }>();
  const seen = new Set<string>();
  for (const row of friends) {
    const rating = explicitRating(row.rating);
    if (rating == null) continue;
    const dedupe = `${row.userId}:${row.mediaId}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const key = friendKey(row.userId, row.mediaType);
    const acc = sums.get(key) ?? { sum: 0, count: 0 };
    acc.sum += rating;
    acc.count += 1;
    sums.set(key, acc);
  }
  return new Map(
    [...sums].map(([key, acc]) => [
      key,
      (acc.sum + RECOMMENDATION_V2.baselinePrior * RECOMMENDATION_V2.fallbackRating) /
        (acc.count + RECOMMENDATION_V2.baselinePrior),
    ]),
  );
}

export function friendSignal(
  rows: FriendRating[],
  trust: Map<string, FriendTrust>,
  baselines: Map<string, number> = new Map(),
): Signal {
  let weightedDelta = 0;
  let evidence = 0;
  let ratingCount = 0;
  let statusCount = 0;
  for (const raw of new Map(rows.map((r) => [r.userId, r])).values()) {
    const row = { ...raw, rating: explicitRating(raw.rating) };
    const key = friendKey(row.userId, row.mediaType);
    const support = trust.get(key);
    const overlapReliability = support
      ? support.overlap / (support.overlap + RECOMMENDATION_V2.overlapPrior)
      : 0;
    const compatibility =
      0.5 + ((support?.compatibility ?? 50) / 100 - 0.5) * overlapReliability;
    // Evidence, not a normalized average alone, preserves compatibility's effect
    // even with exactly one friend. Completion without a rating is only weak interest.
    const engagement =
      row.rating != null
        ? 1
        : row.status === "COMPLETED"
          ? 0.15
          : row.status === "WATCHLIST"
            ? 0.05
            : 0;
    if (!engagement) continue;
    const weight = compatibility * engagement;
    const baseline = baselines.get(key) ?? RECOMMENDATION_V2.fallbackRating;
    const opinion =
      row.rating != null
        ? clamp(
            50 + (row.rating - baseline) * RECOMMENDATION_V2.ratingPointScale,
            0,
            100,
          )
        : RECOMMENDATION_V2.statusOnlyInterest;
    weightedDelta += (opinion - 50) * weight;
    evidence += weight;
    if (row.rating != null) ratingCount++;
    else statusCount++;
  }
  if (!evidence) return unknown("No usable opinions from people you follow.");
  return {
    value: clamp(50 + weightedDelta / evidence, 0, 100),
    reliability: evidence / (evidence + RECOMMENDATION_V2.friendPrior),
    evidence,
    detail: `${ratingCount} friend rating${ratingCount === 1 ? "" : "s"}, ${statusCount} status-only signal${statusCount === 1 ? "" : "s"}; each relative to that friend's usual rating, weighted by agreement with you and shared-rating count.`,
  };
}

export function scoreV2(
  item: V2Item,
  profiles: Map<string, TasteProfile>,
  friends: Signal = unknown("No usable opinions from people you follow."),
): V2Score {
  const profile = profiles.get(item.mediaType);
  const signals: Record<SignalKey, Signal> = {
    similarity: similaritySignal(item, profiles),
    genre: featureSignal(
      item.genres.map((g) => ({ key: g.genre.name, strength: 1 })),
      profile?.genres,
    ),
    tag: featureSignal(
      approvedTags(item).map((t) => ({ key: t.tag.name, strength: 1 })),
      profile?.tags,
    ),
    contributor: featureSignal(
      item.credits.map((c) => ({
        key: creditKey(c),
        strength: roleWeight(c.role),
      })),
      profile?.contributors,
    ),
    friends,
    consensus:
      item.computedConsensusScore == null
        ? unknown("No external ratings available.")
        : {
            // Centered on the catalog's typical critic score, not on 5: a 6
            // is below what most titles get and should read that way.
            value: clamp(
              50 +
                (item.computedConsensusScore -
                  RECOMMENDATION_V2.consensusNeutral) *
                  RECOMMENDATION_V2.consensusPointScale,
              0,
              100,
            ),
            reliability: clamp(item.consensusConfidence, 0, 1),
            evidence: clamp(item.consensusConfidence, 0, 1),
            detail: `Critics: ${item.computedConsensusScore}/10 against a typical ${RECOMMENDATION_V2.consensusNeutral}; reliability comes from source count and agreement.`,
          },
  };
  const explanations: V2Explanation[] = (
    Object.keys(signals) as SignalKey[]
  ).map((signal) => {
    const data = signals[signal];
    const weight = RECOMMENDATION_V2.weights[signal];
    return {
      ...data,
      signal,
      label: SIGNAL_LABELS[signal],
      weight,
      contribution:
        data.value == null
          ? 0
          : weight *
            data.reliability *
            (data.value - RECOMMENDATION_V2.neutral),
    };
  });
  const total = explanations.reduce<number>(
    (sum, e) => sum + e.contribution,
    RECOMMENDATION_V2.neutral,
  );
  const confidence = explanations.reduce(
    (sum, e) => sum + e.weight * e.reliability,
    0,
  );
  // The reason names the strongest positive signal, but a personal signal
  // (your own ratings, your friends) wins over critics whenever it carries
  // at least half as much weight: "closest to X, which you loved" is more
  // useful than "critics like it" even when critics contributed slightly more.
  const positive = [...explanations]
    .filter((e) => e.contribution > 0.1)
    .sort((a, b) => b.contribution - a.contribution);
  const top = positive[0];
  const personal = positive.find((e) => e.signal !== "consensus");
  const lead =
    top && personal && personal.contribution >= top.contribution * 0.5
      ? personal
      : top;
  return {
    // Keep precision for ranking; round only in the UI.
    score: clamp(total, 0, 100),
    confidence,
    reason:
      lead?.detail ??
      (confidence > 0
        ? "Available evidence is neutral or below your usual preferences."
        : "Not enough evidence to personalize this title yet."),
    explanations,
  };
}
