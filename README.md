# Medialy

Medialy is a local-first media library and recommendation dashboard for tracking movies, TV, games, books, music, watchlists, rankings, friend signals, imports, exports, and upcoming releases.

## Stack

- Next.js App Router
- React and Material UI
- Prisma with PostgreSQL
- Vitest and ESLint

## Getting Started

```bash
npm install
npm run db:setup
npm run dev
```

Copy `.env.example` to `.env` before running database commands. `DATABASE_URL`
and `DIRECT_URL` must point to a PostgreSQL database.

## Useful Scripts

```bash
npm run lint
npm test
npm run build
npm run db:setup
npm run db:import:sqlite
npm run prisma:deploy
npm run candidates:fetch
npm run upcoming:fetch
npm run posters:backfill
```

## Deployment Notes

This project is configured for Vercel with PostgreSQL. Create a Vercel Postgres,
Neon, Supabase, or other hosted PostgreSQL database, then set these Vercel
environment variables for Production, Preview, and Development:

- `DATABASE_URL`: pooled PostgreSQL connection string used by the app.
- `DIRECT_URL`: direct PostgreSQL connection string used by Prisma migrations.

Vercel uses `pnpm vercel-build`, which runs `prisma migrate deploy`,
`prisma generate`, and `next build`. The first deployment against an empty
database creates the tables automatically.

To copy an existing local SQLite database into Postgres:

```bash
npm run prisma:deploy
npm run db:import:sqlite
```

The import reads `prisma/dev.db` by default. Pass another SQLite path after
`--`, for example `npm run db:import:sqlite -- prisma/backup.db`. If the
Postgres database already contains rows, the import stops; add `--force` to
clear existing app tables first.

External API keys are optional and should be configured through environment variables:

- `TMDB_BEARER_TOKEN`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `RAWG_API_KEY`

## Discovery Candidates

Fetch external movie, TV, and game candidates into the review queue with:

```bash
pnpm candidates:fetch -- --mode=popular --types=movie,tv,game --limit=40
pnpm candidates:fetch -- --mode=top-rated --types=movie,tv,game --limit=40
pnpm candidates:fetch -- --mode=upcoming --types=movie,tv,game --days=180
```

Use `--dry-run` to preview rows without writing to the database. Candidates are
deduped against existing media, scored, and staged on the Upcoming page before
they enter recommendations. `upcoming:fetch` remains as an alias for the same
pipeline.

## Poster Backfill

Backfill missing poster URLs with:

```bash
pnpm posters:backfill
```

By default this only updates items where `posterUrl` is empty. Add
`--overwrite` to replace existing poster URLs, and use `--dry-run` to preview
matches without writing to the database.

For game posters, set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` in `.env`
to prefer IGDB cover art. Set `RAWG_API_KEY` to use RAWG as a fallback. Then
run:

```bash
pnpm posters:backfill -- --type=game --dry-run
pnpm posters:backfill -- --type=game
```

To replace existing game images with IGDB covers, falling back to RAWG only when
IGDB has no cover:

```bash
pnpm posters:backfill -- --type=game --overwrite --dry-run
pnpm posters:backfill -- --type=game --overwrite
```

The poster backfill script also accepts `--type=movie`, `--type=tv`,
comma-separated values such as `--types=movie,tv,game`, and shorthand flags
such as `--game`. The older `-game` form is also accepted for game posters.
Limit a test run with `--limit=20`.
