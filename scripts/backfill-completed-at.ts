/**
 * One-off backfill for `UserMedia.completedAt`.
 *
 * Historical Letterboxd imports stashed the diary date on the shared
 * `MediaItem.metadataJson` as `{ "letterboxd": { "addedDate": "YYYY-MM-DD" } }`.
 * Because `MediaItem` rows are shared across users, that date only belongs to
 * the user who actually imported it — so this script is scoped to a single
 * `--user` and never touches `MediaItem`.
 *
 * Fills blanks only: rows that already have a `completedAt` or that were
 * explicitly marked `completedAtUnsure` are left alone. Dry run by default;
 * pass `--apply` to write.
 *
 * Usage:
 *   pnpm run completed-at:backfill -- --user <userId> [--apply] [--limit <n>]
 */
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { parseCompletedAtInput } from "../lib/completion";

const prisma = new PrismaClient();

type Args = {
  userId: string;
  apply: boolean;
  limit: number | null;
};

const BATCH_SIZE = 50;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const rows = await prisma.userMedia.findMany({
    where: {
      userId: args.userId,
      status: "COMPLETED",
      completedAt: null,
      completedAtUnsure: false,
      isArchived: false,
      media: { metadataJson: { not: null } },
    },
    select: {
      id: true,
      mediaId: true,
      media: { select: { title: true, metadataJson: true } },
    },
    ...(args.limit ? { take: args.limit } : {}),
  });

  const stats = {
    candidates: rows.length,
    wouldUpdate: 0,
    updated: 0,
    skippedNoDate: 0,
    skippedInvalid: 0,
  };

  const toWrite: Array<{ id: string; completedAt: Date; title: string }> = [];

  for (const row of rows) {
    const addedDate = letterboxdAddedDate(row.media.metadataJson);
    if (addedDate === null) {
      stats.skippedNoDate += 1;
      continue;
    }

    const parsed = parseCompletedAtInput(addedDate);
    if (!(parsed instanceof Date)) {
      stats.skippedInvalid += 1;
      console.log(`skip (invalid date "${addedDate}"): ${row.media.title}`);
      continue;
    }

    stats.wouldUpdate += 1;
    toWrite.push({
      id: row.id,
      completedAt: parsed,
      title: row.media.title,
    });
    console.log(`${row.media.title} → ${isoDate(parsed)}`);
  }

  if (!args.apply) {
    console.log("\nDRY RUN — no rows were written. Pass --apply to write.");
    printSummary(stats);
    return;
  }

  for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
    const batch = toWrite.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((entry) =>
        prisma.userMedia.update({
          where: { id: entry.id },
          data: { completedAt: entry.completedAt },
        }),
      ),
    );
    stats.updated += batch.length;
  }

  console.log(`\nApplied — updated ${stats.updated} row(s).`);
  printSummary(stats);
}

function letterboxdAddedDate(metadataJson: string | null): string | null {
  if (!metadataJson) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(metadataJson);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const letterboxd = (parsed as Record<string, unknown>).letterboxd;
  if (!letterboxd || typeof letterboxd !== "object") return null;
  const addedDate = (letterboxd as Record<string, unknown>).addedDate;
  return typeof addedDate === "string" && addedDate.trim() ? addedDate : null;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function printSummary(stats: {
  candidates: number;
  wouldUpdate: number;
  updated: number;
  skippedNoDate: number;
  skippedInvalid: number;
}) {
  console.log(
    JSON.stringify(
      {
        candidates: stats.candidates,
        wouldUpdate: stats.wouldUpdate,
        updated: stats.updated,
        skippedNoDate: stats.skippedNoDate,
        skippedInvalid: stats.skippedInvalid,
      },
      null,
      2,
    ),
  );
}

function parseArgs(argv: string[]): Args {
  const userId = valueFor(argv, "--user");
  if (!userId) {
    console.error(
      "Usage: tsx scripts/backfill-completed-at.ts --user <userId> [--apply] [--limit <n>]",
    );
    process.exit(1);
  }

  const limitValue = valueFor(argv, "--limit");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : null;
  if (limitValue && (limit === null || !Number.isFinite(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer.");
  }

  return {
    userId,
    apply: argv.includes("--apply"),
    limit,
  };
}

function valueFor(argv: string[], key: string) {
  const equalsArg = argv.find((arg) => arg.startsWith(`${key}=`));
  if (equalsArg) return equalsArg.split("=")[1];

  const index = argv.indexOf(key);
  return index >= 0 ? argv[index + 1] : undefined;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
