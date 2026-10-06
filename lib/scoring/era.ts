/**
 * Release eras for the recommendation engine.
 *
 * Five periods rather than decades: each is a stretch with its own look and
 * cultural cachet (the studio classics, New Hollywood and the blockbuster
 * eighties, the nineties and two-thousands, the streaming-era 2010s, the
 * present), and five buckets keep a modest library from spreading too thin to
 * say anything. The same buckets serve every medium.
 */

export type EraKey = "pre-1970" | "1970-1989" | "1990-2009" | "2010-2019" | "2020+";

export const ERAS: ReadonlyArray<{
  key: EraKey;
  /** Reads after "from": "films from before 1970". */
  label: string;
  /** First year after the era. */
  until: number;
}> = [
  { key: "pre-1970", label: "before 1970", until: 1970 },
  { key: "1970-1989", label: "the 1970s and 80s", until: 1990 },
  { key: "1990-2009", label: "the 1990s and 2000s", until: 2010 },
  { key: "2010-2019", label: "the 2010s", until: 2020 },
  { key: "2020+", label: "2020 on", until: Number.POSITIVE_INFINITY },
];

export function eraOf(date: Date | string | null | undefined): EraKey | null {
  if (!date) return null;
  const year = new Date(date).getUTCFullYear();
  if (!Number.isFinite(year)) return null;
  return ERAS.find((era) => year < era.until)?.key ?? null;
}

export function eraLabel(key: EraKey): string {
  return ERAS.find((era) => era.key === key)?.label ?? key;
}

/**
 * Catalog-wide facts about each era, per medium: what share of the catalog
 * it holds (the yardstick for "you watch a lot of these") and its mean critic
 * score (the yardstick for "critics rate it well for its time").
 */
export type EraContext = {
  share: Map<string, Map<EraKey, number>>;
  criticMean: Map<string, Map<EraKey, number>>;
};

export function buildEraContext(
  items: Array<{
    mediaType: string;
    releaseDate?: Date | string | null;
    computedConsensusScore: number | null;
  }>,
): EraContext {
  const counts = new Map<string, Map<EraKey, number>>();
  const totals = new Map<string, number>();
  const critics = new Map<string, Map<EraKey, { sum: number; count: number }>>();
  for (const item of items) {
    const era = eraOf(item.releaseDate);
    if (!era) continue;
    const medium = item.mediaType;
    const byEra = counts.get(medium) ?? new Map<EraKey, number>();
    byEra.set(era, (byEra.get(era) ?? 0) + 1);
    counts.set(medium, byEra);
    totals.set(medium, (totals.get(medium) ?? 0) + 1);
    if (item.computedConsensusScore != null) {
      const criticByEra =
        critics.get(medium) ?? new Map<EraKey, { sum: number; count: number }>();
      const acc = criticByEra.get(era) ?? { sum: 0, count: 0 };
      acc.sum += item.computedConsensusScore;
      acc.count += 1;
      criticByEra.set(era, acc);
      critics.set(medium, criticByEra);
    }
  }
  const share = new Map<string, Map<EraKey, number>>();
  for (const [medium, byEra] of counts) {
    const total = totals.get(medium) ?? 0;
    share.set(
      medium,
      new Map([...byEra].map(([era, count]) => [era, count / total])),
    );
  }
  const criticMean = new Map<string, Map<EraKey, number>>();
  for (const [medium, byEra] of critics) {
    criticMean.set(
      medium,
      new Map([...byEra].map(([era, acc]) => [era, acc.sum / acc.count])),
    );
  }
  return { share, criticMean };
}

/** How many titles the viewer tracks from each era, per medium. */
export type EraExposure = Map<string, { counts: Map<EraKey, number>; total: number }>;

/**
 * What the viewer chooses to watch, rated or not: every non-archived title on
 * any status except untracked and not-interested. Ratings alone can't show
 * this — people who rarely watch classics tend to watch only the best ones,
 * and rate them well.
 */
export function buildEraExposure(
  rows: Array<{
    media: { id: string; mediaType: string; releaseDate?: Date | string | null };
    status: string;
    isArchived: boolean;
  }>,
): EraExposure {
  const exposure: EraExposure = new Map();
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.isArchived || seen.has(row.media.id)) continue;
    if (row.status === "UNTRACKED" || row.status === "NOT_INTERESTED") continue;
    seen.add(row.media.id);
    const era = eraOf(row.media.releaseDate);
    if (!era) continue;
    const entry = exposure.get(row.media.mediaType) ?? {
      counts: new Map<EraKey, number>(),
      total: 0,
    };
    entry.counts.set(era, (entry.counts.get(era) ?? 0) + 1);
    entry.total += 1;
    exposure.set(row.media.mediaType, entry);
  }
  return exposure;
}
