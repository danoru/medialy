/**
 * Date formatting helpers used by recommendation/queue surfaces.
 * Pure functions — safe to import from server or client code.
 */

type DateLike = Date | string | null | undefined;

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "1999" or null if the input isn't a valid date. */
export function releaseYearLabel(value: DateLike): string | null {
  const date = toDate(value);
  return date ? String(date.getFullYear()) : null;
}

/** "Mar 14" or "-" if the input isn't a valid date. */
export function compactDateLabel(value: DateLike): string {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}
