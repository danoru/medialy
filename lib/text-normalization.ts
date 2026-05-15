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
