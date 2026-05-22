import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const SERIES_DAYS = 30;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Bucket a list of timestamps into the trailing `days` days, returning one
 * entry per day in chronological order with zeros filled for empty days.
 * Exported for unit testing.
 */
export function bucketByDay(
  timestamps: Date[],
  days: number = SERIES_DAYS,
  now: Date = new Date(),
): Array<{ date: string; count: number }> {
  const buckets = new Map<string, number>();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * DAY_MS);
    buckets.set(dayKey(d), 0);
  }
  for (const ts of timestamps) {
    const key = dayKey(ts);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets, ([date, count]) => ({ date, count }));
}

export type AdminSignals = Awaited<ReturnType<typeof getAdminSignals>>;

export async function getAdminSignals() {
  const now = new Date();
  const since7d = daysAgo(7);
  const since30d = daysAgo(30);

  const [
    totalUsers,
    newUsers7d,
    newUsers30d,
    recentSignups,
    activeUserMedia7d,
    activeUserMedia30d,
    activeComparisons7d,
    activeComparisons30d,
    activeSuggestions7d,
    activeSuggestions30d,
    comparisons7d,
    comparisons30d,
    itemsTracked7d,
    itemsTracked30d,
    suggestions7d,
    tagsSubmitted7d,
    signupRows,
    comparisonRows,
    userMediaRows,
    recentUserMedia,
    recentComparisons,
    recentSuggestions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.user.count({ where: { createdAt: { gte: since30d } } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        displayName: true,
        name: true,
        email: true,
        image: true,
        avatarColor: true,
        createdAt: true,
        isAdmin: true,
      },
    }),
    prisma.userMedia.findMany({
      where: { updatedAt: { gte: since7d } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.userMedia.findMany({
      where: { updatedAt: { gte: since30d } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.pairwiseComparison.findMany({
      where: { createdAt: { gte: since7d } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.pairwiseComparison.findMany({
      where: { createdAt: { gte: since30d } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.mediaEditSuggestion.findMany({
      where: { createdAt: { gte: since7d } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.mediaEditSuggestion.findMany({
      where: { createdAt: { gte: since30d } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.pairwiseComparison.count({ where: { createdAt: { gte: since7d } } }),
    prisma.pairwiseComparison.count({
      where: { createdAt: { gte: since30d } },
    }),
    prisma.userMedia.count({ where: { createdAt: { gte: since7d } } }),
    prisma.userMedia.count({ where: { createdAt: { gte: since30d } } }),
    prisma.mediaEditSuggestion.count({
      where: { createdAt: { gte: since7d } },
    }),
    prisma.tag.count({ where: { createdAt: { gte: since7d } } }),
    prisma.user.findMany({
      where: { createdAt: { gte: since30d } },
      select: { createdAt: true },
    }),
    prisma.pairwiseComparison.findMany({
      where: { createdAt: { gte: since30d } },
      select: { createdAt: true },
    }),
    prisma.userMedia.findMany({
      where: { createdAt: { gte: since30d } },
      select: { createdAt: true },
    }),
    prisma.userMedia.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, displayName: true, avatarColor: true } },
        media: { select: { id: true, title: true, mediaType: true } },
      },
    }),
    prisma.pairwiseComparison.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, displayName: true, avatarColor: true } },
        winner: { select: { id: true, title: true } },
        loser: { select: { id: true, title: true } },
      },
    }),
    prisma.mediaEditSuggestion.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, displayName: true, avatarColor: true } },
        media: { select: { id: true, title: true } },
      },
    }),
  ]);

  const unionIds = (rows: Array<Array<{ userId: string }>>) =>
    new Set(rows.flat().map((r) => r.userId)).size;
  const activeUsers7d = unionIds([
    activeUserMedia7d,
    activeComparisons7d,
    activeSuggestions7d,
  ]);
  const activeUsers30d = unionIds([
    activeUserMedia30d,
    activeComparisons30d,
    activeSuggestions30d,
  ]);

  const signupsByDay = bucketByDay(
    signupRows.map((r) => r.createdAt),
    SERIES_DAYS,
    now,
  );
  const comparisonsByDay = bucketByDay(
    comparisonRows.map((r) => r.createdAt),
    SERIES_DAYS,
    now,
  );
  const userMediaByDay = bucketByDay(
    userMediaRows.map((r) => r.createdAt),
    SERIES_DAYS,
    now,
  );

  type FeedEvent = {
    id: string;
    createdAt: Date;
    kind: "track" | "compare" | "suggest";
    userId: string;
    userName: string;
    avatarColor: string | null;
    label: string;
  };

  const feed: FeedEvent[] = [
    ...recentUserMedia.map<FeedEvent>((row) => ({
      id: `um-${row.id}`,
      createdAt: row.createdAt,
      kind: "track",
      userId: row.user.id,
      userName: row.user.displayName,
      avatarColor: row.user.avatarColor,
      label: `tracked ${row.media.title}`,
    })),
    ...recentComparisons.map<FeedEvent>((row) => ({
      id: `cmp-${row.id}`,
      createdAt: row.createdAt,
      kind: "compare",
      userId: row.user.id,
      userName: row.user.displayName,
      avatarColor: row.user.avatarColor,
      label: `ranked ${row.winner.title} over ${row.loser.title}`,
    })),
    ...recentSuggestions.map<FeedEvent>((row) => ({
      id: `sg-${row.id}`,
      createdAt: row.createdAt,
      kind: "suggest",
      userId: row.user.id,
      userName: row.user.displayName,
      avatarColor: row.user.avatarColor,
      label: row.media
        ? `suggested an edit to ${row.media.title}`
        : `suggested a new item`,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 20);

  return {
    totalUsers,
    newUsers7d,
    newUsers30d,
    activeUsers7d,
    activeUsers30d,
    comparisons7d,
    comparisons30d,
    itemsTracked7d,
    itemsTracked30d,
    suggestions7d,
    tagsSubmitted7d,
    recentSignups,
    signupsByDay,
    comparisonsByDay,
    userMediaByDay,
    feed,
  };
}
