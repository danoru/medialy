import type { MediaStatus } from "@prisma/client";

/**
 * Rating something implies you finished it — but only when the current status
 * isn't already a deliberate statement about where you are with it.
 *
 * `UNTRACKED` / `WATCHLIST` / `BACKLOG` all mean "haven't started", so a rating
 * safely promotes them to `COMPLETED`. `IN_PROGRESS` / `PAUSED` / `DROPPED` /
 * `NOT_INTERESTED` / `COMPLETED` are choices the user made on purpose: rating a
 * show you're three episodes into must not silently mark it finished.
 */
const PROMOTABLE: readonly MediaStatus[] = [
  "UNTRACKED",
  "WATCHLIST",
  "BACKLOG",
] as const;

/**
 * Status an item should land on after the user rates it, or `null` when the
 * current status must be left alone.
 */
export function statusAfterRating(current: MediaStatus): MediaStatus | null {
  return PROMOTABLE.includes(current) ? "COMPLETED" : null;
}
