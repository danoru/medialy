import { ExternalReleaseSource, MediaType, PrismaClient } from "@prisma/client";
import {
  upsertReleaseCandidate,
  type ReleaseCandidateInput,
} from "../lib/release-candidates";

const prisma = new PrismaClient();

type Args = {
  types: Set<"movie" | "tv" | "game">;
  days: number;
  dryRun: boolean;
  limit: number;
};

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const from = startOfToday();
  const to = addDays(from, args.days);
  const candidates: ReleaseCandidateInput[] = [];

  if (args.dryRun) {
    candidates.push(...fixtureCandidates(from));
  } else {
    if (args.types.has("movie"))
      candidates.push(...(await fetchTmdbMovies(from, to, args.limit)));
    if (args.types.has("tv"))
      candidates.push(...(await fetchTmdbTv(from, to, args.limit)));
    if (args.types.has("game"))
      candidates.push(
        ...(await fetchIgdbGames(from, to, args.limit)),
        ...(await fetchRawgGames(from, to, args.limit)),
      );
  }

  const filtered = candidates
    .filter((candidate) => args.types.has(typeKey(candidate.mediaType)))
    .filter((candidate) => candidate.title.trim().length > 0)
    .slice(0, args.limit * args.types.size * 2);

  if (args.dryRun) {
    console.table(
      filtered.map((candidate) => ({
        type: candidate.mediaType,
        source: candidate.externalSource,
        title: candidate.title,
        date: candidate.releaseDate?.toISOString().slice(0, 10) ?? "-",
      })),
    );
    return;
  }

  let imported = 0;
  const statusCounts = new Map<string, number>();
  for (const candidate of filtered) {
    const releaseCandidate = await upsertReleaseCandidate(candidate);
    statusCounts.set(
      releaseCandidate.status,
      (statusCounts.get(releaseCandidate.status) ?? 0) + 1,
    );
    imported += 1;
  }

  console.log(`Upserted ${imported} release candidates.`);
  console.table(
    [...statusCounts.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([status, count]) => ({ status, count })),
  );
}

async function fetchTmdbMovies(from: Date, to: Date, limit: number) {
  if (!process.env.TMDB_BEARER_TOKEN) {
    logSkippedSource("TMDB movies", "TMDB_BEARER_TOKEN is not set");
    return [];
  }
  const url = new URL("https://api.themoviedb.org/3/discover/movie");
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("include_video", "false");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("region", "US");
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("primary_release_date.gte", isoDate(from));
  url.searchParams.set("primary_release_date.lte", isoDate(to));
  url.searchParams.set("page", "1");

  const json = await tmdbFetch(url);
  return array(json.results)
    .slice(0, limit)
    .map(
      (movie) =>
        ({
          mediaType: MediaType.MOVIE,
          title: String(movie.title ?? movie.original_title ?? ""),
          externalSource: ExternalReleaseSource.TMDB,
          externalId: String(movie.id),
          externalUrl: `https://www.themoviedb.org/movie/${movie.id}`,
          description: movie.overview ? String(movie.overview) : null,
          posterUrl: movie.poster_path
            ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
            : null,
          releaseDate: parseDate(movie.release_date),
          genres: [],
          tags: movie.original_language
            ? [`language:${movie.original_language}`]
            : [],
          metadata: movie,
          sourceSignals: {
            popularity: numberValue(movie.popularity),
            voteAverage: numberValue(movie.vote_average),
            voteCount: numberValue(movie.vote_count),
          },
        }) satisfies ReleaseCandidateInput,
    );
}

async function fetchTmdbTv(from: Date, to: Date, limit: number) {
  if (!process.env.TMDB_BEARER_TOKEN) {
    logSkippedSource("TMDB TV", "TMDB_BEARER_TOKEN is not set");
    return [];
  }
  const url = new URL("https://api.themoviedb.org/3/discover/tv");
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("include_null_first_air_dates", "false");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("first_air_date.gte", isoDate(from));
  url.searchParams.set("first_air_date.lte", isoDate(to));
  url.searchParams.set("page", "1");

  const json = await tmdbFetch(url);
  return array(json.results)
    .slice(0, limit)
    .map(
      (show) =>
        ({
          mediaType: MediaType.TV_SHOW,
          title: String(show.name ?? show.original_name ?? ""),
          externalSource: ExternalReleaseSource.TMDB,
          externalId: `tv-${show.id}`,
          externalUrl: `https://www.themoviedb.org/tv/${show.id}`,
          description: show.overview ? String(show.overview) : null,
          posterUrl: show.poster_path
            ? `${TMDB_IMAGE_BASE}${show.poster_path}`
            : null,
          releaseDate: parseDate(show.first_air_date),
          genres: [],
          tags: show.original_language
            ? [`language:${show.original_language}`]
            : [],
          metadata: show,
          sourceSignals: {
            popularity: numberValue(show.popularity),
            voteAverage: numberValue(show.vote_average),
            voteCount: numberValue(show.vote_count),
          },
        }) satisfies ReleaseCandidateInput,
    );
}

async function fetchIgdbGames(from: Date, to: Date, limit: number) {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    logSkippedSource(
      "IGDB games",
      "TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET is not set",
    );
    return [];
  }
  const token = await getTwitchToken();
  const body = [
    "fields name,summary,url,first_release_date,hypes,follows,total_rating,total_rating_count,genres.name,themes.name,involved_companies.company.name,cover.url,platforms.name;",
    `where first_release_date >= ${unixSeconds(from)} & first_release_date <= ${unixSeconds(to)} & category = 0;`,
    "sort hypes desc;",
    `limit ${limit};`,
  ].join(" ");

  const json = await igdbFetch("games", body, token);
  return array(json).map(
    (game) =>
      ({
        mediaType: MediaType.VIDEO_GAME,
        title: String(game.name ?? ""),
        externalSource: ExternalReleaseSource.IGDB,
        externalId: String(game.id),
        externalUrl: game.url ? String(game.url) : null,
        description: game.summary ? String(game.summary) : null,
        posterUrl: coverUrl(game.cover),
        releaseDate: parseUnixDate(game.first_release_date),
        genres: array(game.genres)
          .map((genre) => String(genre.name))
          .filter(Boolean),
        tags: array(game.themes)
          .map((theme) => String(theme.name))
          .filter(Boolean),
        companies: array(game.involved_companies)
          .map((entry) => String(recordValue(entry.company).name))
          .filter(Boolean),
        platforms: array(game.platforms)
          .map((platform) => String(platform.name))
          .filter(Boolean),
        metadata: game,
        sourceSignals: {
          hypes: numberValue(game.hypes),
          follows: numberValue(game.follows),
          rating: numberValue(game.total_rating),
          voteCount: numberValue(game.total_rating_count),
        },
      }) satisfies ReleaseCandidateInput,
  );
}

async function fetchRawgGames(from: Date, to: Date, limit: number) {
  if (!process.env.RAWG_API_KEY) {
    logSkippedSource("RAWG games", "RAWG_API_KEY is not set");
    return [];
  }
  const url = new URL("https://api.rawg.io/api/games");
  url.searchParams.set("key", process.env.RAWG_API_KEY);
  url.searchParams.set("dates", `${isoDate(from)},${isoDate(to)}`);
  url.searchParams.set("ordering", "-added");
  url.searchParams.set("page_size", String(limit));

  const response = await fetch(url);
  if (!response.ok) return [];
  const json = await response.json();
  return array(json.results).map(
    (game) =>
      ({
        mediaType: MediaType.VIDEO_GAME,
        title: String(game.name ?? ""),
        externalSource: ExternalReleaseSource.RAWG,
        externalId: String(game.id),
        externalUrl: `https://rawg.io/games/${game.slug ?? game.id}`,
        posterUrl: game.background_image ? String(game.background_image) : null,
        releaseDate: parseDate(game.released),
        genres: array(game.genres)
          .map((genre) => String(genre.name))
          .filter(Boolean),
        tags: array(game.tags)
          .slice(0, 8)
          .map((tag) => String(tag.name))
          .filter(Boolean),
        platforms: array(game.platforms)
          .map((entry) => String(recordValue(entry.platform).name))
          .filter(Boolean),
        metadata: game,
        sourceSignals: {
          popularity: numberValue(game.added),
          rating: numberValue(game.rating),
          voteCount: numberValue(game.ratings_count),
        },
      }) satisfies ReleaseCandidateInput,
  );
}

async function tmdbFetch(url: URL) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}` },
  });
  if (!response.ok)
    throw new Error(
      `TMDB request failed: ${response.status} ${response.statusText}`,
    );
  return response.json();
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
  if (!response.ok)
    throw new Error(
      `IGDB request failed: ${response.status} ${response.statusText}`,
    );
  return response.json();
}

async function getTwitchToken() {
  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", process.env.TWITCH_CLIENT_ID ?? "");
  url.searchParams.set("client_secret", process.env.TWITCH_CLIENT_SECRET ?? "");
  url.searchParams.set("grant_type", "client_credentials");
  const response = await fetch(url, { method: "POST" });
  if (!response.ok)
    throw new Error(
      `Twitch auth failed: ${response.status} ${response.statusText}`,
    );
  const json = await response.json();
  return String(json.access_token);
}

function fixtureCandidates(from: Date): ReleaseCandidateInput[] {
  return [
    {
      mediaType: MediaType.MOVIE,
      title: "Example Festival Breakout",
      externalSource: ExternalReleaseSource.TMDB,
      externalId: "dry-run-movie-1",
      releaseDate: addDays(from, 42),
      genres: ["Drama"],
      tags: ["language:en"],
      sourceSignals: { popularity: 18, voteCount: 40, voteAverage: 7.6 },
    },
    {
      mediaType: MediaType.TV_SHOW,
      title: "Example Returning Series",
      externalSource: ExternalReleaseSource.TVMAZE,
      externalId: "dry-run-tv-1",
      releaseDate: addDays(from, 12),
      genres: ["Science-Fiction"],
      tags: ["Scripted"],
      sourceSignals: { popularity: 72, rating: 8.1 },
    },
    {
      mediaType: MediaType.VIDEO_GAME,
      title: "Example Indie Adventure",
      externalSource: ExternalReleaseSource.IGDB,
      externalId: "dry-run-game-1",
      releaseDate: addDays(from, 88),
      genres: ["Adventure"],
      tags: ["Indie"],
      companies: ["Small Studio"],
      sourceSignals: { hypes: 22, follows: 120, rating: 8.3 },
    },
  ];
}

function parseArgs(argv: string[]): Args {
  const typesArg = valueFor(argv, "--types") ?? "movie,tv,game";
  return {
    types: new Set(
      typesArg
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean) as Array<"movie" | "tv" | "game">,
    ),
    days: Number(valueFor(argv, "--days") ?? 180),
    dryRun: argv.includes("--dry-run"),
    limit: Number(valueFor(argv, "--limit") ?? 40),
  };
}

function valueFor(argv: string[], key: string) {
  const index = argv.indexOf(key);
  return index >= 0 ? argv[index + 1] : undefined;
}

function typeKey(mediaType: MediaType) {
  if (mediaType === MediaType.MOVIE) return "movie";
  if (mediaType === MediaType.TV_SHOW) return "tv";
  return "game";
}

function array(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function numberValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseUnixDate(value: unknown) {
  const seconds = numberValue(value);
  return seconds ? new Date(seconds * 1000) : null;
}

function stripHtml(value: unknown) {
  return value
    ? String(value)
        .replace(/<[^>]*>/g, "")
        .trim()
    : null;
}

function coverUrl(value: unknown) {
  const cover = recordValue(value);
  return cover.url
    ? `https:${String(cover.url).replace("t_thumb", "t_cover_big")}`
    : null;
}

function startOfToday() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function unixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

function logSkippedSource(source: string, reason: string) {
  console.warn(`Skipped ${source}: ${reason}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
