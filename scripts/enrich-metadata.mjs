import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const endpoint = "https://query.wikidata.org/sparql";
const chunkSize = 35;
const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg
  ? Number.parseInt(limitArg.split("=")[1] ?? "", 10)
  : null;

const typeRoots = {
  MOVIE: "wd:Q11424",
  TV_SHOW: "wd:Q5398426",
  VIDEO_GAME: "wd:Q7889",
};

const genreMap = new Map([
  ["science fiction", "Science Fiction"],
  ["science fiction film", "Science Fiction"],
  ["sci-fi", "Science Fiction"],
  ["comic science fiction", "Science Fiction"],
  ["action film", "Action"],
  ["adventure film", "Adventure"],
  ["animated film", "Animation"],
  ["comedy film", "Comedy"],
  ["comedy drama", "Comedy"],
  ["crime film", "Crime"],
  ["documentary film", "Documentary"],
  ["drama film", "Drama"],
  ["fantasy film", "Fantasy"],
  ["horror film", "Horror"],
  ["musical film", "Musical"],
  ["mystery film", "Mystery"],
  ["romance film", "Romance"],
  ["romantic comedy", "Romance"],
  ["thriller film", "Thriller"],
  ["war film", "War"],
  ["western film", "Western"],
  ["platform game", "Platformer"],
  ["role-playing video game", "RPG"],
  ["action role-playing game", "RPG"],
  ["adventure game", "Adventure"],
  ["action-adventure game", "Adventure"],
  ["puzzle video game", "Puzzle"],
  ["racing video game", "Racing"],
  ["simulation video game", "Simulation"],
  ["strategy video game", "Strategy"],
  ["sports video game", "Sports"],
]);

function sparqlString(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"@en`;
}

function yearFromDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.getUTCFullYear() : null;
}

function datePrecision(value) {
  if (!value) return 0;
  return /^\d{4}-\d{2}-\d{2}/.test(value)
    ? 3
    : /^\d{4}-\d{2}/.test(value)
      ? 2
      : 1;
}

function normalizeGenre(label) {
  const lower = label.toLowerCase().trim();
  if (genreMap.has(lower)) return genreMap.get(lower);

  const cleaned = lower
    .replace(/^animated /, "animation ")
    .replace(/\b(film|television series|television|video game|game)s?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;
  if (genreMap.has(cleaned)) return genreMap.get(cleaned);

  return cleaned
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word) =>
      ["and", "of", "the"].includes(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ")
    .replace(/\bRpg\b/g, "RPG");
}

function normalizeTag(label) {
  const genre = normalizeGenre(label);
  return genre ? normalizeTagName(genre) : null;
}

function normalizeTagName(value) {
  return value
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["rpg", "mmo"].includes(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function normalizeTagKey(value) {
  return normalizeTagName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

async function queryChunk(mediaType, titles) {
  const typeRoot = typeRoots[mediaType];
  const query = `
SELECT ?item ?itemLabel ?title ?date ?genreLabel WHERE {
  VALUES ?title { ${titles.map(sparqlString).join(" ")} }
  ?item rdfs:label ?title.
  FILTER(LANG(?title) = "en")
  ?item wdt:P31/wdt:P279* ${typeRoot}.
  OPTIONAL { ?item wdt:P577 ?date. }
  OPTIONAL { ?item wdt:P136 ?genre. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/sparql-results+json",
      "content-type": "application/sparql-query",
      "user-agent": "Medialy metadata enrichment local script",
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
    if (!title || !itemId) continue;

    const titleCandidates = byTitle.get(title) ?? new Map();
    const candidate = titleCandidates.get(itemId) ?? {
      itemId,
      label: row.itemLabel?.value ?? title,
      dates: new Set(),
      genres: new Set(),
    };

    if (row.date?.value) candidate.dates.add(row.date.value);
    if (row.genreLabel?.value) candidate.genres.add(row.genreLabel.value);

    titleCandidates.set(itemId, candidate);
    byTitle.set(title, titleCandidates);
  }

  return byTitle;
}

function selectCandidate(item, titleCandidates) {
  if (!titleCandidates) return { candidate: null, reason: "no_match" };

  let candidates = [...titleCandidates.values()].map((candidate) => ({
    ...candidate,
    dates: [...candidate.dates].sort(
      (a, b) => datePrecision(b) - datePrecision(a),
    ),
    genres: [...candidate.genres].sort(),
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

function buildUpdate(item, candidate) {
  const canonical = canonicalGenresForMediaType(item.mediaType);
  const genres = [
    ...new Set(candidate.genres.map(normalizeGenre).filter(Boolean)),
  ]
    .filter((genre) => canonical.has(genre))
    .slice(0, 3);
  const tags = [
    ...new Set(candidate.genres.map(normalizeTag).filter(Boolean)),
  ].slice(0, 8);

  const sourceDate = candidate.dates.find(Boolean);
  const existingYear = yearFromDate(item.releaseDate);
  const sourceYear = yearFromDate(sourceDate);
  const shouldUpdateReleaseDate =
    sourceDate &&
    (!item.releaseDate ||
      (existingYear === sourceYear &&
        item.releaseDate.getUTCMonth() === 0 &&
        item.releaseDate.getUTCDate() === 1 &&
        datePrecision(sourceDate) >= 3));

  return {
    releaseDate: shouldUpdateReleaseDate ? new Date(sourceDate) : null,
    genres: item.genres.length === 0 ? genres : [],
    tags: item.tags.length === 0 ? tags : [],
  };
}

async function connectGenres(mediaId, names) {
  for (const name of names) {
    const genre = await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await prisma.mediaGenre.upsert({
      where: { mediaId_genreId: { mediaId, genreId: genre.id } },
      update: {},
      create: { mediaId, genreId: genre.id },
    });
  }
}

async function connectTags(mediaId, names) {
  for (const rawName of names) {
    const name = normalizeTagName(rawName);
    const tag = await prisma.tag.upsert({
      where: { normalizedName: normalizeTagKey(name) },
      update: {},
      create: {
        name,
        normalizedName: normalizeTagKey(name),
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });
    await prisma.mediaTag.upsert({
      where: { mediaId_tagId: { mediaId, tagId: tag.id } },
      update: {},
      create: { mediaId, tagId: tag.id },
    });
  }
}

function canonicalGenresForMediaType(mediaType) {
  if (mediaType === "VIDEO_GAME") {
    return new Set([
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
    ]);
  }
  return new Set([
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
  ]);
}

async function main() {
  const allItems = await prisma.mediaItem.findMany({
    where: { mediaType: { in: Object.keys(typeRoots) } },
    include: { genres: true, tags: true },
    orderBy: [{ mediaType: "asc" }, { title: "asc" }],
  });
  const items = allItems
    .filter(
      (item) =>
        !item.releaseDate || item.genres.length === 0 || item.tags.length === 0,
    )
    .slice(0, Number.isFinite(limit) ? limit : undefined);

  const stats = {
    scanned: items.length,
    matched: 0,
    updated: 0,
    releaseDates: 0,
    genres: 0,
    tags: 0,
    noMatch: 0,
    ambiguous: 0,
    noUsefulData: 0,
  };

  for (const mediaType of Object.keys(typeRoots)) {
    const typedItems = items.filter((item) => item.mediaType === mediaType);
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
          if (reason === "no_match") stats.noMatch += 1;
          else stats.ambiguous += 1;
          continue;
        }

        stats.matched += 1;
        const update = buildUpdate(item, candidate);
        if (
          !update.releaseDate &&
          update.genres.length === 0 &&
          update.tags.length === 0
        ) {
          stats.noUsefulData += 1;
          continue;
        }

        if (!dryRun) {
          await prisma.$transaction(async (tx) => {
            if (update.releaseDate) {
              await tx.mediaItem.update({
                where: { id: item.id },
                data: { releaseDate: update.releaseDate },
              });
            }
          });
          await connectGenres(item.id, update.genres);
          await connectTags(item.id, update.tags);
        }

        stats.updated += 1;
        if (update.releaseDate) stats.releaseDates += 1;
        if (update.genres.length > 0) stats.genres += 1;
        if (update.tags.length > 0) stats.tags += 1;

        console.log(
          JSON.stringify({
            dryRun,
            title: item.title,
            mediaType,
            source: candidate.itemId,
            releaseDate: update.releaseDate?.toISOString().slice(0, 10) ?? null,
            genres: update.genres,
            tags: update.tags,
          }),
        );
      }
    }
  }

  console.error(JSON.stringify(stats, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
