import type { ComparisonContext, MediaStatus, MediaType } from "@prisma/client";
import { statusLabel } from "@/lib/status-labels";

/**
 * Pure helpers behind the Profile page. Everything here is data shaping over
 * rows `lib/db/profile.ts` already fetched — no Prisma, so it can be unit
 * tested and imported from client components.
 */

/** A completed title needs this many comparisons before it counts as ranked. */
export const RANKED_COMPARISON_TARGET = 3;

/** The lenses a user can compare through, in display order. */
export const TASTE_LENSES: Array<{ context: ComparisonContext; label: string }> =
  [
    { context: "STORY", label: "Story" },
    { context: "VISUALS", label: "Visuals" },
    { context: "MUSIC", label: "Music" },
    { context: "GAMEPLAY", label: "Gameplay" },
    { context: "REWATCHABILITY", label: "Rewatch" },
    { context: "COMFORT", label: "Comfort" },
    { context: "SOCIAL", label: "Social" },
  ];

export type ProfileTile = {
  id: string;
  title: string;
  mediaType: MediaType;
  posterUrl: string | null;
  releaseDate: Date | string | null;
};

export type ProfileActivity =
  | {
      kind: "rated";
      id: string;
      occurredAt: Date | string;
      media: ProfileTile;
      rating: number;
      /** Type-aware status label ("Watched", "Playing") or null when untracked. */
      statusLabel: string | null;
    }
  | {
      kind: "completed";
      id: string;
      occurredAt: Date | string;
      media: ProfileTile;
      statusLabel: string;
    }
  | {
      kind: "compared";
      id: string;
      occurredAt: Date | string;
      winner: ProfileTile;
      loser: ProfileTile;
      /** Lens label ("Story") or null for an overall comparison. */
      lens: string | null;
    };

export function relativeLabel(date: Date | string, now = new Date()): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const minutes = Math.round((now.getTime() - then.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function monthYearLabel(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export type RatingHistogram = {
  /** Ten buckets, index 0 = ratings that round to 1, index 9 = ratings that round to 10. */
  buckets: number[];
  count: number;
  /** Mean rating to one decimal, or null with no ratings. */
  average: number | null;
  /**
   * Mean of (your rating − Medialy consensus) over titles that have both, to
   * one decimal. Positive means you rate above the consensus.
   */
  consensusDelta: number | null;
};

/**
 * Bucket 0–10 ratings into ten bars. A rating of 8.5 rounds up to the 9 bar,
 * and anything at or below 1 lands in the first one.
 */
export function buildRatingHistogram(
  rows: Array<{ rating: number | null; consensus: number | null }>,
): RatingHistogram {
  const buckets = new Array<number>(10).fill(0);
  let sum = 0;
  let count = 0;
  let deltaSum = 0;
  let deltaCount = 0;
  for (const row of rows) {
    if (row.rating == null) continue;
    const bucket = Math.min(10, Math.max(1, Math.round(row.rating)));
    buckets[bucket - 1] += 1;
    sum += row.rating;
    count += 1;
    if (row.consensus != null) {
      deltaSum += row.rating - row.consensus;
      deltaCount += 1;
    }
  }
  return {
    buckets,
    count,
    average: count ? Math.round((sum / count) * 10) / 10 : null,
    consensusDelta: deltaCount
      ? Math.round((deltaSum / deltaCount) * 10) / 10
      : null,
  };
}

export type LensShare = { label: string; count: number; share: number };

/**
 * Turn comparison-context counts into lens shares, strongest first. Lenses
 * nobody has compared through are dropped; `OVERALL` (no lens) is ignored.
 */
export function lensShares(
  counts: Array<{ context: ComparisonContext | null; count: number }>,
): LensShare[] {
  const byContext = new Map<ComparisonContext, number>();
  for (const entry of counts) {
    if (!entry.context) continue;
    byContext.set(entry.context, (byContext.get(entry.context) ?? 0) + entry.count);
  }
  const total = TASTE_LENSES.reduce(
    (sum, lens) => sum + (byContext.get(lens.context) ?? 0),
    0,
  );
  return TASTE_LENSES.map((lens) => {
    const count = byContext.get(lens.context) ?? 0;
    return { label: lens.label, count, share: pct(count, total) };
  })
    .filter((lens) => lens.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function lensLabel(context: ComparisonContext | null): string | null {
  if (!context) return null;
  return TASTE_LENSES.find((lens) => lens.context === context)?.label ?? null;
}

type LibraryRow = {
  status: MediaStatus;
  personalRating: number | null;
  updatedAt: Date | string;
  /** When you finished it, if known. Undated completions stay out of the diary. */
  completedAt?: Date | string | null;
  media: ProfileTile;
};

type ComparisonRow = {
  id: string;
  createdAt: Date | string;
  context: ComparisonContext | null;
  winner: ProfileTile;
  loser: ProfileTile;
};

function toTime(value: Date | string): number {
  return typeof value === "string" ? new Date(value).getTime() : value.getTime();
}

/**
 * Interleave your ratings, completions and comparisons into one diary,
 * newest first. Ratings are dated by the row's last change (no rating
 * timestamp is stored). A completion is dated by `completedAt` when you gave
 * one; an undated completion falls back to the row's last change only when
 * there is no rating to stand in for it, so a title you rated and finished
 * without a date shows once, as the rating, with its status alongside.
 */
export function mergeActivity(
  library: LibraryRow[],
  comparisons: ComparisonRow[],
  limit = 5,
): ProfileActivity[] {
  const events: ProfileActivity[] = [];
  for (const row of library) {
    const completed = row.status === "COMPLETED";
    if (row.personalRating != null) {
      events.push({
        kind: "rated",
        id: `rated:${row.media.id}`,
        occurredAt: row.updatedAt,
        media: row.media,
        rating: row.personalRating,
        statusLabel:
          row.status === "UNTRACKED"
            ? null
            : statusLabel(row.status, row.media.mediaType),
      });
    }
    if (completed && (row.completedAt || row.personalRating == null)) {
      events.push({
        kind: "completed",
        id: `completed:${row.media.id}`,
        occurredAt: row.completedAt ?? row.updatedAt,
        media: row.media,
        statusLabel: statusLabel(row.status, row.media.mediaType),
      });
    }
  }
  for (const row of comparisons) {
    events.push({
      kind: "compared",
      id: `compared:${row.id}`,
      occurredAt: row.createdAt,
      winner: row.winner,
      loser: row.loser,
      lens: lensLabel(row.context),
    });
  }
  return events
    .sort((a, b) => toTime(b.occurredAt) - toTime(a.occurredAt))
    .slice(0, limit);
}

/**
 * Count genre names across a library and return the most common, ties broken
 * alphabetically so the list is stable between renders.
 */
export function topGenres(
  rows: Array<{ genres: string[] }>,
  limit = 3,
): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const genre of row.genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}
