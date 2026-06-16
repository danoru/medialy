export type UpcomingDatedItem = {
  title: string;
  releaseDate: Date | string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** How far back the "Just Released" view looks. */
export const RECENTLY_RELEASED_WINDOW_DAYS = 90;

/**
 * Inclusive lower bound for the "Just Released" window: items whose release
 * date falls between this and today (exclusive) count as recently released.
 */
export function recentlyReleasedSince(
  now = new Date(),
  windowDays = RECENTLY_RELEASED_WINDOW_DAYS,
) {
  // Calendar-date math (not `DAY_MS`) so the result lands on local midnight
  // even when the window spans a daylight-saving transition.
  const today = startOfToday(now);
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - windowDays,
  );
}

export function daysFromToday(date: Date | string, now = new Date()) {
  const today = startOfToday(now);
  const target = startOfToday(new Date(date));

  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

export function formatUpcomingRelativeLabel(
  date: Date | string,
  now = new Date(),
) {
  const dayDelta = daysFromToday(date, now);
  const absDays = Math.abs(dayDelta);

  if (dayDelta === 0) {
    return "Today";
  }

  if (dayDelta === 1) {
    return "Tomorrow";
  }

  if (dayDelta === -1) {
    return "Yesterday";
  }

  if (dayDelta > 0) {
    return `In ${dayDelta} days`;
  }

  return `${absDays} days ago`;
}

export function sortUpcomingItems<T extends UpcomingDatedItem>(items: T[]) {
  return [...items].sort((a, b) => {
    const dateCompare =
      new Date(a.releaseDate ?? 0).getTime() -
      new Date(b.releaseDate ?? 0).getTime();

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return a.title.localeCompare(b.title);
  });
}

