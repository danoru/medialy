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
 * TMDB covers movies and TV. Games go to IGDB first and fall back to RAWG,
 * mirroring the preference the backfill and upcoming scripts already use: IGDB
 * has real cover art and a plain-text summary, where RAWG's image is a
 * screenshot and its description is HTML we can't store.
 *
 * ## Missing credentials are reported, not swallowed
 *
 * Every provider needs an API key, and a provider we can't reach returns
 * *nothing* — which used to be indistinguishable from "that title doesn't
 * exist". A game search with no RAWG key configured rendered as "Nothing found
 * for 'Hollow Knight' — check the spelling", sending you off to debug a data
 * problem that was really a deployment problem.
 *
 * So the two cases are now distinct, all the way up to the UI:
 *   - `ok` with `[]` → we asked; there are genuinely no matches.
 *   - `!ok`          → we couldn't ask. Surfaced as a warning, not an empty state.
 */

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const RAWG_API_BASE = "https://api.rawg.io/api";
const IGDB_API_BASE = "https://api.igdb.com/v4";
const IGDB_IMAGE_BASE = "https://images.igdb.com/igdb/image/upload/t_cover_big";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

/** Cache TMDB's genre id → name maps; they change about never. */
const tmdbGenreCache = new Map<TmdbEndpoint, Map<number, string>>();

type TmdbEndpoint = "movie" | "tv";

export type ProviderSource = "tmdb" | "rawg" | "igdb";

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

/** Why a media type couldn't be searched. Both are operator problems. */
export type ProviderIssueReason = "not_configured" | "request_failed";

export type ProviderIssue = {
  mediaType: MediaType;
  reason: ProviderIssueReason;
};

export type ProviderSearchOutcome = {
  candidates: ProviderCandidate[];
  /**
   * Media types we couldn't search at all. Empty in the healthy case; a
   * populated entry means a key is missing or an upstream call failed, and the
   * user is looking at fewer results than they should be.
   */
  issues: ProviderIssue[];
};

/**
 * One provider's answer. `ok: false` means we never got to ask — don't treat it
 * as "no results", and do fall through to a backup provider if there is one.
 */
type ProviderAttempt =
  | { ok: true; candidates: ProviderCandidate[] }
  | { ok: false; reason: ProviderIssueReason };

/** Media types we can actually look up. Anything else goes to manual entry. */
export const SEARCHABLE_MEDIA_TYPES: MediaType[] = [
  MediaType.MOVIE,
  MediaType.TV_SHOW,
  MediaType.VIDEO_GAME,
];

export function isSearchableMediaType(value: unknown): value is MediaType {
  return SEARCHABLE_MEDIA_TYPES.includes(value as MediaType);
}

export function isProviderSource(value: unknown): value is ProviderSource {
  return value === "tmdb" || value === "rawg" || value === "igdb";
}

/**
 * Search one media type, or — when `mediaType` is omitted — all of them at once
 * and merge the results. The user shouldn't have to know whether the thing they
 * half-remember was a film or a series before they're allowed to search for it.
 */
export async function searchProviders(
  query: string,
  mediaType?: MediaType | null,
): Promise<ProviderSearchOutcome> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { candidates: [], issues: [] };

  const types = mediaType ? [mediaType] : SEARCHABLE_MEDIA_TYPES;
  const attempts = await Promise.all(
    types.map(async (type) => ({
      type,
      attempt: await searchOneType(trimmed, type),
    })),
  );

  const issues: ProviderIssue[] = [];
  const lists: ProviderCandidate[][] = [];
  for (const { type, attempt } of attempts) {
    if (attempt.ok) lists.push(attempt.candidates);
    else issues.push({ mediaType: type, reason: attempt.reason });
  }

  // Interleave across types so a single prolific type can't monopolise the
  // list when the user hasn't told us what they're looking for.
  return { candidates: interleave(lists).slice(0, 20), issues };
}

async function searchOneType(
  query: string,
  mediaType: MediaType,
): Promise<ProviderAttempt> {
  try {
    if (mediaType === MediaType.MOVIE) return await searchTmdb(query, "movie");
    if (mediaType === MediaType.TV_SHOW) return await searchTmdb(query, "tv");
    if (mediaType === MediaType.VIDEO_GAME) return await searchGames(query);
    return { ok: true, candidates: [] };
  } catch {
    // A provider being down must not take the whole search with it.
    return { ok: false, reason: "request_failed" };
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
    if (source === "igdb") return await igdbDetails(sourceId);
    if (source === "rawg") return await rawgDetails(sourceId);
    return null;
  } catch {
    return null;
  }
}

// ─── Games: IGDB first, RAWG as fallback ─────────────────────────────

/**
 * IGDB is preferred (cover art, plain-text summary, developer/publisher
 * credits); RAWG covers us when the Twitch credentials are absent or IGDB is
 * having a bad day. Only when *neither* can be consulted do we report an issue
 * — a working fallback is a degraded search, not a broken one.
 */
async function searchGames(query: string): Promise<ProviderAttempt> {
  const igdb = await searchIgdb(query);
  if (igdb.ok && igdb.candidates.length > 0) return igdb;

  // Also worth a second opinion when IGDB simply knew nothing: the extra
  // request only happens on a miss, and RAWG occasionally has the obscure
  // title. Whichever provider answers first with something wins.
  const rawg = await searchRawg(query);
  if (rawg.ok && rawg.candidates.length > 0) return rawg;

  // Nothing found. If either provider was actually reachable, that's a real
  // "no such game" — only report an issue when neither could be consulted.
  if (igdb.ok || rawg.ok) return { ok: true, candidates: [] };

  // Prefer "not_configured" — a missing key is the actionable diagnosis.
  const reason: ProviderIssueReason =
    igdb.reason === "not_configured" || rawg.reason === "not_configured"
      ? "not_configured"
      : "request_failed";
  return { ok: false, reason };
}

// ─── TMDB ────────────────────────────────────────────────────────────

async function searchTmdb(
  query: string,
  endpoint: TmdbEndpoint,
): Promise<ProviderAttempt> {
  if (!process.env.TMDB_BEARER_TOKEN) {
    return { ok: false, reason: "not_configured" };
  }

  const url = new URL(`${TMDB_API_BASE}/search/${endpoint}`);
  url.searchParams.set("query", query);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");

  const json = await tmdbFetch(url);
  if (json == null) return { ok: false, reason: "request_failed" };
  const results = arrayValue(recordValue(json).results);

  const candidates = results.slice(0, 10).map((raw) => {
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
      mediaType: endpoint === "movie" ? MediaType.MOVIE : MediaType.TV_SHOW,
      title,
      year: yearOf(date),
      posterUrl: posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null,
      overview: stringValue(record.overview),
    };
  });

  return { ok: true, candidates };
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

async function tmdbGenres(
  endpoint: TmdbEndpoint,
): Promise<Map<number, string>> {
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

// ─── IGDB (games, preferred) ─────────────────────────────────────────

/**
 * IGDB tokens are Twitch app tokens: valid for weeks, and we're expected to
 * reuse them rather than mint one per request. Cached in module scope with a
 * minute of slack so a token can't expire mid-flight.
 */
let igdbToken: { value: string; expiresAt: number } | null = null;

async function igdbAccessToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (igdbToken && igdbToken.expiresAt > Date.now() + 60_000) {
    return igdbToken.value;
  }

  const url = new URL(TWITCH_TOKEN_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const response = await fetch(url, { method: "POST" });
  if (!response.ok) return null;

  const json = recordValue(await response.json());
  const token = stringValue(json.access_token);
  if (!token) return null;

  const expiresIn =
    typeof json.expires_in === "number" ? json.expires_in : 3600;
  igdbToken = { value: token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

/** Returns null when IGDB is unreachable, so callers can fall back to RAWG. */
async function igdbFetch(body: string): Promise<unknown[] | null> {
  const token = await igdbAccessToken();
  if (!token) return null;

  // POST bodies aren't part of Next's fetch cache key, so these calls aren't
  // cached — acceptable because search only fires on an explicit submit.
  const response = await fetch(`${IGDB_API_BASE}/games`, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "client-id": process.env.TWITCH_CLIENT_ID ?? "",
    },
    body,
  });
  if (!response.ok) return null;
  return arrayValue(await response.json());
}

async function searchIgdb(query: string): Promise<ProviderAttempt> {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    return { ok: false, reason: "not_configured" };
  }

  // `version_parent = null` drops "Game of the Year Edition"-style repackages,
  // which otherwise crowd out the base game they're derived from.
  const body = [
    `search ${igdbQuoted(query)};`,
    "fields name,summary,first_release_date,cover.image_id;",
    "where version_parent = null;",
    "limit 10;",
  ].join(" ");

  const rows = await igdbFetch(body);
  if (rows == null) return { ok: false, reason: "request_failed" };

  const candidates = rows.map((raw) => {
    const game = recordValue(raw);
    return {
      source: "igdb" as const,
      sourceId: String(game.id),
      mediaType: MediaType.VIDEO_GAME,
      title: stringValue(game.name) ?? "Untitled",
      year: unixYear(game.first_release_date),
      posterUrl: igdbCoverUrl(game),
      overview: stringValue(game.summary),
    };
  });

  return { ok: true, candidates };
}

async function igdbDetails(sourceId: string): Promise<ProviderDetails | null> {
  const numericId = Number(sourceId);
  if (!Number.isInteger(numericId)) return null;

  const body = [
    `where id = ${numericId};`,
    "fields name,summary,first_release_date,slug,cover.image_id,genres.name,",
    "themes.name,keywords.name,platforms.name,involved_companies.company.name,",
    "involved_companies.developer,involved_companies.publisher;",
    "limit 1;",
  ].join("");

  const rows = await igdbFetch(body);
  const game = recordValue(rows?.[0]);
  if (game.id == null) return null;

  const genres = namesOf(game.genres);
  const themes = namesOf(game.themes);
  const keywords = namesOf(game.keywords).slice(0, 10);
  const slug = stringValue(game.slug);

  return {
    source: "igdb",
    sourceId,
    mediaType: MediaType.VIDEO_GAME,
    title: stringValue(game.name) ?? "Untitled",
    // Unlike RAWG's HTML blob, IGDB's summary is plain text and safe to store.
    description: stringValue(game.summary),
    releaseDate: unixDate(game.first_release_date),
    posterUrl: igdbCoverUrl(game),
    externalUrl: slug ? `https://www.igdb.com/games/${slug}` : null,
    // Themes read like genres to a user ("Horror", "Stealth"); the taxonomy
    // splitter decides which of these land as genres and which become tags.
    genres: [...new Set([...genres, ...themes])],
    tags: keywords,
    platforms: namesOf(game.platforms),
    credits: igdbCredits(game),
  };
}

/** Games credit companies, not people — see CREDIT_ROLES_BY_MEDIA_TYPE. */
function igdbCredits(game: Record<string, unknown>): CreditInput[] {
  const developers: string[] = [];
  const publishers: string[] = [];

  for (const entry of arrayValue(game.involved_companies)) {
    const record = recordValue(entry);
    const name = stringValue(recordValue(record.company).name);
    if (!name) continue;
    if (record.developer === true) developers.push(name);
    if (record.publisher === true) publishers.push(name);
  }

  const credits: CreditInput[] = [];
  if (developers.length > 0) {
    credits.push({
      role: "DEVELOPER",
      kind: "COMPANY",
      names: [...new Set(developers)],
    });
  }
  if (publishers.length > 0) {
    credits.push({
      role: "PUBLISHER",
      kind: "COMPANY",
      names: [...new Set(publishers)],
    });
  }
  return credits;
}

function igdbCoverUrl(game: Record<string, unknown>): string | null {
  const imageId = stringValue(recordValue(game.cover).image_id);
  return imageId ? `${IGDB_IMAGE_BASE}/${imageId}.jpg` : null;
}

/** IGDB's APICalypse query language is string-interpolated; quote carefully. */
function igdbQuoted(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

// ─── RAWG (games, fallback) ──────────────────────────────────────────

async function searchRawg(query: string): Promise<ProviderAttempt> {
  const key = process.env.RAWG_API_KEY;
  if (!key) return { ok: false, reason: "not_configured" };

  const url = new URL(`${RAWG_API_BASE}/games`);
  url.searchParams.set("key", key);
  url.searchParams.set("search", query);
  url.searchParams.set("page_size", "10");

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) return { ok: false, reason: "request_failed" };
  const json = await response.json();

  const candidates = arrayValue(recordValue(json).results).map((raw) => {
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

  return { ok: true, candidates };
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

  const genres = namesOf(game.genres);
  const tags = namesOf(game.tags).slice(0, 10);
  const platforms = arrayValue(game.platforms)
    .map((entry) => stringValue(recordValue(recordValue(entry).platform).name))
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

/** Pull `.name` off a list of `{ name }` records, dropping blanks. */
function namesOf(value: unknown): string[] {
  return arrayValue(value)
    .map((entry) => stringValue(recordValue(entry).name))
    .filter(isPresent);
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

/** IGDB dates are unix *seconds*. */
function unixDate(value: unknown): Date | null {
  if (typeof value !== "number") return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function unixYear(value: unknown): number | null {
  return unixDate(value)?.getUTCFullYear() ?? null;
}
