import { prisma } from "@/lib/prisma";
import {
  getDataHealthCounts,
  getFollowCompatibility,
  getGenreInsights,
} from "@/lib/insights";
import { visibleMediaTypeFilter } from "@/lib/media-types";
import { evaluateBadges, type BadgeKey } from "@/lib/scoring/badges";
import { requireUser, userInitial } from "@/lib/user";
import { DEFAULT_USER_MEDIA } from "@/lib/db/user-media";
import { getFollowingIds } from "@/lib/social/follows";
import type { MediaStatus, MediaType } from "@prisma/client";
import { statusLabel } from "@/lib/status-labels";

/**
 * Aggregations backing the Profile page. Everything here is derived from real
 * library data — no invented confidence numbers. Scoped to the current user
 * for the friend-related signals; the library itself is still global until
 * per-item ownership lands.
 */

const COMPLETED_COMPARISON_TARGET = 3;

const TASTE_AXES: Array<{ context: string; label: string }> = [
  { context: "STORY", label: "Story" },
  { context: "VISUALS", label: "Visuals" },
  { context: "MUSIC", label: "Music" },
  { context: "GAMEPLAY", label: "Gameplay" },
  { context: "REWATCHABILITY", label: "Rewatch" },
  { context: "COMFORT", label: "Comfort" },
  { context: "SOCIAL", label: "Social" },
];

// Cross-mediaType aggregation on the profile, so the labels here are the
// generic (type-agnostic) ones from `statusLabel(status)`.
const STATUS_ORDER: Array<{ status: MediaStatus; label: string }> = (
  ["COMPLETED", "IN_PROGRESS", "BACKLOG", "WATCHLIST", "PAUSED", "DROPPED"] as MediaStatus[]
).map((status) => ({ status, label: statusLabel(status) }));

const SIGNAL_LABELS: Record<
  Exclude<BadgeKey, "hidden_gem">,
  { label: string; description: string }
> = {
  sleeper_hit: {
    label: "Sleeper Hits",
    description: "Critically loved titles still waiting in your library.",
  },
  cold_take: {
    label: "Cold Takes",
    description: "You rated these far higher than the critics did.",
  },
  hot_take_failed: {
    label: "Not For You",
    description: "Critic darlings that didn't land for you.",
  },
  friend_favorite_untouched: {
    label: "Friend Favorites",
    description: "Friends love these and you haven't started them.",
  },
  polarizing: {
    label: "Polarizing",
    description: "Titles critics sharply disagree on.",
  },
};

function relativeLabel(date: Date | null): string {
  if (!date) return "never";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function monthYear(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function calibrationCopy(score: number): string {
  if (score >= 80)
    return "Medialy understands your taste well. Keep rating to stay sharp.";
  if (score >= 55)
    return "A solid read on your taste. More ratings and comparisons sharpen it.";
  if (score >= 30)
    return "Still learning your taste. Rate and compare more to improve.";
  return "Early days — rate and compare titles so Medialy can calibrate.";
}

export type ProfileData = Awaited<ReturnType<typeof getProfileData>>;

export async function getProfileData() {
  const user = await requireUser("/profile");
  const mediaType = visibleMediaTypeFilter();

  const followingIds = await getFollowingIds(user.id);

  const [
    rawItems,
    comparisonCount,
    contextGroups,
    genreInsights,
    followCompatibility,
    healthCounts,
    followedUserRatingRows,
  ] = await Promise.all([
    prisma.mediaItem.findMany({
      where: {
        mediaType,
        OR: [
          { userMedia: { none: { userId: user.id } } },
          { userMedia: { some: { userId: user.id, isArchived: false } } },
        ],
      },
      select: {
        id: true,
        title: true,
        mediaType: true,
        posterUrl: true,
        computedConsensusScore: true,
        consensusConfidence: true,
        createdAt: true,
        updatedAt: true,
        externalRatings: { select: { source: true, score: true, scale: true } },
        userMedia: {
          where: { userId: user.id },
          take: 1,
          select: {
            status: true,
            personalRating: true,
            computedPersonalScore: true,
            personalScoreConfidence: true,
            comparisonCount: true,
          },
        },
      },
    }),
    prisma.pairwiseComparison.count({
      where: { userId: user.id, winner: { mediaType } },
    }),
    prisma.pairwiseComparison.groupBy({
      by: ["context"],
      where: { userId: user.id, winner: { mediaType } },
      _count: { _all: true },
    }),
    getGenreInsights(),
    getFollowCompatibility(user.id),
    getDataHealthCounts(),
    followingIds.length > 0
      ? prisma.userMedia.findMany({
          where: {
            userId: { in: followingIds },
            isArchived: false,
            media: { mediaType },
            personalRating: { not: null },
          },
          select: { mediaId: true, personalRating: true },
        })
      : Promise.resolve([] as Array<{ mediaId: string; personalRating: number | null }>),
  ]);

  // Index followed-user ratings by mediaId for fast lookup during badge eval.
  const followedRatingsByMedia = new Map<
    string,
    Array<{ rating: number | null }>
  >();
  for (const row of followedUserRatingRows) {
    const list = followedRatingsByMedia.get(row.mediaId) ?? [];
    list.push({ rating: row.personalRating });
    followedRatingsByMedia.set(row.mediaId, list);
  }

  // Flatten per-user fields up onto each item so the existing reducers below
  // don't need to know about `userMedia`.
  const items = rawItems.map((row) => {
    const um = row.userMedia[0];
    return {
      ...row,
      status: um?.status ?? DEFAULT_USER_MEDIA.status,
      personalRating: um?.personalRating ?? null,
      computedPersonalScore: um?.computedPersonalScore ?? null,
      personalScoreConfidence:
        um?.personalScoreConfidence ?? DEFAULT_USER_MEDIA.personalScoreConfidence,
      comparisonCount: um?.comparisonCount ?? DEFAULT_USER_MEDIA.comparisonCount,
    };
  });

  const totalItems = items.length;

  // Header stats
  const watchlistCount = items.filter(
    (item) => item.status === "WATCHLIST" || item.status === "BACKLOG",
  ).length;

  const confidenceItems = items.filter(
    (item) => item.computedPersonalScore != null,
  );
  const confidence = confidenceItems.length
    ? Math.round(
        (confidenceItems.reduce(
          (sum, item) => sum + (item.personalScoreConfidence ?? 0),
          0,
        ) /
          confidenceItems.length) *
          100,
      )
    : 0;

  const createdDates = items
    .map((item) => item.createdAt)
    .sort((a, b) => a.getTime() - b.getTime());
  const trackingSince = monthYear(createdDates[0] ?? user.createdAt);
  const lastUpdatedDate = items
    .map((item) => item.updatedAt)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  // Taste radar — derived from which lens you compare titles through
  const contextCounts = new Map<string, number>();
  for (const group of contextGroups) {
    if (!group.context) continue;
    contextCounts.set(group.context, group._count._all);
  }
  const radarTotal = TASTE_AXES.reduce(
    (sum, axis) => sum + (contextCounts.get(axis.context) ?? 0),
    0,
  );
  const maxAxis = Math.max(
    1,
    ...TASTE_AXES.map((axis) => contextCounts.get(axis.context) ?? 0),
  );
  const tasteRadar = {
    hasData: radarTotal >= 3,
    total: radarTotal,
    axes: TASTE_AXES.map((axis) => {
      const count = contextCounts.get(axis.context) ?? 0;
      return {
        label: axis.label,
        count,
        // Scale so the strongest lens anchors the chart, with share for copy.
        value: Math.round((count / maxAxis) * 100),
        share: pct(count, radarTotal),
      };
    }),
  };

  // Media mix
  const mixCounts = new Map<MediaType, number>();
  for (const item of items) {
    mixCounts.set(item.mediaType, (mixCounts.get(item.mediaType) ?? 0) + 1);
  }
  const mediaMix = [...mixCounts.entries()]
    .map(([type, count]) => ({
      mediaType: type,
      count,
      share: pct(count, totalItems),
    }))
    .sort((a, b) => b.count - a.count);

  // Top genres
  const topGenres = genreInsights
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((genre) => ({
      name: genre.name,
      share: genre.share,
      averageScore: genre.averageScore,
    }));

  // Calibration — honest blend of rating confidence + comparison coverage
  const completedItems = items.filter((item) => item.status === "COMPLETED");
  const wellComparedCount = completedItems.filter(
    (item) => item.comparisonCount >= COMPLETED_COMPARISON_TARGET,
  ).length;
  const comparisonCoverage = pct(wellComparedCount, completedItems.length);
  const calibrationScore = Math.round(
    confidence * 0.5 + comparisonCoverage * 0.5,
  );

  // Follow compatibility — strongest signal first.
  const rankedFollows = followCompatibility
    .filter((entry) => entry.overlapCount > 0)
    .sort(
      (a, b) =>
        b.compatibilityScore - a.compatibilityScore ||
        b.overlapCount - a.overlapCount,
    );
  const topFollow = rankedFollows[0] ?? null;

  // Library status breakdown
  const statusCounts = new Map<string, number>();
  for (const item of items) {
    statusCounts.set(item.status, (statusCounts.get(item.status) ?? 0) + 1);
  }
  const libraryStatus = STATUS_ORDER.map((entry) => ({
    label: entry.label,
    count: statusCounts.get(entry.status) ?? 0,
    share: pct(statusCounts.get(entry.status) ?? 0, totalItems),
  })).filter((entry) => entry.count > 0);

  // Recent ratings
  const recentRatings = items
    .filter((item) => item.personalRating != null)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      title: item.title,
      mediaType: item.mediaType,
      posterUrl: item.posterUrl,
      rating: item.personalRating ?? 0,
    }));

  // Badge-driven signals
  const signalCounts = new Map<BadgeKey, number>();
  for (const item of items) {
    const badges = evaluateBadges({
      status: item.status,
      personalRating: item.personalRating,
      computedPersonalScore: item.computedPersonalScore,
      computedConsensusScore: item.computedConsensusScore,
      consensusConfidence: item.consensusConfidence,
      externalRatings: item.externalRatings,
      followedUserRatings: followedRatingsByMedia.get(item.id),
    });
    for (const badge of badges) {
      signalCounts.set(badge.key, (signalCounts.get(badge.key) ?? 0) + 1);
    }
  }
  const signals = (
    Object.keys(SIGNAL_LABELS) as Array<Exclude<BadgeKey, "hidden_gem">>
  )
    .map((key) => ({
      key,
      label: SIGNAL_LABELS[key].label,
      description: SIGNAL_LABELS[key].description,
      count: signalCounts.get(key) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
  const topSignal = signals.find((signal) => signal.count > 0) ?? null;

  // Data health
  const healthChecklist = [
    {
      label: "Ratings",
      coverage: pct(
        items.filter((item) => item.personalRating != null).length,
        totalItems,
      ),
    },
    {
      label: "Comparisons",
      coverage: pct(
        items.filter(
          (item) => item.comparisonCount >= COMPLETED_COMPARISON_TARGET,
        ).length,
        totalItems,
      ),
    },
    {
      label: "Posters",
      coverage: pct(
        totalItems - healthCounts.missingPosters,
        totalItems,
      ),
    },
    {
      label: "Metadata",
      coverage: pct(
        totalItems -
          healthCounts.missingGenres -
          healthCounts.missingDates,
        Math.max(totalItems, 1),
      ),
    },
  ].map((entry) => ({
    ...entry,
    state:
      entry.coverage >= 90
        ? "Complete"
        : entry.coverage >= 70
          ? "Strong"
          : entry.coverage >= 45
            ? "Good"
            : "Needs work",
  }));
  const healthScore = healthChecklist.length
    ? Math.round(
        healthChecklist.reduce((sum, entry) => sum + entry.coverage, 0) /
          healthChecklist.length,
      )
    : 0;

  return {
    user: {
      displayName: user.displayName,
      initial: userInitial(user.displayName),
      avatarColor: user.avatarColor,
    },
    header: {
      trackingSince,
      lastUpdatedLabel: relativeLabel(lastUpdatedDate ?? null),
      libraryFresh: healthCounts.lowComparisonItems === 0,
      stats: {
        totalItems,
        watchlistCount,
        comparisonCount,
        confidence,
      },
    },
    tasteRadar,
    mediaMix,
    topGenres,
    calibration: {
      score: calibrationScore,
      copy: calibrationCopy(calibrationScore),
    },
    topFollow,
    comparisonCoverage: {
      percent: comparisonCoverage,
      comparedPairs: comparisonCount,
      eligible: completedItems.length,
      wellCompared: wellComparedCount,
    },
    libraryStatus,
    recentRatings,
    signals,
    topSignal,
    dataHealth: {
      score: healthScore,
      checklist: healthChecklist,
    },
  };
}
