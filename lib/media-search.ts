import { normalizeSearchText } from "@/lib/text-normalization";

export function matchesMediaTitleSearch(title: string, search: string) {
  const { query, startsWith } = parseTitleSearch(search);
  if (!query) return true;

  const normalizedTitle = normalizeSearchText(title);
  return startsWith
    ? normalizedTitle.startsWith(query)
    : normalizedTitle.includes(query);
}

function parseTitleSearch(search: string) {
  const trimmed = search.trim();
  const startsWith = trimmed.endsWith("*");
  const rawQuery = startsWith ? trimmed.slice(0, -1) : trimmed;

  return {
    query: normalizeSearchText(rawQuery),
    startsWith,
  };
}
