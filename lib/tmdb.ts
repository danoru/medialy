/**
 * Runtime TMDB access for the Next.js app.
 *
 * Historically every TMDB call lived in offline backfill scripts that wrote to
 * Postgres. Streaming ("watch provider") availability changes over time, so it
 * is fetched here at request time instead — cached by Next's fetch cache so we
 * hit TMDB at most once per title per day. This is the only place the running
 * app talks to TMDB directly.
 *
 * TMDB watch-provider data is sourced from JustWatch and must be attributed
 * wherever it is displayed (see the "Where to watch" section in the detail view).
 */

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/original";

/** How long a title's watch-provider response is cached (seconds). */
const WATCH_PROVIDERS_TTL = 60 * 60 * 24; // 24h
/** A title's TMDB id is effectively permanent, so cache search hits longer. */
const SEARCH_TTL = 60 * 60 * 24 * 30; // 30d

export type TmdbMediaKind = "movie" | "tv";

export type WatchProvider = {
  name: string;
  logoUrl: string;
  priority: number;
};

export type WatchAvailability = {
  /** JustWatch deep link for the region, if TMDB supplied one. */
  link: string | null;
  /**
   * Everything you can stream without a per-title purchase: subscription
   * (`flatrate`), genuinely free (`free`), and free-with-ads (`ads`). Deduped
   * by provider and sorted by TMDB's display priority. `rent`/`buy` are omitted.
   */
  stream: WatchProvider[];
};

/**
 * Parse the TMDB id out of a canonical `externalUrl` such as
 * `https://www.themoviedb.org/movie/550` or `.../tv/1399-game-of-thrones`.
 * Mirrors the parser used by the backfill scripts and is the single source of
 * truth for reading the id back out of the stored URL.
 */
export function tmdbIdFromUrl(url: string | null | undefined): string | null {
  const kind = tmdbMediaKind(url);
  if (!kind) return null;
  let parsed: URL;
  try {
    parsed = new URL(url as string);
  } catch {
    return null;
  }
  const parts = parsed.pathname.split("/").filter(Boolean);
  const index = parts.findIndex((part) => part === "movie" || part === "tv");
  const segment = index >= 0 ? parts[index + 1] : undefined;
  if (!segment) return null;
  // TMDB slugs can look like "550-fight-club"; the id is the leading number.
  const id = segment.split("-")[0];
  return /^\d+$/.test(id) ? id : null;
}

/** Whether an `externalUrl` points at a TMDB movie or tv record. */
export function tmdbMediaKind(
  url: string | null | undefined,
): TmdbMediaKind | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!parsed.hostname.endsWith("themoviedb.org")) return null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.includes("movie")) return "movie";
  if (parts.includes("tv")) return "tv";
  return null;
}

function normalizeSearchTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Look up a TMDB id by title when `externalUrl` isn't a TMDB link — e.g. items
 * imported from Letterboxd, RAWG, or elsewhere store their own source's URL in
 * that column, so it never becomes a `themoviedb.org` link even after a TMDB
 * match exists. This is a read-only lookup: it queries TMDB's search endpoint
 * and returns an id for this render only. It never writes to the database, so
 * it can't affect (or lose) any stored data. Returns `null` on no match, a
 * missing token, or a request failure — callers render nothing in that case.
 */
export async function resolveTmdbId(
  title: string | null | undefined,
  year: number | null,
  kind: TmdbMediaKind,
): Promise<string | null> {
  const token = process.env.TMDB_BEARER_TOKEN;
  if (!token || !title) return null;

  const url = new URL(`${TMDB_API_BASE}/search/${kind}`);
  url.searchParams.set("query", title);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");
  if (year) {
    url.searchParams.set(
      kind === "movie" ? "year" : "first_air_date_year",
      String(year),
    );
  }

  let json: unknown;
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      next: { revalidate: SEARCH_TTL },
    });
    if (!response.ok) return null;
    json = await response.json();
  } catch {
    return null;
  }

  const results = (json as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(results) || results.length === 0) return null;

  // Prefer an exact (normalized) title match over TMDB's raw relevance
  // ranking, since a popular unrelated title can otherwise outrank a low-
  // profile exact match.
  const normalizedTarget = normalizeSearchTitle(title);
  const exact = results.filter((raw) => {
    const record = raw as Record<string, unknown>;
    const candidateTitle = (
      kind === "movie" ? record.title : record.name
    ) as string | undefined;
    return candidateTitle
      ? normalizeSearchTitle(candidateTitle) === normalizedTarget
      : false;
  });
  const best = (exact.length > 0 ? exact : results)[0] as
    | Record<string, unknown>
    | undefined;
  const id = best?.id;
  return typeof id === "number" ? String(id) : null;
}

type ProviderEntry = {
  provider_id?: unknown;
  provider_name?: unknown;
  logo_path?: unknown;
  display_priority?: unknown;
};

function normalizeProviders(entries: unknown): WatchProvider[] {
  if (!Array.isArray(entries)) return [];
  const byId = new Map<number, WatchProvider>();
  for (const raw of entries) {
    const entry = raw as ProviderEntry;
    const id = typeof entry.provider_id === "number" ? entry.provider_id : null;
    const name =
      typeof entry.provider_name === "string" ? entry.provider_name : null;
    const logoPath =
      typeof entry.logo_path === "string" ? entry.logo_path : null;
    if (id === null || !name || !logoPath) continue;
    const priority =
      typeof entry.display_priority === "number"
        ? entry.display_priority
        : Number.MAX_SAFE_INTEGER;
    // First occurrence wins; keep the smallest (best) priority seen.
    const existing = byId.get(id);
    if (existing) {
      existing.priority = Math.min(existing.priority, priority);
      continue;
    }
    byId.set(id, { name, logoUrl: `${TMDB_LOGO_BASE}${logoPath}`, priority });
  }
  return [...byId.values()].sort((a, b) => a.priority - b.priority);
}

/**
 * Fetch the streamable providers for a title in a region. Returns `null` when
 * the token is missing, the id is unknown, the request fails, or the region has
 * no streamable providers — callers render nothing in those cases. Never throws.
 *
 * `region` defaults to US and is a parameter so a future per-user/global region
 * setting can be threaded through without changing the signature.
 */
export async function getWatchProviders(
  tmdbId: string | null,
  kind: TmdbMediaKind | null,
  region = "US",
): Promise<WatchAvailability | null> {
  const token = process.env.TMDB_BEARER_TOKEN;
  if (!token || !tmdbId || !kind) return null;

  let json: unknown;
  try {
    const response = await fetch(
      `${TMDB_API_BASE}/${kind}/${tmdbId}/watch/providers`,
      {
        headers: { authorization: `Bearer ${token}` },
        next: { revalidate: WATCH_PROVIDERS_TTL },
      },
    );
    if (!response.ok) return null;
    json = await response.json();
  } catch {
    return null;
  }

  const results = (json as { results?: Record<string, unknown> } | null)
    ?.results;
  const regional = results?.[region] as
    | {
        link?: unknown;
        flatrate?: unknown;
        free?: unknown;
        ads?: unknown;
      }
    | undefined;
  if (!regional) return null;

  const stream = normalizeProviders([
    ...(Array.isArray(regional.flatrate) ? regional.flatrate : []),
    ...(Array.isArray(regional.free) ? regional.free : []),
    ...(Array.isArray(regional.ads) ? regional.ads : []),
  ]);
  if (stream.length === 0) return null;

  return {
    link: typeof regional.link === "string" ? regional.link : null,
    stream,
  };
}
