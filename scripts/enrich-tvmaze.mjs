import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg
  ? Number.parseInt(limitArg.split("=")[1] ?? "", 10)
  : null;

function normalizeTitle(value) {
  return value
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      ["and", "of", "the"].includes(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ")
    .replace(/\bSci Fi\b/g, "Science Fiction");
}

function tag(value) {
  return normalizeTagName(value);
}

function normalizeTagName(value) {
  return titleCase(value.replace(/[-_]+/g, " "));
}

function normalizeTagKey(value) {
  return normalizeTagName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

async function searchShow(title) {
  const response = await fetch(
    `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`,
    { headers: { "user-agent": "Medialy metadata enrichment local script" } },
  );
  if (!response.ok) {
    throw new Error(
      `TVMaze request failed: ${response.status} ${response.statusText}`,
    );
  }

  const results = await response.json();
  const normalized = normalizeTitle(title);
  const exact = results
    .map((entry) => entry.show)
    .filter((show) => normalizeTitle(show.name) === normalized);

  return exact.length === 1 ? exact[0] : null;
}

async function connectGenres(mediaId, names) {
  const canonical = new Set([
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
  for (const name of names.filter((entry) => canonical.has(entry))) {
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
    const nextTag = await prisma.tag.upsert({
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
      where: { mediaId_tagId: { mediaId, tagId: nextTag.id } },
      update: {},
      create: { mediaId, tagId: nextTag.id },
    });
  }
}

async function main() {
  const items = (
    await prisma.mediaItem.findMany({
      where: {
        mediaType: "TV_SHOW",
        OR: [
          { releaseDate: null },
          { genres: { none: {} } },
          { tags: { none: {} } },
        ],
      },
      include: { genres: true, tags: true },
      orderBy: { title: "asc" },
    })
  ).slice(0, Number.isFinite(limit) ? limit : undefined);

  const stats = {
    scanned: items.length,
    matched: 0,
    updated: 0,
    releaseDates: 0,
    genres: 0,
    tags: 0,
    noMatch: 0,
    noUsefulData: 0,
  };

  for (const item of items) {
    const show = await searchShow(item.title);
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (!show) {
      stats.noMatch += 1;
      continue;
    }

    stats.matched += 1;
    const genres =
      item.genres.length === 0 ? [...new Set(show.genres.map(titleCase))] : [];
    const tags =
      item.tags.length === 0 ? [...new Set(show.genres.map(tag))] : [];
    const releaseDate =
      !item.releaseDate && show.premiered ? new Date(show.premiered) : null;

    if (!releaseDate && genres.length === 0 && tags.length === 0) {
      stats.noUsefulData += 1;
      continue;
    }

    if (!dryRun) {
      if (releaseDate) {
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: { releaseDate },
        });
      }
      await connectGenres(item.id, genres);
      await connectTags(item.id, tags);
    }

    stats.updated += 1;
    if (releaseDate) stats.releaseDates += 1;
    if (genres.length > 0) stats.genres += 1;
    if (tags.length > 0) stats.tags += 1;

    console.log(
      JSON.stringify({
        dryRun,
        title: item.title,
        source: show.url,
        releaseDate: releaseDate?.toISOString().slice(0, 10) ?? null,
        genres,
        tags,
      }),
    );
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
