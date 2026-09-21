/** Pure, deterministic v2 engine. No database reads or changes to the v1 model. */
import { calculatePersonalScore } from "./personalScore";
import { clamp } from "./pairwise";
import { calculateRatingCompatibility } from "./compatibility";
import { RECOMMENDATION_V2 } from "./config";

export type V2Item = {
  id: string;
  title: string;
  mediaType: string;
  genres: Array<{ genre: { name: string } }>;
  tags: Array<{ tag: { name: string; status: string } }>;
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
export type TasteProfile = {
  baseline: number;
  ratedCount: number;
  genres: Map<string, Feature>;
  tags: Map<string, Feature>;
  contributors: Map<string, Feature>;
};
export type Signal = {
  value: number | null; // 0–100; null is unknown, 50 is neutral
  reliability: number; // 0–1; amount of independent supporting evidence
  evidence: number;
  detail: string;
};
export type V2Explanation = Signal & {
  signal: keyof typeof RECOMMENDATION_V2.weights;
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

export function observedTaste(row: TasteObservation) {
  if (row.isArchived) return null;
  // Explicit ratings express taste at any status. Status alone is not dislike.
  if (row.personalRating == null && row.status !== "COMPLETED") return null;
  const result = calculatePersonalScore({
    explicitRating: row.personalRating,
    pairwiseScore: row.pairwiseScore,
    comparisonCount: row.comparisonCount,
  });
  if (result.score == null) return null;
  return {
    rating: result.score,
    weight: row.personalRating != null ? 1 : result.confidence,
  };
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
      for (const tag of unique(
        row.media.tags
          .filter((t) => t.tag.status === "APPROVED")
          .map((t) => t.tag.name),
      ))
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
    }
    profiles.set(medium, profile);
  }
  return profiles;
}

function featureSignal(
  keys: Array<{ key: string; strength: number }>,
  features: Map<string, Feature> | undefined,
): Signal {
  if (!features) return unknown("No rated history for this medium yet.");
  const matched = [
    ...new Map(keys.map((key) => [key.key, key])).values(),
  ].flatMap(({ key, strength }) => {
    const feature = features.get(key);
    if (!feature || strength <= 0) return [];
    const reliability =
      feature.evidence / (feature.evidence + RECOMMENDATION_V2.featurePrior);
    return [
      {
        feature,
        delta: (feature.sum / feature.evidence) * strength,
        reliability,
      },
    ];
  });
  if (!matched.length)
    return unknown("No matching rated history for these features.");
  // Average, never sum: adding metadata cannot multiply a candidate's score.
  const reliability =
    matched.reduce((sum, m) => sum + m.reliability, 0) / matched.length;
  const delta =
    matched.reduce((sum, m) => sum + m.delta * m.reliability, 0) /
    matched.length;
  const aligned = matched.filter(
    (m) => Math.sign(m.delta) === Math.sign(delta),
  );
  const strongest = [...(aligned.length ? aligned : matched)].sort(
    (a, b) =>
      Math.abs(b.delta * b.reliability) - Math.abs(a.delta * a.reliability) ||
      a.feature.label.localeCompare(b.feature.label),
  )[0];
  const count = strongest.feature.titles.size;
  const direction =
    strongest.delta > 0 ? "above" : strongest.delta < 0 ? "below" : "around";
  return {
    value: clamp(50 + delta / reliability, 0, 100),
    reliability,
    // Do not count the same title repeatedly across shared features.
    evidence: new Set(matched.flatMap((m) => [...m.feature.titles])).size,
    detail: `${strongest.feature.label}: average preference ${direction} your usual rating for this medium, from ${count} rated title${count === 1 ? "" : "s"}. Averaged across ${matched.length} matched feature${matched.length === 1 ? "" : "s"}.`,
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

export function friendSignal(
  rows: FriendRating[],
  trust: Map<string, FriendTrust>,
): Signal {
  let weightedDelta = 0;
  let evidence = 0;
  let ratingCount = 0;
  let statusCount = 0;
  for (const row of new Map(rows.map((r) => [r.userId, r])).values()) {
    const support = trust.get(friendKey(row.userId, row.mediaType));
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
    weightedDelta +=
      ((row.rating != null ? clamp(row.rating * 10, 0, 100) : 55) - 50) *
      weight;
    evidence += weight;
    if (row.rating != null) ratingCount++;
    else statusCount++;
  }
  if (!evidence) return unknown("No usable opinions from people you follow.");
  return {
    value: clamp(50 + weightedDelta / evidence, 0, 100),
    reliability: evidence / (evidence + RECOMMENDATION_V2.friendPrior),
    evidence,
    detail: `${ratingCount} explicit friend rating${ratingCount === 1 ? "" : "s"}, ${statusCount} status-only signal${statusCount === 1 ? "" : "s"}; weighted by same-medium agreement and shared-rating count.`,
  };
}

export function scoreV2(
  item: V2Item,
  profiles: Map<string, TasteProfile>,
  friends: Signal = unknown("No usable opinions from people you follow."),
): V2Score {
  const profile = profiles.get(item.mediaType);
  const signals = {
    genre: featureSignal(
      item.genres.map((g) => ({ key: g.genre.name, strength: 1 })),
      profile?.genres,
    ),
    tag: featureSignal(
      item.tags
        .filter((t) => t.tag.status === "APPROVED")
        .map((t) => ({ key: t.tag.name, strength: 1 })),
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
            value: clamp(item.computedConsensusScore * 10, 0, 100),
            reliability: clamp(item.consensusConfidence, 0, 1),
            evidence: clamp(item.consensusConfidence, 0, 1),
            detail: `External consensus ${item.computedConsensusScore}/10; reliability comes from source count and agreement.`,
          },
  };
  const labels = {
    genre: "Genre taste",
    tag: "Tag taste",
    contributor: "Creator taste",
    friends: "Friends",
    consensus: "External consensus",
  };
  const explanations: V2Explanation[] = (
    Object.keys(signals) as Array<keyof typeof signals>
  ).map((signal) => {
    const data = signals[signal];
    const weight = RECOMMENDATION_V2.weights[signal];
    return {
      ...data,
      signal,
      label: labels[signal],
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
  const positive = [...explanations]
    .filter((e) => e.contribution > 0.1)
    .sort((a, b) => b.contribution - a.contribution)[0];
  return {
    // Keep precision for ranking; round only in the UI.
    score: clamp(total, 0, 100),
    confidence,
    reason:
      positive?.detail ??
      (confidence > 0
        ? "Available evidence is neutral or below your usual preferences."
        : "Not enough evidence to personalize this title yet."),
    explanations,
  };
}
