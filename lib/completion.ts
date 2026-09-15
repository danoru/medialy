import type { MediaStatus } from "@prisma/client";

/**
 * When did you finish something?
 *
 * `UserMedia.completedAt` is a calendar date stored as UTC midnight (same
 * convention as release dates — see `lib/date-labels.ts`). It is set to today
 * the moment a title becomes COMPLETED, because that is right far more often
 * than not, and can then be corrected on the detail page. "Not sure" is a
 * deliberate answer of its own (`completedAtUnsure`): the date is cleared and
 * the flag stops the UI from treating the row as one that still needs a date.
 * A row with neither is simply undated — it predates the field, or was
 * completed through a path that never asked.
 */

export type CompletionFields = {
  completedAt: Date | null;
  completedAtUnsure: boolean;
};

/** Today as the UTC-midnight calendar date the rest of the app stores. */
export function todayCalendarDate(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
}

/**
 * The completion fields to write alongside a status change. Entering
 * COMPLETED stamps today unless the row already has a date or an explicit
 * "not sure"; leaving COMPLETED clears both, so un-watching is a clean reset
 * rather than a title that is "not watched, finished on the 3rd".
 */
export function completionPatchForStatus(
  previousStatus: MediaStatus,
  nextStatus: MediaStatus,
  existing: CompletionFields,
  now = new Date(),
): Partial<CompletionFields> {
  const wasCompleted = previousStatus === "COMPLETED";
  const isCompleted = nextStatus === "COMPLETED";
  if (isCompleted && !wasCompleted) {
    if (existing.completedAt || existing.completedAtUnsure) return {};
    return { completedAt: todayCalendarDate(now), completedAtUnsure: false };
  }
  if (wasCompleted && !isCompleted) {
    if (!existing.completedAt && !existing.completedAtUnsure) return {};
    return { completedAt: null, completedAtUnsure: false };
  }
  return {};
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse a form's "YYYY-MM-DD" into the stored UTC-midnight date. Returns
 * `undefined` for anything malformed or in the future, `null` for blank.
 */
export function parseCompletedAtInput(
  value: unknown,
  now = new Date(),
): Date | null | undefined {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const match = ISO_DATE.exec(text);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return undefined;
  // Reject impossible dates that Date.UTC would otherwise roll over (Feb 30).
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return undefined;
  }
  if (date.getTime() > todayCalendarDate(now).getTime()) return undefined;
  return date;
}

/**
 * Resolve what the "Completed on" control submitted. "Not sure" wins over a
 * date; an explicit date clears "not sure"; blank with no flag means "undated".
 */
export function completionFromForm(
  input: { completedAt: unknown; unsure: boolean },
  now = new Date(),
): CompletionFields | { error: string } {
  if (input.unsure) return { completedAt: null, completedAtUnsure: true };
  const parsed = parseCompletedAtInput(input.completedAt, now);
  if (parsed === undefined) {
    return { error: "Enter a date on or before today, or choose Not sure." };
  }
  return { completedAt: parsed, completedAtUnsure: false };
}
