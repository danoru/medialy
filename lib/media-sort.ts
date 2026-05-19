const titleCollator = new Intl.Collator("en-US", {
  numeric: true,
  sensitivity: "base",
});

const titleTieBreakerCollator = new Intl.Collator("en-US", {
  numeric: true,
  sensitivity: "variant",
});

export type SortDirection = "asc" | "desc";

export function compareMediaTitles(
  firstTitle: string,
  secondTitle: string,
  direction: SortDirection = "asc",
) {
  const result =
    titleCollator.compare(firstTitle, secondTitle) ||
    titleTieBreakerCollator.compare(firstTitle, secondTitle);

  return direction === "desc" ? -result : result;
}

export function sortMediaTitleRows<T extends { id: string; title: string }>(
  rows: T[],
  direction: SortDirection = "asc",
) {
  return [...rows].sort(
    (first, second) =>
      compareMediaTitles(first.title, second.title, direction) ||
      first.id.localeCompare(second.id),
  );
}
