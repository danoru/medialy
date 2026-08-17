/**
 * Caching for shared-catalog reads.
 *
 * A handful of expensive queries are identical for every viewer and change
 * slowly — the Canon pool + ranking, and the global ranking-aggregate priors
 * that back the dashboard/Discover "top" lists. Every page is `force-dynamic`,
 * which disables the full-route cache but NOT the data cache, so wrapping these
 * helpers in `unstable_cache` lets repeat visits serve them without touching
 * Neon, while the surrounding page stays dynamic for per-user data.
 *
 * Invalidation is TIME-BASED (see the window below). We deliberately don't wire
 * `revalidateTag` yet: in this Next version its signature is the newer
 * `revalidateTag(tag, profile)` tied to the `"use cache"` model, and whether it
 * clears `unstable_cache` tags is unverified. The tag is still attached to each
 * cache entry so a future migration to that model can invalidate on demand;
 * until then the time window is the single, reliable staleness bound.
 */

/** Tag attached to all cached catalog reads (for future explicit invalidation). */
export const CATALOG_CACHE_TAG = "catalog";

/**
 * Staleness bound for cached catalog data. It's a "best of all time" ranking
 * and slow-moving global priors that aggregate over every user, so a few
 * minutes of lag is imperceptible and never touches a viewer's own (uncached)
 * personal data. This is also how long an admin catalog edit can take to appear
 * on Canon / the dashboard "top" lists.
 */
export const CATALOG_REVALIDATE_SECONDS = 300;

/**
 * Staleness bound for the full catalog read in `@/lib/db/catalog`.
 *
 * Longer than the window above because the payload is far larger: Canon and the
 * ranking aggregates are a few KB, while the whole catalog is on the order of a
 * megabyte or two. Each expiry costs one full re-read, so the window sets the
 * ceiling on catalog egress — at ~2 MB a refresh, five minutes would allow
 * ~8.6k refreshes a month (over the free tier's 5 GB on its own) whereas thirty
 * minutes caps it near 1.4k. Under this app's real traffic the practical cost is
 * closer to one refresh per browsing session either way; the longer window is
 * headroom against growth, not a tax on today.
 *
 * The trade is that an edit to *shared* catalog metadata (title, poster, genres)
 * can take this long to show up on the dashboard and Discover. Per-user data —
 * status, ratings, archive — is never cached and updates immediately.
 */
export const FULL_CATALOG_REVALIDATE_SECONDS = 1800;
