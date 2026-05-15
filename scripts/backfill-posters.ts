import { MediaType, PrismaClient } from "@prisma/client";
import "dotenv/config";

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
  source: "metadata" | "tmdb" | "tvmaze" | "igdb" | "rawg";
};

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const overwrite = process.argv.includes("--overwrite");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg
  ? Number.parseInt(limitArg.split("=")[1] ?? "", 10)
  : null;
const mediaTypes = parseMediaTypes(process.argv.slice(2));

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

async function main() {
  const items = await prisma.mediaItem.findMany({
    where: {
      ...(overwrite ? {} : { posterUrl: null }),
      ...(mediaTypes ? { mediaType: { in: [...mediaTypes] } } : {}),
    },
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

  const rows = Number.isFinite(limit)
    ? items.slice(0, limit ?? undefined)
    : items;
  const stats = {
    scanned: rows.length,
    updated: 0,
    skipped: 0,
    unresolved: 0,
    metadata: 0,
    tmdb: 0,
    tvmaze: 0,
    igdb: 0,
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
  if (!(overwrite && item.mediaType === MediaType.VIDEO_GAME)) {
    const fromMetadata = posterFromMetadata(item.metadataJson);
    if (fromMetadata) return fromMetadata;
  }

  if (
    item.mediaType === MediaType.MOVIE ||
    item.mediaType === MediaType.TV_SHOW
  ) {
    const fromTmdb = await posterFromTmdb(item);
    if (fromTmdb) return fromTmdb;
  }

  if (item.mediaType === MediaType.TV_SHOW) {
    const fromTvmaze = await posterFromTvmaze(item);
    if (fromTvmaze) return fromTvmaze;
  }

  if (item.mediaType === MediaType.VIDEO_GAME) {
    const fromIgdb = await posterFromIgdb(item);
    if (fromIgdb) return fromIgdb;

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
    if (
      releaseCandidate.source &&
      typeof releaseCandidate.source === "object"
    ) {
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
  const endpoint = item.mediaType === MediaType.MOVIE ? "movie" : "tv";

  if (id) {
    const json = await tmdbFetch(
      `https://api.themoviedb.org/3/${endpoint}/${id}`,
    );
    const posterPath = stringValue(json.poster_path);
    if (posterPath) {
      return { posterUrl: `${TMDB_IMAGE_BASE}${posterPath}`, source: "tmdb" };
    }
  }

  let candidate: unknown = null;
  for (const query of titleSearchQueries(item.title)) {
    const search = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
    search.searchParams.set("query", query);
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
    candidate = arrayValue(json.results).find(
      (entry) =>
        normalizeTitle(
          stringValue(recordValue(entry).title ?? recordValue(entry).name) ??
            "",
        ) === normalizeTitle(item.title),
    );
    if (candidate) break;
  }
  const posterPath = candidate
    ? stringValue(recordValue(candidate).poster_path)
    : null;
  if (!posterPath) return null;
  return { posterUrl: `${TMDB_IMAGE_BASE}${posterPath}`, source: "tmdb" };
}

async function posterFromTvmaze(
  item: MediaItemRow,
): Promise<PosterMatch | null> {
  const normalizedTitle = normalizeTitle(item.title);
  let matches: unknown[] = [];
  for (const query of titleSearchQueries(item.title)) {
    const response = await fetch(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
      { headers: { "user-agent": "Medialy poster backfill script" } },
    );
    if (!response.ok) return null;

    matches = arrayValue(await response.json())
      .map((entry) => recordValue(entry).show)
      .filter(
        (show) =>
          show &&
          typeof show === "object" &&
          normalizeTitle(
            stringValue((show as Record<string, unknown>).name ?? "") ?? "",
          ) === normalizedTitle,
      );
    if (matches.length > 0) break;
  }

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

  const normalizedTitle = normalizeTitle(item.title);
  let matches: unknown[] = [];
  for (const query of titleSearchQueries(item.title)) {
    const url = new URL("https://api.rawg.io/api/games");
    url.searchParams.set("key", process.env.RAWG_API_KEY);
    url.searchParams.set("search", query);
    url.searchParams.set("search_precise", "true");
    url.searchParams.set("page_size", "10");

    const response = await fetch(url);
    if (!response.ok) return null;

    const json = await response.json();
    matches = arrayValue(recordValue(json).results)
      .map((entry) => entry)
      .filter(
        (game) =>
          game &&
          typeof game === "object" &&
          normalizeTitle(
            stringValue((game as Record<string, unknown>).name ?? "") ?? "",
          ) === normalizedTitle,
      );
    if (matches.length > 0) break;
  }

  if (matches.length !== 1) return null;
  const game = matches[0] as Record<string, unknown>;
  const posterUrl = cleanUrl(game.background_image);
  return posterUrl ? { posterUrl, source: "rawg" } : null;
}

async function posterFromIgdb(item: MediaItemRow): Promise<PosterMatch | null> {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    return null;
  }

  const token = await getTwitchToken();
  const normalizedTitle = normalizeTitle(item.title);
  let matches: unknown[] = [];
  for (const query of titleSearchQueries(item.title)) {
    const title = query.replaceAll('"', '\\"');
    const body = [
      "fields name,first_release_date,cover.url;",
      `search "${title}";`,
      "limit 10;",
    ].join(" ");

    const json = await igdbFetch("games", body, token);
    matches = arrayValue(json).filter(
      (game) =>
        game &&
        typeof game === "object" &&
        recordValue((game as Record<string, unknown>).cover).url &&
        normalizeTitle(
          stringValue((game as Record<string, unknown>).name ?? "") ?? "",
        ) === normalizedTitle,
    );
    if (matches.length > 0) break;
  }

  const match = bestDatedMatch(matches, item.releaseDate);
  if (!match) return null;

  const cover = recordValue(recordValue(match).cover);
  const posterUrl = cleanUrl(cover.url);
  return posterUrl
    ? { posterUrl: posterUrl.replace("t_thumb", "t_cover_big"), source: "igdb" }
    : null;
}

async function igdbFetch(endpoint: string, body: string, token: string) {
  const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "client-id": process.env.TWITCH_CLIENT_ID ?? "",
      authorization: `Bearer ${token}`,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(
      `IGDB request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

async function getTwitchToken() {
  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", process.env.TWITCH_CLIENT_ID ?? "");
  url.searchParams.set("client_secret", process.env.TWITCH_CLIENT_SECRET ?? "");
  url.searchParams.set("grant_type", "client_credentials");
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    throw new Error(
      `Twitch auth failed: ${response.status} ${response.statusText}`,
    );
  }
  const json = await response.json();
  return String(json.access_token);
}

async function tmdbFetch(url: string) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}` },
  });
  if (!response.ok) {
    throw new Error(
      `TMDB request failed: ${response.status} ${response.statusText}`,
    );
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
  return foldDiacritics(value)
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleSearchQueries(value: string) {
  const folded = foldDiacritics(value);
  return [...new Set([value, folded].map((entry) => entry.trim()))].filter(
    Boolean,
  );
}

function foldDiacritics(value: string) {
  return [...value]
    .map((character) => foldedCharacterMap.get(character) ?? character)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

const foldedCharacterMap = new Map([
  ["ß", "ss"],
  ["æ", "ae"],
  ["Æ", "AE"],
  ["œ", "oe"],
  ["Œ", "OE"],
  ["ø", "o"],
  ["Ø", "O"],
  ["đ", "d"],
  ["Đ", "D"],
  ["ł", "l"],
  ["Ł", "L"],
]);

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

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function bestDatedMatch(
  matches: unknown[],
  releaseDate: Date | null,
): Record<string, unknown> | null {
  if (matches.length === 0) return null;
  if (!releaseDate) return recordValue(matches[0]);

  const releaseYear = releaseDate.getUTCFullYear();
  const sameYear = matches.find((match) => {
    const seconds = Number(recordValue(match).first_release_date);
    if (!Number.isFinite(seconds)) return false;
    return new Date(seconds * 1000).getUTCFullYear() === releaseYear;
  });

  return recordValue(sameYear ?? matches[0]);
}

function parseMediaTypes(argv: string[]) {
  const rawValues = argv.flatMap((arg, index) => {
    if (arg === "--game" || arg === "--games" || arg === "-game") {
      return ["game"];
    }
    if (arg === "--movie" || arg === "--movies") {
      return ["movie"];
    }
    if (arg === "--tv" || arg === "--show" || arg === "--shows") {
      return ["tv"];
    }
    if (arg === "--type" || arg === "--types") {
      return argv[index + 1] ? [argv[index + 1]] : [];
    }
    if (arg.startsWith("--type=")) {
      return [arg.split("=")[1] ?? ""];
    }
    if (arg.startsWith("--types=")) {
      return [arg.split("=")[1] ?? ""];
    }
    return [];
  });

  const parsed = rawValues
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .map((value) => {
      if (["game", "games", "video_game", "video-game"].includes(value)) {
        return MediaType.VIDEO_GAME;
      }
      if (["movie", "movies"].includes(value)) return MediaType.MOVIE;
      if (["tv", "tv_show", "tv-show", "show", "shows"].includes(value)) {
        return MediaType.TV_SHOW;
      }
      throw new Error(`Invalid media type filter: ${value}`);
    });

  return parsed.length > 0 ? new Set(parsed) : null;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
