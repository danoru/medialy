import { MediaType, PrismaClient } from "@prisma/client";

type MediaItemRow = {
  id: string;
  title: string;
  mediaType: MediaType;
  releaseDate: Date | null;
  externalUrl: string | null;
  metadataJson: string | null;
};

type PosterMatch = {
  posterUrl: string;
  source: "metadata" | "tmdb" | "tvmaze" | "rawg";
};

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const overwrite = process.argv.includes("--overwrite");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg
  ? Number.parseInt(limitArg.split("=")[1] ?? "", 10)
  : null;

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

async function main() {
  const items = await prisma.mediaItem.findMany({
    where: overwrite ? {} : { posterUrl: null },
    select: {
      id: true,
      title: true,
      mediaType: true,
      releaseDate: true,
      externalUrl: true,
      metadataJson: true,
    },
    orderBy: [{ mediaType: "asc" }, { title: "asc" }],
  });

  const rows = Number.isFinite(limit) ? items.slice(0, limit ?? undefined) : items;
  const stats = {
    scanned: rows.length,
    updated: 0,
    skipped: 0,
    unresolved: 0,
    metadata: 0,
    tmdb: 0,
    tvmaze: 0,
    rawg: 0,
  };

  for (const item of rows) {
    const poster = await resolvePoster(item);

    if (!poster) {
      stats.unresolved += 1;
      console.log(
        JSON.stringify({
          dryRun,
          title: item.title,
          mediaType: item.mediaType,
          status: "skipped",
        }),
      );
      continue;
    }

    if (!dryRun) {
      await prisma.mediaItem.update({
        where: { id: item.id },
        data: { posterUrl: poster.posterUrl },
      });
    }

    stats.updated += 1;
    stats[poster.source] += 1;
    console.log(
      JSON.stringify({
        dryRun,
        title: item.title,
        mediaType: item.mediaType,
        source: poster.source,
        posterUrl: poster.posterUrl,
      }),
    );
  }

  console.error(JSON.stringify(stats, null, 2));
}

async function resolvePoster(item: MediaItemRow): Promise<PosterMatch | null> {
  const fromMetadata = posterFromMetadata(item.metadataJson);
  if (fromMetadata) return fromMetadata;

  if (item.mediaType === MediaType.MOVIE || item.mediaType === MediaType.TV_SHOW) {
    const fromTmdb = await posterFromTmdb(item);
    if (fromTmdb) return fromTmdb;
  }

  if (item.mediaType === MediaType.TV_SHOW) {
    const fromTvmaze = await posterFromTvmaze(item);
    if (fromTvmaze) return fromTvmaze;
  }

  if (item.mediaType === MediaType.VIDEO_GAME) {
    const fromRawg = await posterFromRawg(item);
    if (fromRawg) return fromRawg;
  }

  return null;
}

function posterFromMetadata(metadataJson: string | null): PosterMatch | null {
  const parsed = parseJson(metadataJson);
  const sources = collectPosterSources(parsed);

  for (const source of sources) {
    const posterUrl = posterFromObject(source);
    if (posterUrl) return { posterUrl, source: "metadata" };
  }

  return null;
}

function collectPosterSources(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];

  const sources: unknown[] = [value];
  const record = value as Record<string, unknown>;

  if (record.source && typeof record.source === "object") {
    sources.push(record.source);
  }

  if (record.releaseCandidate && typeof record.releaseCandidate === "object") {
    const releaseCandidate = record.releaseCandidate as Record<string, unknown>;
    if (releaseCandidate.source && typeof releaseCandidate.source === "object") {
      sources.push(releaseCandidate.source);
    }
  }

  return sources;
}

function posterFromObject(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;

  for (const key of ["posterUrl", "poster_url", "background_image"]) {
    const url = cleanUrl(record[key]);
    if (url) return url;
  }

  const posterPath = record.poster_path;
  if (typeof posterPath === "string" && posterPath) {
    return `${TMDB_IMAGE_BASE}${posterPath}`;
  }

  const image = record.image;
  if (image && typeof image === "object") {
    const imageRecord = image as Record<string, unknown>;
    for (const key of ["original", "medium", "large"]) {
      const url = cleanUrl(imageRecord[key]);
      if (url) return url;
    }
  }

  const cover = record.cover;
  if (cover && typeof cover === "object") {
    const coverRecord = cover as Record<string, unknown>;
    const coverUrl = cleanUrl(coverRecord.url);
    if (coverUrl) {
      return coverUrl.replace("t_thumb", "t_cover_big");
    }
  }

  return null;
}

async function posterFromTmdb(item: MediaItemRow): Promise<PosterMatch | null> {
  if (!process.env.TMDB_BEARER_TOKEN) return null;

  const parsed = parseUrl(item.externalUrl);
  const id = tmdbIdFromUrl(parsed);
  const endpoint =
    item.mediaType === MediaType.MOVIE ? "movie" : "tv";

  if (id) {
    const json = await tmdbFetch(`https://api.themoviedb.org/3/${endpoint}/${id}`);
    const posterPath = stringValue(json.poster_path);
    if (posterPath) {
      return { posterUrl: `${TMDB_IMAGE_BASE}${posterPath}`, source: "tmdb" };
    }
  }

  const search = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
  search.searchParams.set("query", item.title);
  search.searchParams.set("language", "en-US");
  search.searchParams.set("include_adult", "false");
  if (item.releaseDate) {
    const year = item.releaseDate.getUTCFullYear();
    if (Number.isFinite(year)) {
      if (endpoint === "movie") {
        search.searchParams.set("year", String(year));
      } else {
        search.searchParams.set("first_air_date_year", String(year));
      }
    }
  }

  const json = await tmdbFetch(search.toString());
  const candidate = arrayValue(json.results).find((entry) =>
    normalizeTitle(stringValue(entry.title ?? entry.name ?? "") ?? "") ===
    normalizeTitle(item.title),
  );
  const posterPath = candidate ? stringValue(candidate.poster_path) : null;
  if (!posterPath) return null;
  return { posterUrl: `${TMDB_IMAGE_BASE}${posterPath}`, source: "tmdb" };
}

async function posterFromTvmaze(item: MediaItemRow): Promise<PosterMatch | null> {
  const response = await fetch(
    `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(item.title)}`,
    { headers: { "user-agent": "Medialy poster backfill script" } },
  );
  if (!response.ok) return null;

  const normalizedTitle = normalizeTitle(item.title);
  const matches = arrayValue(await response.json())
    .map((entry) => entry?.show)
    .filter(
      (show) =>
        show &&
        typeof show === "object" &&
        normalizeTitle(
          stringValue((show as Record<string, unknown>).name ?? "") ?? "",
        ) ===
          normalizedTitle,
    );

  if (matches.length !== 1) return null;
  const show = matches[0] as Record<string, unknown>;
  const image = show.image;
  if (!image || typeof image !== "object") return null;
  const original = cleanUrl((image as Record<string, unknown>).original);
  const medium = cleanUrl((image as Record<string, unknown>).medium);
  const posterUrl = original ?? medium;
  return posterUrl ? { posterUrl, source: "tvmaze" } : null;
}

async function posterFromRawg(item: MediaItemRow): Promise<PosterMatch | null> {
  if (!process.env.RAWG_API_KEY) return null;

  const url = new URL("https://api.rawg.io/api/games");
  url.searchParams.set("key", process.env.RAWG_API_KEY);
  url.searchParams.set("search", item.title);
  url.searchParams.set("page_size", "10");

  const response = await fetch(url);
  if (!response.ok) return null;

  const normalizedTitle = normalizeTitle(item.title);
  const matches = arrayValue(await response.json())
    .map((entry) => entry)
    .filter(
      (game) =>
        game &&
        typeof game === "object" &&
        normalizeTitle(
          stringValue((game as Record<string, unknown>).name ?? "") ?? "",
        ) ===
          normalizedTitle,
    );

  if (matches.length !== 1) return null;
  const game = matches[0] as Record<string, unknown>;
  const posterUrl = cleanUrl(game.background_image);
  return posterUrl ? { posterUrl, source: "rawg" } : null;
}

async function tmdbFetch(url: string) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}` },
  });
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function tmdbIdFromUrl(url: URL | null) {
  if (!url) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const index = parts.findIndex((part) => part === "movie" || part === "tv");
  if (index < 0 || !parts[index + 1]) return null;
  return parts[index + 1];
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseJson(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseUrl(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function cleanUrl(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
