export type UpcomingDatedItem = {
  title: string;
  upcomingDate: Date | string | null;
};

export type UpcomingGroups<T extends UpcomingDatedItem> = {
  next30Days: T[];
  later: T[];
  needsReview: T[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
      new Date(a.upcomingDate ?? 0).getTime() -
      new Date(b.upcomingDate ?? 0).getTime();

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return a.title.localeCompare(b.title);
  });
}

export function groupUpcomingItems<T extends UpcomingDatedItem>(
  items: T[],
  now = new Date(),
): UpcomingGroups<T> {
  const groups: UpcomingGroups<T> = {
    next30Days: [],
    later: [],
    needsReview: [],
  };

  for (const item of items) {
    if (!item.upcomingDate) {
      continue;
    }

    const dayDelta = daysFromToday(item.upcomingDate, now);

    if (dayDelta < 0) {
      groups.needsReview.push(item);
    } else if (dayDelta <= 30) {
      groups.next30Days.push(item);
    } else {
      groups.later.push(item);
    }
  }

  return {
    next30Days: sortUpcomingItems(groups.next30Days),
    later: sortUpcomingItems(groups.later),
    needsReview: sortUpcomingItems(groups.needsReview),
  };
}
