import type { MediaStatus, MediaType } from "@prisma/client";

/**
 * Per-media-type status labels.
 *
 * `MediaStatus` is the data shape — `UNTRACKED`/`COMPLETED`/`IN_PROGRESS`/…
 * — but the display label depends on what kind of media we're talking about.
 * "Completed" reads as "Watched" for a movie, "Played" for a game, "Read" for
 * a book. The set of statuses surfaced in dropdowns is also per-type
 * (`availableStatuses`): movies skip in-progress/paused/backlog, TV skips
 * backlog, games keep all seven.
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

const WATCHLIST_LABELS: LabelMap = {
  VIDEO_GAME: "Playlist",
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
    case "WATCHLIST":
      return WATCHLIST_LABELS[mediaType] ?? GENERIC_LABELS.WATCHLIST;
    default:
      return GENERIC_LABELS[status];
  }
}

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
 * Per-type allow-list of statuses surfaced in dropdowns. `BACKLOG` is reserved
 * for things you typically *own* but haven't started — meaningful for games,
 * not for streamed/borrowed media. `IN_PROGRESS` / `PAUSED` are dropped from
 * single-sitting types. Types not yet tuned (books, board games, music,
 * musicals) fall through to the full list.
 */
const STATUSES_BY_TYPE: Partial<Record<MediaType, MediaStatus[]>> = {
  MOVIE: ["UNTRACKED", "WATCHLIST", "COMPLETED", "DROPPED"],
  TV_SHOW: [
    "UNTRACKED",
    "WATCHLIST",
    "IN_PROGRESS",
    "COMPLETED",
    "PAUSED",
    "DROPPED",
  ],
  VIDEO_GAME: [
    "UNTRACKED",
    "WATCHLIST",
    "BACKLOG",
    "IN_PROGRESS",
    "COMPLETED",
    "PAUSED",
    "DROPPED",
  ],
};

export function availableStatuses(mediaType?: MediaType | null): MediaStatus[] {
  if (!mediaType) return ALL_STATUSES;
  return STATUSES_BY_TYPE[mediaType] ?? ALL_STATUSES;
}
