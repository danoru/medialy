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
