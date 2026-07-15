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
