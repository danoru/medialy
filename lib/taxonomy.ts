import type { MediaType } from "@prisma/client";

export const SCREEN_MEDIA_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Horror",
  "Musical",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
] as const;

export type ScreenMediaGenre = (typeof SCREEN_MEDIA_GENRES)[number];

export const GAME_GENRES = [
  "Action",
  "Adventure",
  "Casual",
  "Fighting",
  "Horror",
  "Platformer",
  "Puzzle",
  "Racing",
  "Rhythm",
  "RPG",
  "Shooter",
  "Simulation",
  "Sports",
  "Strategy",
  "Survival",
  "Visual Novel",
] as const;

export type GameGenre = (typeof GAME_GENRES)[number];

export const MAX_GENRES_PER_ITEM = 3;

export const TAG_CATEGORIES = [
  "SUBGENRE",
  "COUNTRY",
  "THEME",
  "MECHANIC",
  "MOOD",
  "FORMAT",
] as const;

export type TagCategory = (typeof TAG_CATEGORIES)[number];

export type CanonicalTagMetadata = {
  category: TagCategory;
  discoverable: boolean;
  mediaTypes?: MediaType[];
  countryCode?: string;
};

type DiscoverSubgenreMap = Partial<
  Record<MediaType, Record<string, readonly string[]>>
>;

export const DISCOVER_SUBGENRES: DiscoverSubgenreMap = {
  MOVIE: {
    Animation: ["Anime"],
    Horror: ["Body Horror", "Folk Horror", "Psychological Horror"],
    "Science Fiction": ["Cyberpunk", "Space Opera"],
    Thriller: ["Psychological Thriller"],
  },
  TV_SHOW: {
    Animation: ["Anime"],
    Drama: ["Prestige TV"],
    "Science Fiction": ["Space Opera"],
  },
  VIDEO_GAME: {
    Action: ["Character Action", "Stealth"],
    Adventure: ["Metroidvania", "Open World", "Psychological Horror"],
    Casual: ["Arcade Rhythm", "Kart Racer", "Party Game"],
    Horror: ["Psychological Horror", "Survival Horror"],
    Platformer: ["Metroidvania"],
    Racing: ["Kart Racer"],
    Rhythm: ["Arcade Rhythm"],
    RPG: ["Action RPG", "JRPG", "Roguelike", "Soulslike", "Turn-Based RPG"],
    Shooter: ["Tactical Shooter"],
    Strategy: ["4X", "Real-Time Strategy", "Tactics"],
    Survival: ["Survival Crafting", "Survival Horror"],
  },
};

const screenMediaTypes = new Set<MediaType>(["MOVIE", "TV_SHOW"]);
const gameMediaTypes = new Set<MediaType>(["VIDEO_GAME"]);
const canonicalGenreByKey = new Map<string, string>(
  [...SCREEN_MEDIA_GENRES, ...GAME_GENRES].map((genre) => [
    normalizeTaxonomyKey(genre),
    genre,
  ]),
);

const genreAliases = new Map<string, string>([
  ["sci fi", "Science Fiction"],
  ["sci-fi", "Science Fiction"],
  ["science-fiction", "Science Fiction"],
  ["science fiction action", "Science Fiction"],
  ["scifi", "Science Fiction"],
  ["romcom", "Romance"],
  ["rom com", "Romance"],
  ["animated", "Animation"],
  ["kids", "Family"],
  ["children", "Family"],
  ["childrens", "Family"],
  ["role playing", "RPG"],
  ["role-playing", "RPG"],
  ["party", "Casual"],
  ["party game", "Casual"],
]);

const tagAliases = new Map<string, string>([
  ["body-horror", "Body Horror"],
  ["cyber punk", "Cyberpunk"],
  ["cyber-punk", "Cyberpunk"],
  ["japanese", "Japan"],
  ["japan", "Japan"],
  ["jp", "Japan"],
  ["korean", "South Korea"],
  ["south korean", "South Korea"],
  ["turn based rpg", "Turn-Based RPG"],
  ["turn-based-rpg", "Turn-Based RPG"],
  ["sci fi", "Sci-Fi"],
  ["scifi", "Sci-Fi"],
  ["science fiction", "Science Fiction"],
  ["found-family", "Found Family"],
  ["souls like", "Soulslike"],
  ["soul like", "Soulslike"],
  ["rogue like", "Roguelike"],
]);

const canonicalDiscoverSubgenreKeys = new Set(
  Object.values(DISCOVER_SUBGENRES).flatMap((genreMap) =>
    Object.values(genreMap).flatMap((tags) =>
      tags.map((tag) => normalizeTaxonomyKey(tag)),
    ),
  ),
);

const countryTagsByKey = new Map<
  string,
  { name: string; countryCode: string }
>([
  ["france", { name: "France", countryCode: "FR" }],
  ["japan", { name: "Japan", countryCode: "JP" }],
  ["southkorea", { name: "South Korea", countryCode: "KR" }],
  ["unitedkingdom", { name: "United Kingdom", countryCode: "GB" }],
  ["unitedstates", { name: "United States", countryCode: "US" }],
]);

const titleCaseExceptions = new Set([
  "4X",
  "JRPG",
  "RPG",
  "Sci-Fi",
  "Turn-Based RPG",
]);

export function getGenresForMediaType(mediaType: MediaType) {
  if (screenMediaTypes.has(mediaType))
    return [...SCREEN_MEDIA_GENRES] as string[];
  if (gameMediaTypes.has(mediaType)) return [...GAME_GENRES] as string[];
  return [];
}

export function normalizeGenreName(value: string, mediaType: MediaType) {
  const normalized = normalizeName(value);
  if (!normalized) return null;

  const aliased = genreAliases.get(normalized.toLowerCase()) ?? normalized;
  const canonical = canonicalGenreByKey.get(normalizeTaxonomyKey(aliased));
  if (!canonical) return null;

  return getGenresForMediaType(mediaType).includes(canonical)
    ? canonical
    : null;
}

export function normalizeExternalGenres(
  mediaType: MediaType,
  externalGenres: string[],
) {
  return splitGenresAndTags(mediaType, externalGenres);
}

export function splitGenresAndTags(
  mediaType: MediaType,
  incomingValues: string[],
) {
  const genres: string[] = [];
  const tags: string[] = [];

  for (const value of incomingValues) {
    const genre = normalizeGenreName(value, mediaType);
    if (genre) {
      if (!genres.includes(genre) && genres.length < MAX_GENRES_PER_ITEM) {
        genres.push(genre);
      }
    } else {
      const tag = normalizeTagName(value);
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
  }

  return { genres, tags };
}

export function normalizeGenresForMediaType(
  mediaType: MediaType,
  values: string[],
) {
  const genres = values
    .map((value) => normalizeGenreName(value, mediaType))
    .filter((value): value is string => Boolean(value));

  return [...new Set(genres)].slice(0, MAX_GENRES_PER_ITEM);
}

export function normalizeTagName(value: string) {
  const raw = normalizeName(value.replace(/[_/]+/g, " ").replace(/-+/g, " "));
  if (!raw) return "";

  const aliased = tagAliases.get(raw.toLowerCase()) ?? raw;
  if (titleCaseExceptions.has(aliased)) return aliased;
  if (isAllCapsTag(aliased)) return aliased;
  if (aliased.toLowerCase() === "sci fi") return "Sci-Fi";

  return aliased
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      if (["rpg", "vr"].includes(lower)) return lower.toUpperCase();
      if (lower === "sci-fi") return "Sci-Fi";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function normalizeTagKey(value: string) {
  return normalizeTaxonomyKey(normalizeTagName(value));
}

export function canonicalTagMetadataForName(
  value: string,
): CanonicalTagMetadata | null {
  const name = normalizeTagName(value);
  const key = normalizeTagKey(name);
  const country = countryTagsByKey.get(key);

  if (country) {
    return {
      category: "COUNTRY",
      discoverable: true,
      countryCode: country.countryCode,
    };
  }

  if (canonicalDiscoverSubgenreKeys.has(key)) {
    return {
      category: "SUBGENRE",
      discoverable: true,
      mediaTypes: mediaTypesForDiscoverSubgenre(name),
    };
  }

  return null;
}

export function getDiscoverSubgenresForGenre(
  mediaType: MediaType,
  genre: string,
) {
  return [...(DISCOVER_SUBGENRES[mediaType]?.[genre] ?? [])];
}

export function isDiscoverSubgenreForGenre(
  mediaType: MediaType,
  genre: string,
  tagName: string,
) {
  const key = normalizeTagKey(tagName);
  return getDiscoverSubgenresForGenre(mediaType, genre).some(
    (name) => normalizeTagKey(name) === key,
  );
}

function mediaTypesForDiscoverSubgenre(tagName: string) {
  const key = normalizeTagKey(tagName);
  const mediaTypes = Object.entries(DISCOVER_SUBGENRES)
    .filter(([, genreMap]) =>
      Object.values(genreMap).some((tags) =>
        tags.some((name) => normalizeTagKey(name) === key),
      ),
    )
    .map(([mediaType]) => mediaType as MediaType);

  return [...new Set(mediaTypes)];
}

function normalizeTaxonomyKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function isAllCapsTag(value: string) {
  return /^[A-Z0-9]+$/.test(value);
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
