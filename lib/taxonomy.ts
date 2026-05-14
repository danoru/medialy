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
  "Fighting",
  "Horror",
  "MMO",
  "Party",
  "Platformer",
  "Puzzle",
  "Racing",
  "RPG",
  "Sandbox",
  "Shooter",
  "Simulation",
  "Sports",
  "Stealth",
  "Strategy",
  "Survival",
  "Visual Novel",
] as const;

export type GameGenre = (typeof GAME_GENRES)[number];

export const MAX_GENRES_PER_ITEM = 3;

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
  ["mmo rpg", "MMO"],
  ["mmorpg", "MMO"],
]);

const tagAliases = new Map<string, string>([
  ["cyber punk", "Cyberpunk"],
  ["cyber-punk", "Cyberpunk"],
  ["sci fi", "Sci-Fi"],
  ["scifi", "Sci-Fi"],
  ["science fiction", "Science Fiction"],
  ["found-family", "Found Family"],
  ["souls like", "Soulslike"],
  ["soul like", "Soulslike"],
  ["rogue like", "Roguelike"],
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
  if (isAllCapsTag(aliased)) return aliased;
  if (aliased.toLowerCase() === "sci fi") return "Sci-Fi";

  return aliased
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      if (["rpg", "mmo", "vr"].includes(lower)) return lower.toUpperCase();
      if (lower === "sci-fi") return "Sci-Fi";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function normalizeTagKey(value: string) {
  return normalizeTaxonomyKey(normalizeTagName(value));
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
