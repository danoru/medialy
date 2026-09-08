import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { config } from "dotenv";
import initSqlJs from "sql.js";

config();

process.env.DIRECT_URL ??=
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL;

const { PrismaClient } = await import("@prisma/client");

const prisma = new PrismaClient();
const sqlitePath = resolve(process.argv[2] ?? "prisma/dev.db");
const force = process.argv.includes("--force");

/**
 * `--force` deletes every app table before importing. That is unrecoverable
 * without a database backup, and it is far too easy to reach for while
 * iterating on scripts — so it now takes a second, deliberate flag naming the
 * exact phrase. Nothing is deleted until both are present.
 */
const CONFIRM_PHRASE = "DELETE-ALL-POSTGRES-DATA";
const confirmArg = process.argv.find((arg) => arg.startsWith("--confirm="));
const confirmed = confirmArg?.split("=").slice(1).join("=") === CONFIRM_PHRASE;

if (!existsSync(sqlitePath)) {
  console.error(`SQLite database not found: ${sqlitePath}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL?.startsWith("postgresql://")) {
  console.error("DATABASE_URL must point to PostgreSQL before importing.");
  process.exit(1);
}

const SQL = await initSqlJs();
const sqlite = new SQL.Database(readFileSync(sqlitePath));

const tableOrder = [
  "MediaItem",
  "ReleaseCandidate",
  "Genre",
  "Tag",
  "CustomList",
  "MediaGenre",
  "MediaTag",
  "PairwiseComparison",
  "ListItem",
  "Note",
  "ImportJob",
];

const modelMap = {
  MediaItem: prisma.mediaItem,
  ReleaseCandidate: prisma.releaseCandidate,
  Genre: prisma.genre,
  Tag: prisma.tag,
  CustomList: prisma.customList,
  MediaGenre: prisma.mediaGenre,
  MediaTag: prisma.mediaTag,
  PairwiseComparison: prisma.pairwiseComparison,
  ListItem: prisma.listItem,
  Note: prisma.note,
  ImportJob: prisma.importJob,
};

const booleanFields = new Map([
  ["MediaItem", ["isFavorite", "isArchived"]],
]);

const dateFields = new Map([
  [
    "MediaItem",
    ["releaseDate", "createdAt", "updatedAt"],
  ],
  [
    "ReleaseCandidate",
    ["releaseDate", "fetchedAt", "createdAt", "updatedAt"],
  ],
  ["PairwiseComparison", ["createdAt"]],
  ["CustomList", ["createdAt", "updatedAt"]],
  ["ListItem", ["createdAt"]],
  ["Note", ["createdAt", "updatedAt"]],
  ["ImportJob", ["createdAt"]],
]);

try {
  await ensurePostgresIsReady();
  await ensureTargetIsEmptyOrForced();

  if (force) await clearPostgres();

  for (const table of tableOrder) {
    const rows = readTable(table);
    if (rows.length === 0) continue;

    await modelMap[table].createMany({
      data: rows.map((row) => normalizeRow(table, row)),
      skipDuplicates: true,
    });

    console.log(`Imported ${rows.length} ${table} rows`);
  }

  console.log(`Imported SQLite data from ${basename(sqlitePath)} into Postgres.`);
} finally {
  sqlite.close();
  await prisma.$disconnect();
}

async function ensurePostgresIsReady() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
}

async function ensureTargetIsEmptyOrForced() {
  const counts = await Promise.all(
    tableOrder.map(async (table) => [table, await modelMap[table].count()]),
  );
  const populatedTables = counts.filter(([, count]) => count > 0);

  if (populatedTables.length === 0) return;

  if (!force) {
    console.error(
      "Postgres already has data. Re-run with --force to replace it:",
    );
    for (const [table, count] of populatedTables) {
      console.error(`- ${table}: ${count}`);
    }
    process.exit(1);
  }

  if (confirmed) return;

  // --force on a populated database, without confirmation. Show the damage.
  const total = populatedTables.reduce((sum, [, count]) => sum + count, 0);
  console.error(
    `Refusing to delete ${total} existing rows across ${populatedTables.length} tables:`,
  );
  for (const [table, count] of populatedTables) {
    console.error(`- ${table}: ${count}`);
  }
  console.error(
    `
This is not recoverable without a database backup. Every row above is
` +
      `replaced by the contents of the SQLite file, so anything entered since
` +
      `that snapshot is lost. If that is genuinely what you want, re-run with:

` +
      `  --force --confirm=${CONFIRM_PHRASE}
`,
  );
  process.exit(1);
}

async function clearPostgres() {
  for (const table of [...tableOrder].reverse()) {
    await modelMap[table].deleteMany();
  }
}

function readTable(table) {
  if (!tableExists(table)) return [];

  const result = sqlite.exec(`SELECT * FROM "${table}"`);
  if (result.length === 0) return [];

  const { columns, values } = result[0];
  return values.map((value) =>
    Object.fromEntries(columns.map((column, index) => [column, value[index]])),
  );
}

function tableExists(table) {
  const statement = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
  );
  statement.bind([table]);
  const exists = statement.step();
  statement.free();
  return exists;
}

function normalizeRow(table, row) {
  const normalized = { ...row };

  for (const field of booleanFields.get(table) ?? []) {
    if (normalized[field] !== null && normalized[field] !== undefined) {
      normalized[field] = Boolean(normalized[field]);
    }
  }

  for (const field of dateFields.get(table) ?? []) {
    if (normalized[field] !== null && normalized[field] !== undefined) {
      normalized[field] = new Date(normalized[field]);
    }
  }

  return normalized;
}
