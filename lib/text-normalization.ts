const combiningMarksPattern = /[\u0300-\u036f]/g;

const foldedCharacterMap = new Map<string, string>([
  ["ß", "ss"],
  ["æ", "ae"],
  ["Æ", "AE"],
  ["œ", "oe"],
  ["Œ", "OE"],
  ["ø", "o"],
  ["Ø", "O"],
  ["đ", "d"],
  ["Đ", "D"],
  ["ł", "l"],
  ["Ł", "L"],
]);

export function foldDiacritics(value: string) {
  return [...value]
    .map((character) => foldedCharacterMap.get(character) ?? character)
    .join("")
    .normalize("NFKD")
    .replace(combiningMarksPattern, "");
}

export function normalizeSearchText(value: string) {
  return foldDiacritics(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeComparableTitle(value: string) {
  return normalizeSearchText(value)
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const TITLE_YEAR_SUFFIX = /\s*[(\[]\s*(\d{4})\s*[)\]]\s*$/;

export function stripTitleYearSuffix(value: string): {
  title: string;
  year: number | null;
} {
  const match = value.match(TITLE_YEAR_SUFFIX);
  return {
    title: value.replace(TITLE_YEAR_SUFFIX, "").trim(),
    year: match ? Number.parseInt(match[1] ?? "", 10) : null,
  };
}

// Strip a trailing `: ...` subtitle if there's substantive text before it.
// We only split on a colon followed by a space — em-dash / single-hyphen
// subtitles are too easy to confuse with punctuation inside a title.
export function stripTitleSubtitle(value: string): string {
  const idx = value.indexOf(": ");
  if (idx < 3) return value;
  const head = value.slice(0, idx).trim();
  return head.length >= 3 ? head : value;
}

function titleWordTokenCount(value: string) {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(" ").length : 0;
}

// Subtitle-tolerant title equality, used for "soft" dedup matches at import
// and external-source lookup time. Guards: at least one side must drop its
// subtitle (so we don't loosen exact matches), and the shorter normalized
// title must have ≥2 word tokens (blocks generic 1-word titles like
// "Mission" silently merging into "Mission: Impossible").
export function titleEqualsSubtitleAware(a: string, b: string): boolean {
  const aFull = normalizeSearchText(stripTitleYearSuffix(a).title);
  const bFull = normalizeSearchText(stripTitleYearSuffix(b).title);
  if (!aFull || !bFull) return false;
  if (aFull === bFull) return true;

  const aStripped = normalizeSearchText(
    stripTitleSubtitle(stripTitleYearSuffix(a).title),
  );
  const bStripped = normalizeSearchText(
    stripTitleSubtitle(stripTitleYearSuffix(b).title),
  );
  if (!aStripped || !bStripped) return false;
  const aChanged = aStripped !== aFull;
  const bChanged = bStripped !== bFull;
  if (!aChanged && !bChanged) return false;

  const candidates: Array<[string, string]> = [];
  if (aChanged) candidates.push([aStripped, bFull]);
  if (bChanged) candidates.push([aFull, bStripped]);
  if (aChanged && bChanged) candidates.push([aStripped, bStripped]);

  for (const [left, right] of candidates) {
    if (left !== right) continue;
    const shorterTokens = Math.min(
      titleWordTokenCount(left),
      titleWordTokenCount(right),
    );
    if (shorterTokens >= 2) return true;
  }
  return false;
}
