import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const endpoint = "https://query.wikidata.org/sparql";
const chunkSize = 25;
const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg
  ? Number.parseInt(limitArg.split("=")[1] ?? "", 10)
  : null;
const typesArg = process.argv.find((arg) => arg.startsWith("--types="));

const source = "METACRITIC";
const sourceTrustWeights = { METACRITIC: 1 };
const typeRoots = {
  MOVIE: "wd:Q11424",
  TV_SHOW: "wd:Q5398426",
  VIDEO_GAME: "wd:Q7889",
};
const selectedMediaTypes = parseMediaTypes(typesArg);

function sparqlString(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"@en`;
}

function yearFromDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.getUTCFullYear() : null;
}

async function queryChunk(mediaType, titles) {
  const typeRoot = typeRoots[mediaType];
  const query = `
SELECT ?item ?itemLabel ?title ?date ?score ?metacriticId ?metacriticGameId WHERE {
  VALUES ?title { ${titles.map(sparqlString).join(" ")} }
  ?item rdfs:label ?title.
  FILTER(LANG(?title) = "en")
  ?item wdt:P31/wdt:P279* ${typeRoot}.
  ?item p:P444 ?scoreStatement.
  ?scoreStatement ps:P444 ?score.
  ?scoreStatement pq:P447 wd:Q150248.
  OPTIONAL { ?item wdt:P577 ?date. }
  OPTIONAL { ?item wdt:P1712 ?metacriticId. }
  OPTIONAL { ?item wdt:P12054 ?metacriticGameId. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/sparql-results+json",
      "content-type": "application/sparql-query",
      "user-agent": "Medialy ratings enrichment local script",
    },
    body: query,
  });

  if (!response.ok) {
    throw new Error(
      `Wikidata request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

function collectCandidates(bindings) {
  const byTitle = new Map();

  for (const row of bindings) {
    const title = row.title?.value;
    const itemId = row.item?.value;
    const parsed = parseReviewScore(row.score?.value);
    if (!title || !itemId || !parsed) continue;

    const titleCandidates = byTitle.get(title) ?? new Map();
    const candidate = titleCandidates.get(itemId) ?? {
      itemId,
      label: row.itemLabel?.value ?? title,
      dates: new Set(),
      scores: [],
      metacriticPaths: new Set(),
    };

    if (row.date?.value) candidate.dates.add(row.date.value);
    candidate.scores.push({
      raw: row.score.value,
      score: parsed.score,
      scale: parsed.scale,
    });
    if (row.metacriticId?.value)
      candidate.metacriticPaths.add(row.metacriticId.value);
    if (row.metacriticGameId?.value)
      candidate.metacriticPaths.add(
        metacriticGamePath(row.metacriticGameId.value),
      );

    titleCandidates.set(itemId, candidate);
    byTitle.set(title, titleCandidates);
  }

  return byTitle;
}

function selectCandidate(item, titleCandidates) {
  if (!titleCandidates) return { candidate: null, reason: "no_match" };

  let candidates = [...titleCandidates.values()].map((candidate) => ({
    ...candidate,
    dates: [...candidate.dates].sort(),
    metacriticPaths: [...candidate.metacriticPaths].sort(),
  }));

  const existingYear = yearFromDate(item.releaseDate);
  if (existingYear) {
    const matchingYear = candidates.filter((candidate) =>
      candidate.dates.some((date) => yearFromDate(date) === existingYear),
    );
    if (matchingYear.length === 1) candidates = matchingYear;
  }

  if (candidates.length !== 1) {
    return { candidate: null, reason: `ambiguous_${candidates.length}` };
  }

  return { candidate: candidates[0], reason: "matched" };
}

function buildRating(candidate) {
  const sortedScores = [...candidate.scores].sort((first, second) => {
    const firstNormalized = first.score / first.scale;
    const secondNormalized = second.score / second.scale;
    return secondNormalized - firstNormalized;
  });
  const score = sortedScores[0];
  if (!score) return null;

  const metacriticPath = candidate.metacriticPaths[0] ?? null;
  return {
    score: score.score,
    scale: score.scale,
    sourceUrl: metacriticPath
      ? `https://www.metacritic.com/${metacriticPath.replace(/^\/+/, "")}`
      : null,
    metadata: {
      wikidataItem: candidate.itemId,
      wikidataLabel: candidate.label,
      rawScore: score.raw,
      metacriticPath,
      fetchedVia: "wikidata",
    },
  };
}

async function main() {
  const stats = {
    scanned: 0,
    matched: 0,
    upserted: 0,
    noMatch: 0,
    ambiguous: 0,
    byType: Object.fromEntries(
      selectedMediaTypes.map((mediaType) => [
        mediaType,
        { scanned: 0, matched: 0, upserted: 0, noMatch: 0, ambiguous: 0 },
      ]),
    ),
  };

  for (const mediaType of selectedMediaTypes) {
    const typedItems = await prisma.mediaItem.findMany({
      where: {
        mediaType,
        externalRatings: { none: { source } },
      },
      orderBy: [{ title: "asc" }],
      take: Number.isFinite(limit) ? limit : undefined,
    });
    stats.scanned += typedItems.length;
    stats.byType[mediaType].scanned = typedItems.length;

    for (let index = 0; index < typedItems.length; index += chunkSize) {
      const chunk = typedItems.slice(index, index + chunkSize);
      const titles = [...new Set(chunk.map((item) => item.title))];
      const data = await queryChunk(mediaType, titles);
      const candidatesByTitle = collectCandidates(data.results.bindings);

      for (const item of chunk) {
        const { candidate, reason } = selectCandidate(
          item,
          candidatesByTitle.get(item.title),
        );
        if (!candidate) {
          if (reason === "no_match") {
            stats.noMatch += 1;
            stats.byType[mediaType].noMatch += 1;
          } else {
            stats.ambiguous += 1;
            stats.byType[mediaType].ambiguous += 1;
          }
          continue;
        }

        const rating = buildRating(candidate);
        if (!rating) {
          stats.noMatch += 1;
          stats.byType[mediaType].noMatch += 1;
          continue;
        }

        stats.matched += 1;
        stats.byType[mediaType].matched += 1;
        if (!dryRun) {
          await prisma.externalRating.upsert({
            where: { mediaId_source: { mediaId: item.id, source } },
            update: {
              score: rating.score,
              scale: rating.scale,
              sourceUrl: rating.sourceUrl,
              metadataJson: JSON.stringify(rating.metadata),
              fetchedAt: new Date(),
            },
            create: {
              mediaId: item.id,
              source,
              score: rating.score,
              scale: rating.scale,
              sourceUrl: rating.sourceUrl,
              metadataJson: JSON.stringify(rating.metadata),
            },
          });
          await recomputeConsensusScore(item.id);
        }

        stats.upserted += 1;
        stats.byType[mediaType].upserted += 1;
        console.log(
          JSON.stringify({
            dryRun,
            title: item.title,
            mediaType,
            source,
            score: rating.score,
            scale: rating.scale,
            sourceUrl: rating.sourceUrl,
            wikidataItem: rating.metadata.wikidataItem,
          }),
        );
      }
    }
  }

  console.error(JSON.stringify(stats, null, 2));
}

function parseMediaTypes(value) {
  if (!value) return Object.keys(typeRoots);

  const aliases = {
    movie: "MOVIE",
    movies: "MOVIE",
    tv: "TV_SHOW",
    show: "TV_SHOW",
    shows: "TV_SHOW",
    tv_show: "TV_SHOW",
    tv_shows: "TV_SHOW",
    game: "VIDEO_GAME",
    games: "VIDEO_GAME",
    video_game: "VIDEO_GAME",
    video_games: "VIDEO_GAME",
  };
  const requested = value
    .split("=")[1]
    ?.split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const mediaTypes = [
    ...new Set((requested ?? []).map((entry) => aliases[entry] ?? entry)),
  ].filter((entry) => Object.hasOwn(typeRoots, entry));

  if (mediaTypes.length === 0) {
    throw new Error(
      "No supported media types selected. Use --types=movie,tv,game.",
    );
  }

  return mediaTypes;
}

function metacriticGamePath(value) {
  const path = String(value).replace(/^\/+/, "");
  return path.startsWith("game/") ? path : `game/${path}`;
}

function parseReviewScore(value) {
  if (!value) return null;
  const text = String(value).trim();
  const fraction = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (fraction) {
    const score = Number(fraction[1]);
    const scale = Number(fraction[2]);
    return Number.isFinite(score) && Number.isFinite(scale) && scale > 0
      ? { score, scale }
      : null;
  }

  const percent = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percent) {
    const score = Number(percent[1]);
    return Number.isFinite(score) ? { score, scale: 100 } : null;
  }

  const score = Number(text);
  if (!Number.isFinite(score)) return null;
  return { score, scale: score <= 10 ? 10 : 100 };
}

async function recomputeConsensusScore(mediaId) {
  const ratings = await prisma.externalRating.findMany({
    where: { mediaId },
    select: { source: true, score: true, scale: true },
  });
  const consensus = calculateConsensusScore(ratings);
  await prisma.mediaItem.update({
    where: { id: mediaId },
    data: {
      computedConsensusScore: consensus.score,
      consensusConfidence: consensus.confidence,
    },
  });
}

function calculateConsensusScore(ratings) {
  const weighted = ratings
    .map((entry) => {
      if (entry.scale <= 0) return null;
      return {
        normalized: clamp((entry.score / entry.scale) * 10, 0, 10),
        weight: sourceTrustWeights[entry.source] ?? 0.5,
      };
    })
    .filter(Boolean);
  if (weighted.length === 0) return { score: null, confidence: 0 };

  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const score =
    weighted.reduce((sum, entry) => sum + entry.normalized * entry.weight, 0) /
    totalWeight;
  const variance =
    weighted.reduce(
      (sum, entry) => sum + Math.abs(entry.normalized - score),
      0,
    ) / weighted.length;
  const sourceConfidence = clamp(totalWeight / 3, 0.25, 1);
  const agreementConfidence = clamp(1 - variance / 5, 0.3, 1);
  return {
    score: Math.round(score * 10) / 10,
    confidence: Math.round(sourceConfidence * agreementConfidence * 100) / 100,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
