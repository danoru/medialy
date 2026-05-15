import { MediaType, PrismaClient } from "@prisma/client";
import "dotenv/config";

type Args = {
  dryRun: boolean;
  limit: number | null;
  types: Set<MediaType>;
};

type MediaItemRow = {
  id: string;
  title: string;
  mediaType: MediaType;
  description: string | null;
  releaseDate: Date | null;
  posterUrl: string | null;
  externalUrl: string | null;
  metadataJson: string | null;
  genres: Array<{ genre: { name: string } }>;
  tags: Array<{ tag: { name: string } }>;
};

type MetadataMatch = {
  source: "tmdb" | "tvmaze" | "igdb" | "rawg";
  sourceId: string;
  title: string;
  description: string | null;
  releaseDate: Date | null;
  posterUrl: string | null;
  externalUrl: string | null;
  genres: string[];
  tags: string[];
  metadata: Record<string, unknown>;
};

type BackfillUpdate = {
  description?: string;
  releaseDate?: Date;
  posterUrl?: string;
  externalUrl?: string;
  metadataJson?: string;
};

const prisma = new PrismaClient();
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const supportedMediaTypes = new Set<MediaType>([
  MediaType.MOVIE,
  MediaType.TV_SHOW,
  MediaType.VIDEO_GAME,
]);

const tmdbGenreCache = new Map<"movie" | "tv", Map<number, string>>();
let twitchToken: string | null = null;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const items = await prisma.mediaItem.findMany({
    where: {
      mediaType: { in: [...args.types] },
      OR: [
        { description: null },
        { releaseDate: null },
        { posterUrl: null },
        { externalUrl: null },
        { metadataJson: null },
        { genres: { none: {} } },
        { tags: { none: {} } },
      ],
    },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
    },
    orderBy: [{ mediaType: "asc" }, { title: "asc" }],
    take: args.limit ?? undefined,
  });

  const stats = {
    scanned: items.length,
    matched: 0,
    updated: 0,
    noMatch: 0,
    noUsefulData: 0,
    fields: {
      description: 0,
      releaseDate: 0,
      posterUrl: 0,
      externalUrl: 0,
      metadataJson: 0,
      genres: 0,
      tags: 0,
    },
    sources: {
      tmdb: 0,
      tvmaze: 0,
      igdb: 0,
      rawg: 0,
    },
  };

  for (const item of items) {
    const match = await findMetadata(item);
    if (!match) {
      stats.noMatch += 1;
      console.log(
        JSON.stringify({
          dryRun: args.dryRun,
          status: "no_match",
          title: item.title,
          mediaType: item.mediaType,
        }),
      );
      continue;
    }

    stats.matched += 1;
    stats.sources[match.source] += 1;

    const update = buildBlankOnlyUpdate(item, match);
    const genres = item.genres.length === 0 ? normalizeNames(match.genres) : [];
    const tags =
      item.tags.length === 0 ? normalizeNames(match.tags).slice(0, 8) : [];

    if (
      Object.keys(update).length === 0 &&
      genres.length === 0 &&
      tags.length === 0
    ) {
      stats.noUsefulData += 1;
      continue;
    }

    if (!args.dryRun) {
      await prisma.$transaction(async (tx) => {
        if (Object.keys(update).length > 0) {
          await tx.mediaItem.update({
            where: { id: item.id },
            data: update,
          });
        }

        for (const name of genres) {
          const genre = await tx.genre.upsert({
            where: { name },
            update: {},
            create: { name },
          });
          await tx.mediaGenre.upsert({
            where: { mediaId_genreId: { mediaId: item.id, genreId: genre.id } },
            update: {},
            create: { mediaId: item.id, genreId: genre.id },
          });
        }

        for (const name of tags) {
          const normalizedName = normalizeTagKey(name);
          const tag = await tx.tag.upsert({
            where: { normalizedName },
            update: {},
            create: {
              name,
              normalizedName,
              status: "APPROVED",
              approvedAt: new Date(),
            },
          });
          await tx.mediaTag.upsert({
            where: { mediaId_tagId: { mediaId: item.id, tagId: tag.id } },
            update: {},
            create: { mediaId: item.id, tagId: tag.id },
          });
        }
      });
    }

    stats.updated += 1;
    if (update.description) stats.fields.description += 1;
    if (update.releaseDate) stats.fields.releaseDate += 1;
    if (update.posterUrl) stats.fields.posterUrl += 1;
    if (update.externalUrl) stats.fields.externalUrl += 1;
    if (update.metadataJson) stats.fields.metadataJson += 1;
    if (genres.length > 0) stats.fields.genres += 1;
    if (tags.length > 0) stats.fields.tags += 1;

    console.log(
      JSON.stringify({
        dryRun: args.dryRun,
        status: args.dryRun ? "would_update" : "updated",
        title: item.title,
        mediaType: item.mediaType,
        source: match.source,
        sourceId: match.sourceId,
        fields: Object.keys(update),
        genres,
        tags,
      }),
    );
  }

  console.error(JSON.stringify(stats, null, 2));
}

async function findMetadata(item: MediaItemRow): Promise<MetadataMatch | null> {
  if (item.mediaType === MediaType.MOVIE) {
    return findTmdb(item, "movie");
  }

  if (item.mediaType === MediaType.TV_SHOW) {
    return (await findTmdb(item, "tv")) ?? (await findTvmaze(item));
  }

  if (item.mediaType === MediaType.VIDEO_GAME) {
    return (await findIgdb(item)) ?? (await findRawg(item));
  }

  return null;
}

function buildBlankOnlyUpdate(
  item: MediaItemRow,
  match: MetadataMatch,
): BackfillUpdate {
  const update: BackfillUpdate = {};

  if (isBlank(item.description) && match.description) {
    update.description = match.description;
  }
  if (!item.releaseDate && match.releaseDate) {
    update.releaseDate = match.releaseDate;
  }
  if (isBlank(item.posterUrl) && match.posterUrl) {
    update.posterUrl = match.posterUrl;
  }
  if (isBlank(item.externalUrl) && match.externalUrl) {
    update.externalUrl = match.externalUrl;
  }
  if (isBlank(item.metadataJson)) {
    update.metadataJson = JSON.stringify({
      source: match.source,
      sourceId: match.sourceId,
      title: match.title,
      fetchedVia: "metadata:backfill",
      fetchedAt: new Date().toISOString(),
      payload: match.metadata,
    });
  }

  return update;
}

async function findTmdb(
  item: MediaItemRow,
  endpoint: "movie" | "tv",
): Promise<MetadataMatch | null> {
  if (!process.env.TMDB_BEARER_TOKEN) return null;

  let candidate: unknown = null;
  for (const query of titleSearchQueries(item.title)) {
    const search = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
    search.searchParams.set("query", query);
    search.searchParams.set("language", "en-US");
    search.searchParams.set("include_adult", "false");
    if (item.releaseDate) {
      const year = String(item.releaseDate.getUTCFullYear());
      search.searchParams.set(
        endpoint === "movie" ? "year" : "first_air_date_year",
        year,
      );
    }

    const json = await tmdbFetch(search);
    candidate = bestTitleMatch(arrayValue(recordValue(json).results), item);
    if (candidate) break;
  }
  if (!candidate) return null;

  const id = String(recordValue(candidate).id);
  const details = await tmdbFetch(
    new URL(`https://api.themoviedb.org/3/${endpoint}/${id}?language=en-US`),
  );
  const record = recordValue(details);
  const genreMap = await tmdbGenres(endpoint);
  const genreNames = arrayValue(record.genres).map((genre) =>
    stringValue(recordValue(genre).name),
  );
  const genreIds = arrayValue(record.genre_ids).map(numberValue);
  const genres = [
    ...genreNames,
    ...genreIds.map((genreId) =>
      genreId ? (genreMap.get(genreId) ?? null) : null,
    ),
  ].filter(isPresent);

  const title =
    endpoint === "movie"
      ? (stringValue(record.title) ?? item.title)
      : (stringValue(record.name) ?? item.title);
  const dateValue =
    endpoint === "movie" ? record.release_date : record.first_air_date;
  const posterPath = stringValue(record.poster_path);

  return {
    source: "tmdb",
    sourceId: id,
    title,
    description: stringValue(record.overview),
    releaseDate: parseDate(dateValue),
    posterUrl: posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null,
    externalUrl: `https://www.themoviedb.org/${endpoint}/${id}`,
    genres,
    tags: genres,
    metadata: record,
  };
}

async function findTvmaze(item: MediaItemRow): Promise<MetadataMatch | null> {
  let matches: unknown[] = [];
  for (const query of titleSearchQueries(item.title)) {
    const response = await fetch(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
      { headers: { "user-agent": "Medialy metadata backfill script" } },
    );
    if (!response.ok) return null;

    matches = arrayValue(await response.json())
      .map((entry) => recordValue(entry).show)
      .filter(
        (show) =>
          normalizeTitle(stringValue(recordValue(show).name) ?? "") ===
          normalizeTitle(item.title),
      );
    if (matches.length > 0) break;
  }
  if (matches.length !== 1) return null;

  const show = recordValue(matches[0]);
  const image = recordValue(show.image);
  const genres = arrayValue(show.genres).map(stringValue).filter(isPresent);

  return {
    source: "tvmaze",
    sourceId: String(show.id),
    title: stringValue(show.name) ?? item.title,
    description: stripHtml(show.summary),
    releaseDate: parseDate(show.premiered),
    posterUrl: stringValue(image.original) ?? stringValue(image.medium),
    externalUrl: stringValue(show.url),
    genres,
    tags: genres,
    metadata: show,
  };
}

async function findIgdb(item: MediaItemRow): Promise<MetadataMatch | null> {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    return null;
  }

  const token = await getTwitchToken();
  let candidate: unknown = null;
  for (const query of titleSearchQueries(item.title)) {
    const body = [
      "fields name,summary,url,first_release_date,genres.name,themes.name,cover.url;",
      `search "${query.replaceAll('"', '\\"')}";`,
      "limit 10;",
    ].join(" ");
    const json = await igdbFetch("games", body, token);
    candidate = bestTitleMatch(arrayValue(json), item);
    if (candidate) break;
  }
  if (!candidate) return null;

  const game = recordValue(candidate);
  const genres = arrayValue(game.genres)
    .map((genre) => stringValue(recordValue(genre).name))
    .filter(isPresent);
  const tags = arrayValue(game.themes)
    .map((theme) => stringValue(recordValue(theme).name))
    .filter(isPresent);

  return {
    source: "igdb",
    sourceId: String(game.id),
    title: stringValue(game.name) ?? item.title,
    description: stringValue(game.summary),
    releaseDate: parseUnixDate(game.first_release_date),
    posterUrl: coverUrl(game.cover),
    externalUrl: stringValue(game.url),
    genres,
    tags: tags.length > 0 ? tags : genres,
    metadata: game,
  };
}

async function findRawg(item: MediaItemRow): Promise<MetadataMatch | null> {
  if (!process.env.RAWG_API_KEY) return null;

  const url = new URL("https://api.rawg.io/api/games");
  url.searchParams.set("key", process.env.RAWG_API_KEY);
  let candidate: unknown = null;
  for (const query of titleSearchQueries(item.title)) {
    url.searchParams.set("search", query);
    url.searchParams.set("search_precise", "true");
    url.searchParams.set("page_size", "10");

    const response = await fetch(url);
    if (!response.ok) return null;
    const json = await response.json();
    candidate = bestTitleMatch(arrayValue(recordValue(json).results), item);
    if (candidate) break;
  }
  if (!candidate) return null;

  const game = recordValue(candidate);
  const genres = arrayValue(game.genres)
    .map((genre) => stringValue(recordValue(genre).name))
    .filter(isPresent);
  const tags = arrayValue(game.tags)
    .map((tag) => stringValue(recordValue(tag).name))
    .filter(isPresent);

  return {
    source: "rawg",
    sourceId: String(game.id),
    title: stringValue(game.name) ?? item.title,
    description: null,
    releaseDate: parseDate(game.released),
    posterUrl: stringValue(game.background_image),
    externalUrl: game.slug
      ? `https://rawg.io/games/${String(game.slug)}`
      : null,
    genres,
    tags: tags.length > 0 ? tags : genres,
    metadata: game,
  };
}

async function tmdbFetch(url: URL) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}` },
  });
  if (!response.ok) {
    throw new Error(
      `TMDB request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json() as Promise<unknown>;
}

async function tmdbGenres(endpoint: "movie" | "tv") {
  const cached = tmdbGenreCache.get(endpoint);
  if (cached) return cached;

  const url = new URL(`https://api.themoviedb.org/3/genre/${endpoint}/list`);
  url.searchParams.set("language", "en-US");
  const json = recordValue(await tmdbFetch(url));
  const map = new Map<number, string>();
  for (const genre of arrayValue(json.genres)) {
    const id = numberValue(recordValue(genre).id);
    const name = stringValue(recordValue(genre).name);
    if (id && name) map.set(id, name);
  }
  tmdbGenreCache.set(endpoint, map);
  return map;
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
  return response.json() as Promise<unknown>;
}

async function getTwitchToken() {
  if (twitchToken) return twitchToken;

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

  const json = recordValue(await response.json());
  twitchToken = stringValue(json.access_token);
  if (!twitchToken)
    throw new Error("Twitch auth did not return an access token.");
  return twitchToken;
}

function bestTitleMatch(candidates: unknown[], item: MediaItemRow) {
  const normalizedTitle = normalizeTitle(item.title);
  const exact = candidates.filter((candidate) => {
    const record = recordValue(candidate);
    const title =
      stringValue(record.title) ??
      stringValue(record.name) ??
      stringValue(record.original_title) ??
      stringValue(record.original_name);
    return normalizeTitle(title ?? "") === normalizedTitle;
  });

  if (exact.length === 0) return null;
  if (!item.releaseDate) return exact.length === 1 ? exact[0] : null;

  const releaseYear = item.releaseDate.getUTCFullYear();
  const sameYear = exact.filter((candidate) => {
    const record = recordValue(candidate);
    const date =
      parseDate(record.release_date) ??
      parseDate(record.first_air_date) ??
      parseDate(record.released) ??
      parseUnixDate(record.first_release_date);
    return date?.getUTCFullYear() === releaseYear;
  });

  if (sameYear.length === 1) return sameYear[0];
  return exact.length === 1 ? exact[0] : null;
}

function parseArgs(argv: string[]): Args {
  const types = parseMediaTypes(valueFor(argv, "--types") ?? "movie,tv,game");
  const limitValue = valueFor(argv, "--limit");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : null;
  if (limitValue && (limit === null || !Number.isFinite(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer.");
  }

  return {
    dryRun: argv.includes("--dry-run"),
    limit,
    types,
  };
}

function parseMediaTypes(value: string) {
  const aliases = new Map<string, MediaType>([
    ["movie", MediaType.MOVIE],
    ["movies", MediaType.MOVIE],
    ["tv", MediaType.TV_SHOW],
    ["show", MediaType.TV_SHOW],
    ["shows", MediaType.TV_SHOW],
    ["tv_show", MediaType.TV_SHOW],
    ["tv-shows", MediaType.TV_SHOW],
    ["game", MediaType.VIDEO_GAME],
    ["games", MediaType.VIDEO_GAME],
    ["video_game", MediaType.VIDEO_GAME],
    ["video-games", MediaType.VIDEO_GAME],
  ]);
  const parsed = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => aliases.get(entry))
    .filter(isPresent);
  const selected = new Set(
    parsed.filter((entry) => supportedMediaTypes.has(entry)),
  );

  if (selected.size === 0) {
    throw new Error(
      "No supported media types selected. Use --types=movie,tv,game.",
    );
  }
  return selected;
}

function valueFor(argv: string[], key: string) {
  const equalsArg = argv.find((arg) => arg.startsWith(`${key}=`));
  if (equalsArg) return equalsArg.split("=")[1];

  const index = argv.indexOf(key);
  return index >= 0 ? argv[index + 1] : undefined;
}

function normalizeNames(values: string[]) {
  return [
    ...new Set(
      values
        .map((value) => normalizeName(value))
        .filter((value) => value.length > 0),
    ),
  ];
}

function normalizeName(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["rpg", "mmo", "fps"].includes(lower)) return lower.toUpperCase();
      if (["and", "of", "the"].includes(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ")
    .replace(/\bSci Fi\b/g, "Science Fiction");
}

function normalizeTagKey(value: string) {
  return normalizeName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
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

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseDate(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseUnixDate(value: unknown) {
  const seconds = numberValue(value);
  return seconds ? new Date(seconds * 1000) : null;
}

function stripHtml(value: unknown) {
  const text = stringValue(value);
  return text ? text.replace(/<[^>]*>/g, "").trim() : null;
}

function coverUrl(value: unknown) {
  const url = stringValue(recordValue(value).url);
  return url ? `https:${url.replace("t_thumb", "t_cover_big")}` : null;
}

function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
