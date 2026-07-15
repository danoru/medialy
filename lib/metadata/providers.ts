import { MediaType } from "@prisma/client";
import type { CreditInput } from "@/lib/credits";

/**
 * Free-text search against the upstream metadata providers, so a user can add a
 * title by *finding* it rather than hand-typing fifteen fields.
 *
 * This is a different entry point from `scripts/backfill-metadata.ts`, which
 * matches an existing DB row against a provider to fill in its blanks. Here we
 * have no row yet — only a string the user typed — so we search, show them the
 * candidates, and build a new item from whichever one they pick.
 *
 * TMDB covers movies and TV; RAWG covers games. All calls degrade to an empty
 * result when the relevant API key is absent, so the flow still works (falling
 * back to manual entry) in an environment without provider credentials.
 */

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const RAWG_API_BASE = "https://api.rawg.io/api";

/** Cache TMDB's genre id → name maps; they change about never. */
const tmdbGenreCache = new Map<TmdbEndpoint, Map<number, string>>();

type TmdbEndpoint = "movie" | "tv";

export type ProviderSource = "tmdb" | "rawg";

/** A search hit, shown in the picker. Enough to recognise the title, no more. */
export type ProviderCandidate = {
  source: ProviderSource;
  sourceId: string;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  overview: string | null;
};

/** Everything needed to create a `MediaItem`, fetched once the user commits. */
export type ProviderDetails = {
  source: ProviderSource;
  sourceId: string;
  mediaType: MediaType;
  title: string;
  description: string | null;
  releaseDate: Date | null;
  posterUrl: string | null;
  externalUrl: string | null;
  genres: string[];
  tags: string[];
  platforms: string[];
  credits: CreditInput[];
};

/** Media types we can actually look up. Anything else goes to manual entry. */
export const SEARCHABLE_MEDIA_TYPES: MediaType[] = [
  MediaType.MOVIE,
  MediaType.TV_SHOW,
  MediaType.VIDEO_GAME,
];

export function isSearchableMediaType(value: unknown): value is MediaType {
  return SEARCHABLE_MEDIA_TYPES.includes(value as MediaType);
}

/**
 * Search one media type, or — when `mediaType` is omitted — all of them at once
 * and merge the results. The user shouldn't have to know whether the thing they
 * half-remember was a film or a series before they're allowed to search for it.
 */
export async function searchProviders(
  query: string,
  mediaType?: MediaType | null,
): Promise<ProviderCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const types = mediaType ? [mediaType] : SEARCHABLE_MEDIA_TYPES;
  const results = await Promise.all(
    types.map((type) => searchOneType(trimmed, type)),
  );

  // Interleave across types so a single prolific type can't monopolise the
  // list when the user hasn't told us what they're looking for.
  const merged = interleave(results);
  return merged.slice(0, 20);
}

async function searchOneType(
  query: string,
  mediaType: MediaType,
): Promise<ProviderCandidate[]> {
  try {
    if (mediaType === MediaType.MOVIE) return await searchTmdb(query, "movie");
    if (mediaType === MediaType.TV_SHOW) return await searchTmdb(query, "tv");
    if (mediaType === MediaType.VIDEO_GAME) return await searchRawg(query);
    return [];
  } catch {
    // A provider being down must not take the whole search with it.
    return [];
  }
}

export async function fetchProviderDetails(
  source: ProviderSource,
  sourceId: string,
  mediaType: MediaType,
): Promise<ProviderDetails | null> {
  try {
    if (source === "tmdb") {
      const endpoint: TmdbEndpoint =
        mediaType === MediaType.TV_SHOW ? "tv" : "movie";
      return await tmdbDetails(sourceId, endpoint);
    }
    if (source === "rawg") return await rawgDetails(sourceId);
    return null;
  } catch {
    return null;
  }
}

// ─── TMDB ────────────────────────────────────────────────────────────

async function searchTmdb(
  query: string,
  endpoint: TmdbEndpoint,
): Promise<ProviderCandidate[]> {
  const token = process.env.TMDB_BEARER_TOKEN;
  if (!token) return [];

  const url = new URL(`${TMDB_API_BASE}/search/${endpoint}`);
  url.searchParams.set("query", query);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");

  const json = await tmdbFetch(url);
  const results = arrayValue(recordValue(json).results);

  return results.slice(0, 10).map((raw) => {
    const record = recordValue(raw);
    const title =
      (endpoint === "movie"
        ? stringValue(record.title)
        : stringValue(record.name)) ?? "Untitled";
    const date =
      endpoint === "movie"
        ? stringValue(record.release_date)
        : stringValue(record.first_air_date);
    const posterPath = stringValue(record.poster_path);

    return {
      source: "tmdb" as const,
      sourceId: String(record.id),
      mediaType:
        endpoint === "movie" ? MediaType.MOVIE : MediaType.TV_SHOW,
      title,
      year: yearOf(date),
      posterUrl: posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null,
      overview: stringValue(record.overview),
    };
  });
}

async function tmdbDetails(
  sourceId: string,
  endpoint: TmdbEndpoint,
): Promise<ProviderDetails | null> {
  const token = process.env.TMDB_BEARER_TOKEN;
  if (!token) return null;

  const url = new URL(`${TMDB_API_BASE}/${endpoint}/${sourceId}`);
  url.searchParams.set("language", "en-US");
  url.searchParams.set("append_to_response", "credits");

  const json = await tmdbFetch(url);
  const record = recordValue(json);
  if (record.id == null) return null;

  const title =
    (endpoint === "movie"
      ? stringValue(record.title)
      : stringValue(record.name)) ?? "Untitled";
  const date =
    endpoint === "movie"
      ? stringValue(record.release_date)
      : stringValue(record.first_air_date);
  const posterPath = stringValue(record.poster_path);

  const genreMap = await tmdbGenres(endpoint);
  const genres = arrayValue(record.genres)
    .map((genre) => stringValue(recordValue(genre).name))
    .filter(isPresent);
  const genreIds = arrayValue(record.genre_ids)
    .map((id) => (typeof id === "number" ? genreMap.get(id) : null))
    .filter(isPresent);

  return {
    source: "tmdb",
    sourceId,
    mediaType: endpoint === "movie" ? MediaType.MOVIE : MediaType.TV_SHOW,
    title,
    description: stringValue(record.overview),
    releaseDate: parseDate(date),
    posterUrl: posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null,
    externalUrl: `https://www.themoviedb.org/${endpoint}/${sourceId}`,
    genres: [...new Set([...genres, ...genreIds])],
    tags: [],
    platforms: [],
    credits: tmdbCredits(record, endpoint),
  };
}

function tmdbCredits(
  record: Record<string, unknown>,
  endpoint: TmdbEndpoint,
): CreditInput[] {
  const credits = recordValue(record.credits);
  const cast = arrayValue(credits.cast)
    .slice(0, 8)
    .map((entry) => stringValue(recordValue(entry).name))
    .filter(isPresent);

  const out: CreditInput[] = [];

  // Movies credit a DIRECTOR; series credit a CREATOR (see CREDIT_ROLES_BY_
  // MEDIA_TYPE) — and TMDB exposes them through different fields.
  if (endpoint === "movie") {
    const directors = arrayValue(credits.crew)
      .filter((entry) => recordValue(entry).job === "Director")
      .map((entry) => stringValue(recordValue(entry).name))
      .filter(isPresent);
    if (directors.length > 0) {
      out.push({ role: "DIRECTOR", kind: "PERSON", names: directors });
    }
  } else {
    const creators = arrayValue(record.created_by)
      .map((entry) => stringValue(recordValue(entry).name))
      .filter(isPresent);
    if (creators.length > 0) {
      out.push({ role: "CREATOR", kind: "PERSON", names: creators });
    }
  }

  if (cast.length > 0) {
    out.push({ role: "ACTOR", kind: "PERSON", names: cast });
  }
  return out;
}

async function tmdbGenres(endpoint: TmdbEndpoint): Promise<Map<number, string>> {
  const cached = tmdbGenreCache.get(endpoint);
  if (cached) return cached;

  const url = new URL(`${TMDB_API_BASE}/genre/${endpoint}/list`);
  url.searchParams.set("language", "en-US");
  const json = await tmdbFetch(url);

  const map = new Map<number, string>();
  for (const raw of arrayValue(recordValue(json).genres)) {
    const record = recordValue(raw);
    const name = stringValue(record.name);
    if (typeof record.id === "number" && name) map.set(record.id, name);
  }
  tmdbGenreCache.set(endpoint, map);
  return map;
}

async function tmdbFetch(url: URL): Promise<unknown> {
  const token = process.env.TMDB_BEARER_TOKEN;
  if (!token) return null;
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    next: { revalidate: 3600 },
  });
  if (!response.ok) return null;
  return response.json();
}

// ─── RAWG (games) ────────────────────────────────────────────────────

async function searchRawg(query: string): Promise<ProviderCandidate[]> {
  const key = process.env.RAWG_API_KEY;
  if (!key) return [];

  const url = new URL(`${RAWG_API_BASE}/games`);
  url.searchParams.set("key", key);
  url.searchParams.set("search", query);
  url.searchParams.set("page_size", "10");

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) return [];
  const json = await response.json();

  return arrayValue(recordValue(json).results).map((raw) => {
    const game = recordValue(raw);
    return {
      source: "rawg" as const,
      sourceId: String(game.id),
      mediaType: MediaType.VIDEO_GAME,
      title: stringValue(game.name) ?? "Untitled",
      year: yearOf(stringValue(game.released)),
      posterUrl: stringValue(game.background_image),
      overview: null,
    };
  });
}

async function rawgDetails(sourceId: string): Promise<ProviderDetails | null> {
  const key = process.env.RAWG_API_KEY;
  if (!key) return null;

  const url = new URL(`${RAWG_API_BASE}/games/${sourceId}`);
  url.searchParams.set("key", key);

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) return null;
  const game = recordValue(await response.json());
  if (game.id == null) return null;

  const genres = arrayValue(game.genres)
    .map((genre) => stringValue(recordValue(genre).name))
    .filter(isPresent);
  const tags = arrayValue(game.tags)
    .slice(0, 10)
    .map((tag) => stringValue(recordValue(tag).name))
    .filter(isPresent);
  const platforms = arrayValue(game.platforms)
    .map((entry) =>
      stringValue(recordValue(recordValue(entry).platform).name),
    )
    .filter(isPresent);

  const slug = stringValue(game.slug);
  return {
    source: "rawg",
    sourceId,
    mediaType: MediaType.VIDEO_GAME,
    title: stringValue(game.name) ?? "Untitled",
    // RAWG's description is HTML; the backfill script skips it too.
    description: null,
    releaseDate: parseDate(stringValue(game.released)),
    posterUrl: stringValue(game.background_image),
    externalUrl: slug ? `https://rawg.io/games/${slug}` : null,
    genres,
    tags,
    platforms,
    credits: [],
  };
}

// ─── Parsing helpers ─────────────────────────────────────────────────

/** Round-robin the per-type result lists so each type gets a fair showing. */
function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) {
      if (index < list.length) out.push(list[index]);
    }
  }
  return out;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function yearOf(value: string | null | undefined): number | null {
  const date = parseDate(value);
  return date ? date.getUTCFullYear() : null;
}
