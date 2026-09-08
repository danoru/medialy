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
npm run ratings:fetch
npm run opencritic:fetch
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

External API keys are optional and should be configured through environment
variables. Which ones you need depends on where the code runs:

**Needed by the deployed app** (set these in Vercel, or "Add media" search
returns nothing for that media type):

- `TMDB_BEARER_TOKEN` — movie and TV search.
- `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` — game search via IGDB, which is
  preferred for its cover art and plain-text summaries.
- `RAWG_API_KEY` — game search fallback when IGDB is unavailable.

**Needed only locally**, by the backfill and discovery scripts: the same four
keys. There are no Vercel cron jobs, so those scripts never run in production.

Note that Vercel only picks up a new environment variable on the _next_
deployment, and that each variable is scoped per environment (Production /
Preview / Development). A search that quietly returns no results is far more
often a missing key than a missing title — the UI now says so explicitly
instead of suggesting you check the spelling.

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

## Data Safety

The rule is that automated work never overwrites data a person entered. In
practice:

- **Backfill and enrichment scripts fill blanks only.** They write a field only
  when it is empty. When a source disagrees with data already on an item, the
  script changes nothing and files a PENDING `MediaEditSuggestion` instead, which
  shows up in `/admin/edits` with a before/after diff to accept or reject. Items
  with unresolved suggestions also show a "suggested changes" callout on their
  detail page for admins.
- **A blank score field means "leave it alone", not "delete it".** Removing a
  Metacritic / OpenCritic / Rotten Tomatoes score is an explicit checkbox on the
  edit form. This matters because approving an older edit suggestion replays a
  full snapshot: before, a snapshot that predated a fetched score would silently
  drop it.
- **Imports fill blanks too.** Re-importing a Letterboxd CSV with no description
  will not clear the description you wrote, and genres/tags/credits are merged
  additively into existing items rather than replacing them.

Two commands _are_ destructive by design, and both say so before acting:

```bash
npm run tags:cleanup            # deletes non-canonical tags (dry-run by default)
npm run db:import:sqlite -- --force --confirm=DELETE-ALL-POSTGRES-DATA
```

`db:import:sqlite --force` deletes **every app table** and replaces it with the
contents of a SQLite file, so anything entered since that snapshot is gone. It
refuses to run on a populated database without the explicit `--confirm` phrase,
and prints the row counts it would destroy first.

## External Ratings

Metacritic and OpenCritic scores are both sourced from Wikidata, so neither
needs an API key:

```bash
npm run ratings:fetch -- --dry-run     # Metacritic (movies, TV, games)
npm run opencritic:fetch -- --dry-run  # OpenCritic (games only)
```

Drop `--dry-run` to write, and pass `--limit=50` to cap a run. Both scripts
fill blanks only: they select just the items with no rating from that source,
and never update or delete an existing one, so hand-entered scores and curated
corrections survive a re-run.

OpenCritic publishes two numbers per game — a Top Critic Average (`89/100`) and
a Critics Recommend percentage (`60%`). Only the former is a quality score
comparable to Metacritic, and it is the only one this script stores.

`opencritic:fetch` fills a missing score directly. When a game already has an
OpenCritic score and the fetched one disagrees, it leaves the existing score
alone and files the difference to `/admin/edits` for review.

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
