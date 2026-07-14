/**
 * Lets automated metadata backfills propose changes instead of performing them.
 *
 * The backfill scripts only ever write into *blank* fields. When a source has
 * data for a field the item already fills, that conflict is filed here as a
 * PENDING `MediaEditSuggestion` and surfaced in /admin/edits, so curated data is
 * never silently rewritten.
 *
 * IMPORTANT: `approveMediaEditSuggestion` replays `afterJson` through
 * `upsertMediaRelations` (delete-then-recreate) and `replaceManualExternalRatings`
 * (deletes manual sources absent from the payload). A suggestion payload must
 * therefore be a *complete* snapshot of the item's desired end state, not a
 * delta — otherwise approving it would wipe whatever the delta omitted. We build
 * every payload by merging the proposal onto the item's current snapshot.
 */
import { prisma } from "@/lib/prisma";
import {
  diffSnapshots,
  snapshotMediaItem,
  type EditSuggestionSnapshot,
} from "@/lib/edit-suggestions";

const SYSTEM_USER_EMAIL = "metadata-backfill@medialy.local";
const SYSTEM_USER_NAME = "MedialyBot";

/** Fields a backfill is allowed to propose. Everything else is left alone. */
export type BackfillProposal = Partial<
  Pick<
    EditSuggestionSnapshot,
    | "description"
    | "releaseDate"
    | "externalUrl"
    | "metadataJson"
    | "genres"
    | "tags"
  >
>;

/**
 * The bot account that authors backfill suggestions. `MediaEditSuggestion.userId`
 * is required and FK'd to `User`, and a CLI script has no signed-in user, so we
 * keep one non-admin system account. It has no Account/Session rows, so it can
 * never be logged into. `isSystemAccount` keeps it out of user-facing lists like
 * "Discover users".
 */
export async function getBackfillSuggestionUser() {
  return prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {
      displayName: SYSTEM_USER_NAME,
      name: SYSTEM_USER_NAME,
      isSystemAccount: true,
    },
    create: {
      email: SYSTEM_USER_EMAIL,
      displayName: SYSTEM_USER_NAME,
      name: SYSTEM_USER_NAME,
      isAdmin: false,
      isSystemAccount: true,
    },
    select: { id: true },
  });
}

export type FileSuggestionResult =
  | { status: "filed"; suggestionId: string; fields: string[] }
  | { status: "duplicate"; suggestionId: string }
  | { status: "no_change" };

/**
 * File a PENDING suggestion proposing `proposal` for `mediaId`.
 *
 * Returns `no_change` when the proposal matches the item as it already stands,
 * and `duplicate` when an identical PENDING suggestion is already queued — so
 * re-running a backfill does not pile up redundant review work.
 */
export async function fileBackfillSuggestion({
  mediaId,
  userId,
  proposal,
  note,
}: {
  mediaId: string;
  userId: string;
  proposal: BackfillProposal;
  note: string;
}): Promise<FileSuggestionResult> {
  const before = await snapshotMediaItem(mediaId);
  if (!before) return { status: "no_change" };

  // Merge onto the current snapshot so approving can only ever add the proposed
  // fields — every untouched field replays as-is.
  const after: EditSuggestionSnapshot = { ...before, ...proposal };

  const changed = diffSnapshots(before, after);
  if (changed.length === 0) return { status: "no_change" };

  const afterJson = JSON.stringify(after);

  const existing = await prisma.mediaEditSuggestion.findFirst({
    where: { mediaId, userId, status: "PENDING", afterJson },
    select: { id: true },
  });
  if (existing) return { status: "duplicate", suggestionId: existing.id };

  const suggestion = await prisma.mediaEditSuggestion.create({
    data: {
      mediaId,
      userId,
      beforeJson: JSON.stringify(before),
      afterJson,
      status: "PENDING",
      note,
    },
    select: { id: true },
  });

  return {
    status: "filed",
    suggestionId: suggestion.id,
    fields: changed.map((field) => field.field),
  };
}
