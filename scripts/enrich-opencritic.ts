import { MediaType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fileBackfillSuggestion,
  getBackfillSuggestionUser,
} from "@/lib/backfill-suggestions";
import { manualRatingDef } from "@/lib/external-ratings";
import { recomputeConsensusScore } from "@/lib/scoring/recompute";

/**
 * Backfill OpenCritic critic scores for video games, sourced from Wikidata.
 *
 * OpenCritic complements Metacritic rather than replacing it: both are already
 * trusted at 1.0 in `SOURCE_TRUST_WEIGHTS`, and `SOURCE_MEDIA_APPLICABILITY`
 * gates OpenCritic to VIDEO_GAME, so a game with both gets a genuinely
 * two-source consensus instead of one critic aggregate wearing two hats.
 *
 * ## Why Wikidata rather than OpenCritic's own API
 *
 * Same reason `enrich-ratings.mjs` uses it for Metacritic: no API key, no rate
 * agreement, no new secret to sync to Vercel. Coverage is better than you'd
 * expect — OpenCritic is the single largest review-score publisher for games on
 * Wikidata, ahead of Metacritic.
 *
 * ## Two traps this script exists to avoid
 *
 * 1. **Two different OpenCritic metrics share the P447 publisher.** Every game
 *    carries both a "Top Critic Average" (`77/100`) and a "Critics Recommend"
 *    percentage (`60%`) — and they diverge wildly (Layers of Fear: Inheritance
 *    is 66/100 but 25%). Only Top Critic Average is a quality score comparable
 *    to Metacritic, so we filter on P459 = Q114712322 and ignore the other.
 *    Without that filter you get whichever number happens to be larger.
 *
 * 2. **Wikidata labels have largely moved to the `mul` language code.** Matching
 *    `rdfs:label` with `FILTER(LANG(?title) = "en")` — as `enrich-ratings.mjs`
 *    still does — silently misses most games: of a 25-title sample it found one.
 *    Binding both `@en` and `@mul` literals finds 22 of 25 and, because it's an
 *    exact literal match, runs ~20x faster than a `STR()` comparison.
 *
 * ## Data safety
 *
 * A game with no OpenCritic score gets one, written with
 * `createMany({ skipDuplicates: true })` so the call itself cannot update or
 * delete anything. A game that *already* has one — hand-entered or otherwise —
 * is never rewritten: if the fetched score disagrees, that is filed as a
 * PENDING suggestion in /admin/edits for you to accept or reject. Disagreement
 * becomes something you get told about rather than something that silently
 * happens to your data.
 *
 * Consensus is recomputed through the canonical `lib/scoring` logic (media
 * gating, recency decay, outlier trim) rather than a local reimplementation.
 *
 * Usage:
 *   pnpm opencritic:fetch -- --dry-run
 *   pnpm opencritic:fetch -- --limit=50
 *   pnpm opencritic:fetch
 */

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";

/** Wikidata entities. Referenced by QID: OpenCritic has no English label. */
const VIDEO_GAME_ROOT = "wd:Q7889";
const OPENCRITIC = "wd:Q21039459";
const TOP_CRITIC_AVERAGE = "wd:Q114712322";

const SOURCE = "OPENCRITIC" as const;
const CHUNK_SIZE = 25;

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg
  ? Number.parseInt(limitArg.split("=")[1] ?? "", 10)
  : null;

type Candidate = {
  itemId: string;
  label: string;
  dates: Set<string>;
  rawScore: string;
  score: number;
  scale: number;
  reviewCount: number | null;
  openCriticId: string | null;
};

async function main() {
  const stats = {
    scanned: 0,
    matched: 0,
    created: 0,
    noMatch: 0,
    ambiguous: 0,
    unchanged: 0,
    conflictsFiled: 0,
    conflictsAlreadyQueued: 0,
  };

  // Lean projection: this is a full pass over the game catalog, and the
  // description / metadataJson columns are multi-KB. Only three fields are
  // needed — id to write, title to match, releaseDate to disambiguate.
  const items = await prisma.mediaItem.findMany({
    where: { mediaType: MediaType.VIDEO_GAME },
    select: {
      id: true,
      title: true,
      releaseDate: true,
      // Needed to detect a conflict, and to rebuild the complete rating list a
      // suggestion payload has to carry. Three tiny columns, not the whole row.
      externalRatings: { select: { source: true, score: true, scale: true } },
    },
    orderBy: [{ title: "asc" }],
    take: Number.isFinite(limit) && limit ? limit : undefined,
  });
  stats.scanned = items.length;

  for (let index = 0; index < items.length; index += CHUNK_SIZE) {
    const chunk = items.slice(index, index + CHUNK_SIZE);
    const titles = [...new Set(chunk.map((item) => item.title))];
    const candidatesByTitle = await queryChunk(titles);

    for (const item of chunk) {
      const { candidate, reason } = selectCandidate(
        item.releaseDate,
        candidatesByTitle.get(item.title),
      );

      if (!candidate) {
        if (reason === "no_match") stats.noMatch += 1;
        else stats.ambiguous += 1;
        continue;
      }

      stats.matched += 1;

      // Only manual-def sources appear in an edit snapshot, so a proposal has
      // to be built from exactly that subset (see snapshotMediaItem).
      const manualRatings = item.externalRatings.filter(
        (rating) => manualRatingDef(rating.source) != null,
      );
      const existing = manualRatings.find((rating) => rating.source === SOURCE);

      if (!existing) {
        if (!dryRun) {
          // createMany + skipDuplicates: a write that structurally cannot
          // overwrite an existing OpenCritic score, even under a race.
          const result = await prisma.externalRating.createMany({
            data: [
              {
                mediaId: item.id,
                source: SOURCE,
                score: candidate.score,
                scale: candidate.scale,
                sourceUrl: candidate.openCriticId
                  ? `https://opencritic.com/game/${candidate.openCriticId}`
                  : null,
                metadataJson: JSON.stringify({
                  wikidataItem: candidate.itemId,
                  wikidataLabel: candidate.label,
                  rawScore: candidate.rawScore,
                  reviewCount: candidate.reviewCount,
                  metric: "top_critic_average",
                  fetchedVia: "wikidata",
                }),
              },
            ],
            skipDuplicates: true,
          });
          if (result.count === 0) continue;
          await recomputeConsensusScore(item.id);
        }

        stats.created += 1;
        logRow("created", item.title, candidate, null);
        continue;
      }

      if (sameScore(existing, candidate)) {
        stats.unchanged += 1;
        continue;
      }

      // Disagreement. The existing score stays exactly as it is; the proposal
      // goes to /admin/edits instead.
      if (!dryRun) {
        const proposed = [
          ...manualRatings.filter((rating) => rating.source !== SOURCE),
          { source: SOURCE, score: candidate.score, scale: candidate.scale },
        ].sort((a, b) => a.source.localeCompare(b.source));

        const filed = await fileBackfillSuggestion({
          mediaId: item.id,
          userId: await suggestionUserId(),
          proposal: { externalRatings: proposed },
          note:
            `OpenCritic Top Critic Average is ${candidate.score}/${candidate.scale}` +
            ` (${candidate.reviewCount ?? "?"} critics); this item has` +
            ` ${existing.score}/${existing.scale}. Existing score left untouched.`,
        });

        if (filed.status === "filed") stats.conflictsFiled += 1;
        else stats.conflictsAlreadyQueued += 1;
      } else {
        stats.conflictsFiled += 1;
      }

      logRow("conflict", item.title, candidate, existing);
    }
  }

  console.error(JSON.stringify(stats, null, 2));
}

/** The bot account that authors suggestions; resolved once per run. */
let cachedSuggestionUserId: string | null = null;
async function suggestionUserId() {
  cachedSuggestionUserId ??= (await getBackfillSuggestionUser()).id;
  return cachedSuggestionUserId;
}

/** Compare on a common scale — a 90/100 and a 9/10 are the same score. */
function sameScore(
  existing: { score: number; scale: number },
  candidate: { score: number; scale: number },
) {
  if (existing.scale <= 0 || candidate.scale <= 0) return false;
  const difference = Math.abs(
    existing.score / existing.scale - candidate.score / candidate.scale,
  );
  return difference < 0.005;
}

function logRow(
  action: "created" | "conflict",
  title: string,
  candidate: Candidate,
  existing: { score: number; scale: number } | null,
) {
  console.log(
    JSON.stringify({
      dryRun,
      action,
      title,
      source: SOURCE,
      score: candidate.score,
      scale: candidate.scale,
      existingScore: existing ? `${existing.score}/${existing.scale}` : null,
      reviewCount: candidate.reviewCount,
      wikidataItem: candidate.itemId,
    }),
  );
}

async function queryChunk(titles: string[]) {
  // Bind both language tags: Wikidata has migrated most item labels to `mul`,
  // and an `@en`-only match finds almost nothing (see the header comment).
  const values = titles
    .flatMap((title) => [
      `${JSON.stringify(title)}@en`,
      `${JSON.stringify(title)}@mul`,
    ])
    .join(" ");

  const query = `
SELECT ?title ?item ?itemLabel ?date ?score ?reviewCount ?openCriticId WHERE {
  VALUES ?label { ${values} }
  ?item rdfs:label ?label.
  BIND(STR(?label) AS ?title)
  ?item wdt:P31/wdt:P279* ${VIDEO_GAME_ROOT}.
  ?item p:P444 ?scoreStatement.
  ?scoreStatement ps:P444 ?score.
  ?scoreStatement pq:P447 ${OPENCRITIC}.
  ?scoreStatement pq:P459 ${TOP_CRITIC_AVERAGE}.
  OPTIONAL { ?item wdt:P577 ?date. }
  OPTIONAL { ?scoreStatement pq:P7887 ?reviewCount. }
  OPTIONAL { ?item wdt:P2864 ?openCriticId. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

  const response = await fetch(WIKIDATA_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/sparql-results+json",
      "content-type": "application/sparql-query",
      "user-agent": "Medialy OpenCritic enrichment local script",
    },
    body: query,
  });

  if (!response.ok) {
    throw new Error(
      `Wikidata request failed: ${response.status} ${response.statusText}`,
    );
  }

  const json = (await response.json()) as {
    results: { bindings: Record<string, { value: string }>[] };
  };
  return collectCandidates(json.results.bindings);
}

/**
 * One item yields a row per release date, so fold rows into one candidate per
 * Wikidata item and keep the dates as a set for year disambiguation.
 */
function collectCandidates(bindings: Record<string, { value: string }>[]) {
  const byTitle = new Map<string, Map<string, Candidate>>();

  for (const row of bindings) {
    const title = row.title?.value;
    const itemId = row.item?.value;
    const parsed = parseScore(row.score?.value);
    if (!title || !itemId || !parsed) continue;

    const forTitle = byTitle.get(title) ?? new Map<string, Candidate>();
    const candidate: Candidate = forTitle.get(itemId) ?? {
      itemId,
      label: row.itemLabel?.value ?? title,
      dates: new Set<string>(),
      rawScore: row.score.value,
      score: parsed.score,
      scale: parsed.scale,
      reviewCount: parseCount(row.reviewCount?.value),
      openCriticId: row.openCriticId?.value ?? null,
    };

    if (row.date?.value) candidate.dates.add(row.date.value);
    forTitle.set(itemId, candidate);
    byTitle.set(title, forTitle);
  }

  return byTitle;
}

/**
 * Refuse to guess. A title matching two distinct Wikidata games is only
 * resolved when our release year picks exactly one of them; otherwise skip and
 * report, rather than attaching a plausible-looking score to the wrong game.
 */
function selectCandidate(
  releaseDate: Date | null,
  forTitle: Map<string, Candidate> | undefined,
): { candidate: Candidate | null; reason: string } {
  if (!forTitle || forTitle.size === 0) {
    return { candidate: null, reason: "no_match" };
  }

  let candidates = [...forTitle.values()];

  const year = releaseDate ? releaseDate.getUTCFullYear() : null;
  if (year && candidates.length > 1) {
    const sameYear = candidates.filter((candidate) =>
      [...candidate.dates].some((date) => yearOf(date) === year),
    );
    if (sameYear.length === 1) candidates = sameYear;
  }

  if (candidates.length !== 1) {
    return { candidate: null, reason: `ambiguous_${candidates.length}` };
  }
  return { candidate: candidates[0], reason: "matched" };
}

/**
 * Top Critic Average arrives as `"89/100"`. A bare number is accepted as a
 * /100 score, but a percentage is not: `"60%"` is the Critics Recommend metric
 * leaking through, and treating it as a quality score is exactly the bug the
 * P459 filter exists to prevent.
 */
function parseScore(value: string | undefined) {
  if (!value) return null;
  const text = value.trim();

  const fraction = text.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) {
    const score = Number(fraction[1]);
    const scale = Number(fraction[2]);
    return Number.isFinite(score) && Number.isFinite(scale) && scale > 0
      ? { score, scale }
      : null;
  }

  if (text.includes("%")) return null;

  const score = Number(text);
  return Number.isFinite(score) && score >= 0 && score <= 100
    ? { score, scale: 100 }
    : null;
}

function parseCount(value: string | undefined) {
  if (!value) return null;
  const count = Number.parseInt(value, 10);
  return Number.isFinite(count) ? count : null;
}

function yearOf(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
