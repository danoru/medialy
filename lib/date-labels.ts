/**
 * Date formatting helpers used by recommendation/queue surfaces.
 * Pure functions — safe to import from server or client code.
 *
 * Release dates are *calendar* dates: the form submits "YYYY-MM-DD", which
 * `new Date()` parses as UTC midnight, and that's what Prisma stores. Every
 * helper here reads the UTC fields so a 9/18 release never renders as 9/17
 * for viewers west of UTC.
 */

type DateLike = Date | string | null | undefined;

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The stored UTC calendar date re-expressed as local midnight, so it can be
 * compared against `new Date()`-style local dates (day-delta math, calendar
 * grids) without the timezone offset bleeding into the day.
 */
export function calendarDateToLocal(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** "2026-09-18" for the stored calendar date. */
export function calendarIsoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "2026-09" for the stored calendar date. */
export function calendarMonthKey(value: Date | string): string {
  return calendarIsoDate(value).slice(0, 7);
}

/**
 * `toLocaleDateString` pinned to UTC so the calendar date is rendered as
 * entered. Defaults to the locale's numeric short form (e.g. "9/18/2026").
 */
export function formatCalendarDate(
  value: DateLike,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
): string | null {
  const date = toDate(value);
  if (!date) return null;
  return date.toLocaleDateString(locale, { ...options, timeZone: "UTC" });
}

/** "1999" or null if the input isn't a valid date. */
export function releaseYearLabel(value: DateLike): string | null {
  const date = toDate(value);
  return date ? String(date.getUTCFullYear()) : null;
}

/** "Mar 14" or "-" if the input isn't a valid date. */
export function compactDateLabel(value: DateLike): string {
  return (
    formatCalendarDate(value, { day: "numeric", month: "short" }, "en-US") ??
    "-"
  );
}
