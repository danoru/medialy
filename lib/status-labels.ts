import type { MediaStatus, MediaType } from "@prisma/client";

/**
 * Per-media-type status labels.
 *
 * `MediaStatus` is the data shape — `UNTRACKED`/`COMPLETED`/`IN_PROGRESS`/…
 * — but the display label depends on what kind of media we're talking about.
 * "Completed" reads as "Watched" for a movie, "Played" for a game, "Read" for
 * a book. Likewise `IN_PROGRESS` and `PAUSED` don't really apply to a movie
 * (a single sitting), so we don't surface them in dropdowns for `MOVIE` /
 * `MUSICAL`.
 *
 * Keep this module React/Next-free: it's pure label logic and is imported by
 * both server and client components.
 */

type LabelMap = Partial<Record<MediaType, string>>;

const COMPLETED_LABELS: LabelMap = {
  MOVIE: "Watched",
  TV_SHOW: "Watched",
  MUSICAL: "Watched",
  VIDEO_GAME: "Played",
  BOARD_GAME: "Played",
  BOOK: "Read",
  MUSIC: "Listened",
};

const IN_PROGRESS_LABELS: LabelMap = {
  TV_SHOW: "Watching",
  VIDEO_GAME: "Playing",
  BOARD_GAME: "Playing",
  BOOK: "Reading",
  MUSIC: "Listening",
};

const BACKLOG_LABELS: LabelMap = {
  MOVIE: "To watch",
  TV_SHOW: "To watch",
  MUSICAL: "To watch",
  VIDEO_GAME: "To play",
  BOARD_GAME: "To play",
  BOOK: "To read",
  MUSIC: "To listen",
};

// Universal fallbacks used when mediaType is unknown / not provided, and as
// the label for statuses that don't vary by type.
const GENERIC_LABELS: Record<MediaStatus, string> = {
  UNTRACKED: "Untracked",
  WATCHLIST: "Watchlist",
  BACKLOG: "Backlog",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DROPPED: "Dropped",
  PAUSED: "Paused",
};

/**
 * Display label for a media status. If `mediaType` is omitted, returns the
 * universal label (useful for headings / aggregated views that span types).
 */
export function statusLabel(
  status: MediaStatus,
  mediaType?: MediaType | null,
): string {
  if (!mediaType) return GENERIC_LABELS[status];
  switch (status) {
    case "COMPLETED":
      return COMPLETED_LABELS[mediaType] ?? GENERIC_LABELS.COMPLETED;
    case "IN_PROGRESS":
      return IN_PROGRESS_LABELS[mediaType] ?? GENERIC_LABELS.IN_PROGRESS;
    case "BACKLOG":
      return BACKLOG_LABELS[mediaType] ?? GENERIC_LABELS.BACKLOG;
    default:
      return GENERIC_LABELS[status];
  }
}

// Single-sitting media types: `IN_PROGRESS` and `PAUSED` don't make sense in
// the UI even though the enum still permits them in the database.
const SINGLE_SITTING_TYPES = new Set<MediaType>(["MOVIE", "MUSICAL"]);

const ALL_STATUSES: MediaStatus[] = [
  "UNTRACKED",
  "WATCHLIST",
  "BACKLOG",
  "IN_PROGRESS",
  "COMPLETED",
  "PAUSED",
  "DROPPED",
];

/**
 * Statuses to expose in a dropdown / filter for a given media type. Drops
 * `IN_PROGRESS` and `PAUSED` for media you consume in one go.
 */
export function availableStatuses(mediaType?: MediaType | null): MediaStatus[] {
  if (!mediaType) return ALL_STATUSES;
  if (SINGLE_SITTING_TYPES.has(mediaType)) {
    return ALL_STATUSES.filter(
      (s) => s !== "IN_PROGRESS" && s !== "PAUSED",
    );
  }
  return ALL_STATUSES;
}
