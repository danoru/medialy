import {
  ImportStatus,
  type MediaType,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import ExcelJS from "exceljs";
import {
  addImportedCredits,
  addImportedTaxonomy,
  mediaMutationData,
  mediaMutationDataWithUniqueTitle,
  mediaReleaseYear,
  mediaTitleKey,
  upsertMediaRelations,
  userMediaMutationData,
} from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { recomputeMediaScores } from "@/lib/scoring/recompute";
import { requireUserId } from "@/lib/user";
import { upsertUserMedia } from "@/lib/db/user-media";
import type {
  CsvMediaRow,
  ImportPreview,
  ImportResult,
  LetterboxdImportRole,
  MediaFormInput,
  MediaImportField,
  MediaImportMapping,
  MedialyExport,
  TabularMediaRows,
} from "@/lib/types";
import {
  assertExportVersion,
  mediaFormInputFromCsvRow,
  sanitizeExternalUrl,
} from "@/lib/validation";
import { titleEqualsSubtitleAware } from "@/lib/text-normalization";
import { VISIBLE_MEDIA_TYPES } from "@/lib/media-types";

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export const MEDIA_IMPORT_FIELDS: Array<{
  key: MediaImportField;
  label: string;
  required: boolean;
  aliases: string[];
}> = [
  {
    key: "title",
    label: "Title",
    required: true,
    aliases: ["title", "name", "media title"],
  },
  {
    key: "mediaType",
    label: "Media type",
    required: true,
    aliases: ["media type", "type", "format"],
  },
  {
    key: "status",
    label: "Status",
    required: false,
    aliases: ["status", "state"],
  },
  {
    key: "personalRating",
    label: "Personal rating",
    required: false,
    aliases: ["personal rating", "rating", "score"],
  },
  {
    key: "isFavorite",
    label: "Favorite",
    required: false,
    aliases: ["favorite", "is favorite", "favourite"],
  },
  {
    key: "originalTitle",
    label: "Original title",
    required: false,
    aliases: ["original title", "alternate title"],
  },
  {
    key: "releaseDate",
    label: "Release date",
    required: false,
    aliases: ["release date", "released", "year"],
  },
  {
    key: "genres",
    label: "Genres",
    required: false,
    aliases: ["genres", "genre"],
  },
  { key: "tags", label: "Tags", required: false, aliases: ["tags", "tag"] },
  {
    key: "description",
    label: "Description",
    required: false,
    aliases: ["description", "notes", "summary"],
  },
  {
    key: "externalUrl",
    label: "External URL",
    required: false,
    aliases: ["external url", "url", "link"],
  },
  {
    key: "directors",
    label: "Directors",
    required: false,
    aliases: ["directors", "director", "directed by"],
  },
  {
    key: "creators",
    label: "Creators",
    required: false,
    aliases: ["creators", "creator", "created by"],
  },
  {
    key: "developers",
    label: "Developers",
    required: false,
    aliases: ["developers", "developer", "developed by"],
  },
  {
    key: "publishers",
    label: "Publishers",
    required: false,
    aliases: ["publishers", "publisher", "published by"],
  },
];

export const MEDIA_IMPORT_CORE_FIELDS: MediaImportField[] = [
  "title",
  "mediaType",
  "status",
  "personalRating",
  "isFavorite",
];

export const MEDIA_IMPORT_ADVANCED_FIELDS: MediaImportField[] = [
  "originalTitle",
  "releaseDate",
  "genres",
  "tags",
  "directors",
  "creators",
  "developers",
  "publishers",
  "description",
  "externalUrl",
];

const mediaImportTemplateRows = [
  ["Heat", "MOVIE", "WATCHLIST", 9, "yes"],
  [
    "The Legend of Zelda: Breath of the Wild",
    "VIDEO_GAME",
    "BACKLOG",
    "",
    "no",
  ],
];

export async function buildJsonExport(): Promise<MedialyExport> {
  const userId = await requireUserId();
  const [media, genres, tags, comparisons, notes, lists] = await Promise.all([
    prisma.mediaItem.findMany({
      where: { userMedia: { some: { userId } } },
      include: {
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
        credits: { include: { contributor: true }, orderBy: { order: "asc" } },
        userMedia: { where: { userId }, take: 1 },
      },
    }),
    prisma.genre.findMany(),
    prisma.tag.findMany(),
    prisma.pairwiseComparison.findMany({ where: { userId } }),
    prisma.note.findMany({ where: { userId } }),
    prisma.customList.findMany({
      where: { userId },
      include: { items: true, sections: true },
    }),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    media,
    genres,
    tags,
    comparisons,
    notes,
    lists,
    importJobs: [],
  };
}

export async function buildMediaImportTemplateXlsx() {
  const headers = MEDIA_IMPORT_CORE_FIELDS;
  const workbook = new ExcelJS.Workbook();
  const mediaSheet = workbook.addWorksheet("Media");
  const instructionsSheet = workbook.addWorksheet("Instructions");

  mediaSheet.addRows([headers, ...mediaImportTemplateRows]);
  instructionsSheet.addRows([
    ["Field", "Required", "Accepted values / format"],
    ["title", "Yes", "Any non-empty title"],
    ["mediaType", "Yes", VISIBLE_MEDIA_TYPES.join(", ")],
    [
      "status",
      "No",
      "UNTRACKED, WATCHLIST, BACKLOG, IN_PROGRESS, COMPLETED, DROPPED, PAUSED",
    ],
    ["personalRating", "No", "Number"],
    ["isFavorite", "No", "yes/no or true/false"],
  ]);

  mediaSheet.columns = headers.map(() => ({ width: 18 }));
  instructionsSheet.columns = [{ width: 18 }, { width: 12 }, { width: 70 }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function buildMediaImportTemplateCsv() {
  const headers = MEDIA_IMPORT_CORE_FIELDS;
  return [headers, ...mediaImportTemplateRows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

export async function buildMediaCsvExport() {
  const userId = await requireUserId();
  const items = await prisma.mediaItem.findMany({
    where: { userMedia: { some: { userId } } },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
      credits: { include: { contributor: true }, orderBy: { order: "asc" } },
      userMedia: { where: { userId }, take: 1 },
    },
    orderBy: { title: "asc" },
  });
  const header = [
    "title",
    "mediaType",
    "status",
    "releaseDate",
    "personalRating",
    "genres",
    "tags",
    "directors",
    "creators",
    "developers",
    "publishers",
    "description",
    "externalUrl",
  ];
  const rows = items.map((item) => {
    const um = item.userMedia[0];
    return [
      item.title,
      item.mediaType,
      um?.status ?? "UNTRACKED",
      formatDate(item.releaseDate),
      um?.personalRating ?? "",
      item.genres.map((entry) => entry.genre.name).join(";"),
      item.tags.map((entry) => entry.tag.name).join(";"),
      creditNames(item.credits, "DIRECTOR"),
      creditNames(item.credits, "CREATOR"),
      creditNames(item.credits, "DEVELOPER"),
      creditNames(item.credits, "PUBLISHER"),
      item.description ?? "",
      item.externalUrl ?? "",
    ]
      .map(csvEscape)
      .join(",");
  });

  return [header.join(","), ...rows].join("\n");
}

export function parseMediaCsv(input: string): CsvMediaRow[] {
  return mapTabularMediaRows(parseMediaCsvTabular(input));
}

export function parseMediaCsvTabular(input: string): TabularMediaRows {
  const rows = parseCsvRows(input);
  const [header, ...body] = rows;
  if (!header) return { headers: [], rows: [] };
  const keys = header.map((key) => key.trim());

  const records = body
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) =>
      Object.fromEntries(keys.map((key, index) => [key, row[index] ?? ""])),
    );

  return { headers: keys, rows: records };
}

export async function parseMediaXlsx(
  input: ArrayBuffer | Uint8Array,
): Promise<TabularMediaRows> {
  const workbook = new ExcelJS.Workbook();
  const loadWorkbook = workbook.xlsx.load as (
    buffer: unknown,
  ) => Promise<ExcelJS.Workbook>;
  await loadWorkbook.call(workbook.xlsx, toBuffer(input));
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const rows: unknown[][] = [];
  sheet.eachRow((row) => {
    rows.push(rowValues(row));
  });

  const [header, ...body] = rows;
  if (!header) return { headers: [], rows: [] };
  const headers = header.map((value) => stringifyCell(value).trim());
  const records = body
    .filter((row) => row.some((cell) => stringifyCell(cell).trim()))
    .map((row) =>
      Object.fromEntries(
        headers.map((key, index) => [key, stringifyCell(row[index])]),
      ),
    );

  return { headers, rows: records };
}

export function suggestMediaImportMapping(
  headers: string[],
): MediaImportMapping {
  const normalizedHeaders = new Map(
    headers.map((header) => [normalizeHeader(header), header]),
  );

  return Object.fromEntries(
    MEDIA_IMPORT_FIELDS.map((field) => [
      field.key,
      field.aliases
        .map(normalizeHeader)
        .map((alias) => normalizedHeaders.get(alias))
        .find(Boolean) ?? "",
    ]),
  ) as MediaImportMapping;
}

export function mapTabularMediaRows(
  tabular: TabularMediaRows,
  mapping = suggestMediaImportMapping(tabular.headers),
) {
  return tabular.rows.map(
    (row) =>
      Object.fromEntries(
        MEDIA_IMPORT_FIELDS.map((field) => [
          field.key,
          mapping[field.key] ? (row[mapping[field.key] as string] ?? "") : "",
        ]),
      ) as CsvMediaRow,
  );
}

export function mapLetterboxdRows(
  tabular: TabularMediaRows,
  role: LetterboxdImportRole,
): MediaFormInput[] {
  return tabular.rows.map((row) => mediaInputFromLetterboxdRow(row, role));
}

export function parseLetterboxdRowsForImport(
  tabular: TabularMediaRows,
  role: LetterboxdImportRole,
) {
  const rows: MediaFormInput[] = [];
  const errors: ImportPreview["errors"] = [];

  tabular.rows.forEach((row, index) => {
    try {
      rows.push(mediaInputFromLetterboxdRow(row, role));
    } catch (error) {
      errors.push({
        row: index + 2,
        message: error instanceof Error ? error.message : "Invalid row.",
      });
    }
  });

  return { rows, errors };
}

export function mediaInputFromLetterboxdRow(
  row: Record<string, string>,
  role: LetterboxdImportRole,
): MediaFormInput {
  const title = readLetterboxdCell(row, "Name");
  if (!title) throw new Error("Name is required.");

  const year = readLetterboxdCell(row, "Year");
  const uri =
    readLetterboxdCell(row, "Letterboxd URI") ||
    readLetterboxdCell(row, "LetterboxdURI");
  const addedDate = readLetterboxdCell(row, "Date");
  const rating = readLetterboxdCell(row, "Rating");
  const metadata = {
    letterboxd: {
      ...(year ? { year } : {}),
      ...(uri ? { uri } : {}),
      ...(addedDate ? { addedDate } : {}),
      sourceStatus: role,
    },
  };

  return {
    title,
    originalTitle: "",
    mediaType: "MOVIE",
    status: role === "watchlist" ? "WATCHLIST" : "COMPLETED",
    description: "",
    releaseDate: parseLetterboxdYear(year),
    externalUrl: sanitizeExternalUrl(uri),
    metadataJson: JSON.stringify(metadata),
    personalRating: rating ? parseLetterboxdRating(rating) : null,
    isFavorite: false,
    genres: [],
    tags: [],
    credits: [],
  };
}

export type LetterboxdBundleInput = {
  watchlist?: string;
  watched?: string;
  ratings?: string;
};

export function parseLetterboxdBundleForImport(bundle: LetterboxdBundleInput) {
  const errors: ImportPreview["errors"] = [];
  const byKey = new Map<string, { input: MediaFormInput; priority: number }>();

  const ingest = (
    csv: string | undefined,
    role: LetterboxdImportRole,
    priority: number,
    label: string,
  ) => {
    if (!csv) return;
    const tabular = parseMediaCsvTabular(csv);
    tabular.rows.forEach((row, index) => {
      try {
        const input = mediaInputFromLetterboxdRow(row, role);
        const key = letterboxdMergeKey(input, row);
        const existing = byKey.get(key);
        if (!existing || priority > existing.priority) {
          byKey.set(key, { input: mergeLetterboxdInputs(existing?.input, input), priority });
        } else {
          byKey.set(key, {
            input: mergeLetterboxdInputs(existing.input, input),
            priority: existing.priority,
          });
        }
      } catch (error) {
        errors.push({
          row: index + 2,
          message: `${label}: ${
            error instanceof Error ? error.message : "Invalid row."
          }`,
        });
      }
    });
  };

  ingest(bundle.watchlist, "watchlist", 0, "watchlist.csv");
  ingest(bundle.watched, "watched", 1, "watched.csv");
  ingest(bundle.ratings, "watched", 2, "ratings.csv");

  return { rows: Array.from(byKey.values(), (entry) => entry.input), errors };
}

function letterboxdMergeKey(input: MediaFormInput, row: Record<string, string>) {
  const uri =
    readLetterboxdCell(row, "Letterboxd URI") ||
    readLetterboxdCell(row, "LetterboxdURI");
  if (uri) return `uri:${uri.toLowerCase()}`;
  const year = readLetterboxdCell(row, "Year");
  return `title:${input.title.trim().toLowerCase()}|${year}`;
}

function mergeLetterboxdInputs(
  previous: MediaFormInput | undefined,
  next: MediaFormInput,
): MediaFormInput {
  if (!previous) return next;
  return {
    ...previous,
    ...next,
    personalRating: next.personalRating ?? previous.personalRating,
    externalUrl: next.externalUrl || previous.externalUrl,
    releaseDate: next.releaseDate ?? previous.releaseDate,
  };
}

export async function previewLetterboxdImport(
  rows: MediaFormInput[],
  initialErrors: ImportPreview["errors"] = [],
): Promise<ImportPreview> {
  const existing = await prisma.mediaItem.findMany({
    select: {
      title: true,
      mediaType: true,
      externalUrl: true,
      releaseDate: true,
    },
  });
  const existingUrls = new Set(
    existing.map((item) => item.externalUrl).filter(Boolean),
  );
  const parsed: MediaFormInput[] = [];
  const errors: ImportPreview["errors"] = [...initialErrors];
  let creates = 0;
  let updates = 0;

  rows.forEach((input, index) => {
    try {
      if (!input.title) throw new Error("Name is required.");
      parsed.push(input);
      if (
        (input.externalUrl && existingUrls.has(input.externalUrl)) ||
        existing.some(
          (item) =>
            isCompatibleTitleMatch(input, item) ||
            isSubtitleTolerantMatch(input, item),
        )
      ) {
        updates += 1;
      } else {
        creates += 1;
      }
    } catch (error) {
      errors.push({
        row: index + 2,
        message: error instanceof Error ? error.message : "Invalid row.",
      });
    }
  });

  return { valid: errors.length === 0, creates, updates, errors, rows: parsed };
}

export async function previewMediaImport(
  rows: CsvMediaRow[],
): Promise<ImportPreview> {
  const existing = await prisma.mediaItem.findMany({
    select: {
      title: true,
      mediaType: true,
      externalUrl: true,
      releaseDate: true,
    },
  });
  const existingUrls = new Set(
    existing.map((item) => item.externalUrl).filter(Boolean),
  );
  const parsed: MediaFormInput[] = [];
  const errors: ImportPreview["errors"] = [];
  let creates = 0;
  let updates = 0;

  rows.forEach((row, index) => {
    try {
      const input = mediaFormInputFromCsvRow(row);
      parsed.push(input);
      if (
        (input.externalUrl && existingUrls.has(input.externalUrl)) ||
        existing.some(
          (item) =>
            isCompatibleTitleMatch(input, item) ||
            isSubtitleTolerantMatch(input, item),
        )
      )
        updates += 1;
      else creates += 1;
    } catch (error) {
      errors.push({
        row: index + 2,
        message: error instanceof Error ? error.message : "Invalid row.",
      });
    }
  });

  return { valid: errors.length === 0, creates, updates, errors, rows: parsed };
}

export async function importMediaRows(
  rows: MediaFormInput[],
  fileName?: string,
): Promise<ImportResult> {
  return importMediaRowsWithSource(rows, "CSV", fileName);
}

export async function importMediaRowsWithSource(
  rows: MediaFormInput[],
  sourceType: "CSV" | "XLSX",
  fileName?: string,
): Promise<ImportResult> {
  const userId = await requireUserId();
  const errors: ImportResult["errors"] = [];
  const mediaIndex = new ImportMediaIndex();
  let importedCount = 0;

  for (const [index, input] of rows.entries()) {
    try {
      const { media, isNew } = await upsertImportedMedia(
        input,
        userId,
        mediaIndex,
      );
      await writeImportedRelations(media.id, input, isNew);
      await recomputeMediaScores(media.id, userId);
      importedCount += 1;
    } catch (error) {
      errors.push({
        row: index + 2,
        message: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }

  await prisma.importJob.create({
    data: {
      sourceType,
      fileName,
      status:
        errors.length === 0
          ? ImportStatus.SUCCESS
          : importedCount > 0
            ? ImportStatus.PARTIAL
            : ImportStatus.FAILED,
      importedCount,
      skippedCount: errors.length,
      errorJson: errors.length > 0 ? JSON.stringify(errors) : null,
    },
  });

  return { importedCount, skippedCount: errors.length, errors };
}

export async function importLetterboxdRows(
  rows: MediaFormInput[],
  fileName?: string,
): Promise<ImportResult> {
  const userId = await requireUserId();
  const errors: ImportResult["errors"] = [];
  const mediaIndex = new ImportMediaIndex();
  let importedCount = 0;

  for (const [index, input] of rows.entries()) {
    try {
      const { media, isNew } = await upsertImportedMedia(
        input,
        userId,
        mediaIndex,
        "fill-blanks",
      );
      await writeImportedRelations(media.id, input, isNew);
      await recomputeMediaScores(media.id, userId);
      importedCount += 1;
    } catch (error) {
      errors.push({
        row: index + 2,
        message: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }

  await prisma.importJob.create({
    data: {
      sourceType: "CSV",
      fileName,
      status:
        errors.length === 0
          ? ImportStatus.SUCCESS
          : importedCount > 0
            ? ImportStatus.PARTIAL
            : ImportStatus.FAILED,
      importedCount,
      skippedCount: errors.length,
      errorJson: errors.length > 0 ? JSON.stringify(errors) : null,
    },
  });

  return { importedCount, skippedCount: errors.length, errors };
}

export async function importJsonExport(
  input: unknown,
  fileName?: string,
): Promise<ImportResult> {
  assertExportVersion(input);
  const bundle = input as MedialyExport;
  const userId = await requireUserId();
  const errors: ImportResult["errors"] = [];
  const mediaIndex = new ImportMediaIndex();
  let importedCount = 0;

  for (const [index, raw] of bundle.media.entries()) {
    const item = raw as {
      title?: string;
      mediaType?: string;
      status?: string;
      description?: string | null;
      releaseDate?: string | Date | null;
      personalRating?: number | null;
      externalUrl?: string | null;
      genres?: Array<{ genre?: { name?: string } }>;
      tags?: Array<{ tag?: { name?: string } }>;
      credits?: Array<{
        role?: string;
        contributor?: { name?: string; kind?: string };
      }>;
    };
    try {
      const input = mediaFormInputFromCsvRow({
        title: item.title ?? "",
        mediaType: item.mediaType ?? "",
        status: item.status ?? "UNTRACKED",
        releaseDate: item.releaseDate
          ? String(item.releaseDate).slice(0, 10)
          : "",
        personalRating:
          item.personalRating == null ? "" : String(item.personalRating),
        description: item.description ?? "",
        externalUrl: item.externalUrl ?? "",
        genres:
          item.genres
            ?.map((entry) => entry.genre?.name)
            .filter(Boolean)
            .join(";") ?? "",
        tags:
          item.tags
            ?.map((entry) => entry.tag?.name)
            .filter(Boolean)
            .join(";") ?? "",
        directors: jsonCreditNames(item.credits, "DIRECTOR"),
        creators: jsonCreditNames(item.credits, "CREATOR"),
        developers: jsonCreditNames(item.credits, "DEVELOPER"),
        publishers: jsonCreditNames(item.credits, "PUBLISHER"),
      });
      const { media, isNew } = await upsertImportedMedia(
        input,
        userId,
        mediaIndex,
      );
      await writeImportedRelations(media.id, input, isNew);
      await recomputeMediaScores(media.id, userId);
      importedCount += 1;
    } catch (error) {
      errors.push({
        row: index + 1,
        message: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }

  await prisma.importJob.create({
    data: {
      sourceType: "JSON",
      fileName,
      status:
        errors.length === 0
          ? "SUCCESS"
          : importedCount > 0
            ? "PARTIAL"
            : "FAILED",
      importedCount,
      skippedCount: errors.length,
      errorJson: errors.length > 0 ? JSON.stringify(errors) : null,
    },
  });

  return { importedCount, skippedCount: errors.length, errors };
}

function formatDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function creditNames(
  credits: Array<{ role: string; order: number; contributor: { name: string } }>,
  role: string,
) {
  return credits
    .filter((credit) => credit.role === role)
    .sort((first, second) => first.order - second.order)
    .map((credit) => credit.contributor.name)
    .join(";");
}

function jsonCreditNames(
  credits:
    | Array<{
        role?: string;
        contributor?: { name?: string };
      }>
    | undefined,
  role: string,
) {
  return (
    credits
      ?.filter((credit) => credit.role === role)
      .map((credit) => credit.contributor?.name)
      .filter(Boolean)
      .join(";") ?? ""
  );
}

type UserMediaStrategy = "overwrite" | "fill-blanks";

/**
 * Writes genres/tags/credits from an import row, choosing semantics based on
 * whether the matched MediaItem already existed:
 *   - new item: replace-all (the standard form-submit behavior)
 *   - existing item: additive union — never delete what the user already has
 *     on the item. This protects curated data when a re-import (e.g. a fresh
 *     Letterboxd CSV) carries no genre / tag / credit data.
 */
async function writeImportedRelations(
  mediaId: string,
  input: MediaFormInput,
  isNew: boolean,
) {
  if (isNew) {
    await upsertMediaRelations(mediaId, input);
    return;
  }
  await addImportedTaxonomy(mediaId, input.genres, input.tags, input.mediaType);
  await addImportedCredits(mediaId, input.credits ?? []);
}

async function upsertImportedMedia(
  input: MediaFormInput,
  userId: string,
  index: ImportMediaIndex,
  userMediaStrategy: UserMediaStrategy = "overwrite",
): Promise<{ media: { id: string }; isNew: boolean }> {
  return prisma.$transaction(async (tx) => {
    const existing = await findExistingImportedMedia(tx, input, index);

    if (existing) {
      const current = await tx.mediaItem.findUnique({
        where: { id: existing.id },
      });
      const merged = mergeMediaScalarsForImport(input, current);
      const updated = await tx.mediaItem.update({
        where: { id: existing.id },
        data: merged,
      });
      index.register(updated);
      await upsertUserMediaWithStrategy(
        tx,
        userId,
        updated.id,
        input,
        userMediaStrategy,
      );
      return { media: updated, isNew: false };
    }

    const data = await mediaMutationDataWithUniqueTitle(tx, input, undefined, {
      candidates: await index.candidatesFor(tx, input.mediaType),
    });
    const created = await tx.mediaItem.create({ data });
    index.register(created);
    await upsertUserMediaWithStrategy(
      tx,
      userId,
      created.id,
      input,
      userMediaStrategy,
    );
    return { media: created, isNew: true };
  });
}

/**
 * Returns scalar `MediaItem` fields for an import that matched an existing
 * row. We only fill in values that are blank on the existing item — a
 * re-import (e.g. a fresh Letterboxd CSV with no description) must never
 * overwrite curation the user already entered.
 *
 * `metadataJson` is shallow-merged at the top level so each source's
 * namespace (e.g. `letterboxd`, `tmdb`) is preserved or updated independently.
 */
function mergeMediaScalarsForImport(
  input: MediaFormInput,
  existing: { [k: string]: unknown } | null,
) {
  const base = mediaMutationData(input);
  if (!existing) return base;
  const keep = <T>(existingValue: T, incoming: T) =>
    existingValue == null || existingValue === "" ? incoming : existingValue;
  return {
    ...base,
    originalTitle: keep(
      existing.originalTitle as string | null,
      base.originalTitle,
    ),
    description: keep(existing.description as string | null, base.description),
    externalUrl: keep(existing.externalUrl as string | null, base.externalUrl),
    releaseDate: (existing.releaseDate as Date | null) ?? base.releaseDate,
    metadataJson: mergeMetadataJson(
      existing.metadataJson as string | null,
      base.metadataJson,
    ),
  };
}

function mergeMetadataJson(
  existing: string | null,
  incoming: string | null | undefined,
) {
  if (!incoming) return existing ?? null;
  if (!existing) return incoming;
  try {
    const a = JSON.parse(existing);
    const b = JSON.parse(incoming);
    if (
      a &&
      b &&
      typeof a === "object" &&
      typeof b === "object" &&
      !Array.isArray(a) &&
      !Array.isArray(b)
    ) {
      return JSON.stringify({ ...a, ...b });
    }
  } catch {
    // fall through
  }
  return existing;
}

async function upsertUserMediaWithStrategy(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  mediaId: string,
  input: MediaFormInput,
  strategy: UserMediaStrategy,
) {
  if (strategy === "overwrite") {
    await upsertUserMedia(userId, mediaId, userMediaMutationData(input), tx);
    return;
  }

  const existing = await tx.userMedia.findUnique({
    where: { userId_mediaId: { userId, mediaId } },
    select: { status: true, personalRating: true, isFavorite: true },
  });
  const incoming = userMediaMutationData(input);
  const data = {
    status:
      existing && existing.status !== "UNTRACKED" ? existing.status : incoming.status,
    personalRating:
      existing && existing.personalRating != null
        ? existing.personalRating
        : incoming.personalRating,
    isFavorite: existing ? existing.isFavorite || incoming.isFavorite : incoming.isFavorite,
  };
  await upsertUserMedia(userId, mediaId, data, tx);
}

export type ImportCandidate = {
  id: string;
  title: string;
  mediaType: MediaType;
  externalUrl: string | null;
  releaseDate: Date | null;
};

/**
 * Per-import cache of the rows an incoming row is matched against.
 *
 * Dedupe matching is fuzzy (URL, then strict title+year, then subtitle-tolerant)
 * so it can't be expressed as a `where` clause — it needs the candidate list in
 * memory. Loading that list per row meant a 500-row CSV ran 500 full-table
 * scans; this loads it once per media type instead.
 *
 * Rows created or updated during the import are registered back into the cache,
 * so a file containing the same title twice still collapses to one item exactly
 * as it did when every row re-queried the table.
 */
export class ImportMediaIndex {
  private byType = new Map<MediaType, ImportCandidate[]>();

  async candidatesFor(client: PrismaLike, mediaType: MediaType) {
    const cached = this.byType.get(mediaType);
    if (cached) return cached;
    const rows = await client.mediaItem.findMany({
      where: { mediaType },
      select: {
        id: true,
        title: true,
        mediaType: true,
        externalUrl: true,
        releaseDate: true,
      },
    });
    this.byType.set(mediaType, rows);
    return rows;
  }

  /** Record a row this import just wrote so later rows can match against it. */
  register(item: ImportCandidate) {
    const list = this.byType.get(item.mediaType);
    if (!list) return;
    const existingAt = list.findIndex((row) => row.id === item.id);
    if (existingAt >= 0) list[existingAt] = item;
    else list.push(item);
  }
}

async function findExistingImportedMedia(
  client: PrismaLike,
  input: MediaFormInput,
  index: ImportMediaIndex,
) {
  const candidates = await index.candidatesFor(client, input.mediaType);
  const externalUrl = input.externalUrl?.trim();

  const byUrl = candidates.find(
    (item) => externalUrl && item.externalUrl === externalUrl,
  );
  if (byUrl) return byUrl;

  const strict = candidates.find((item) => isCompatibleTitleMatch(input, item));
  if (strict) return strict;

  const fuzzy = candidates.find((item) =>
    isSubtitleTolerantMatch(input, item),
  );
  if (fuzzy) {
    console.log(
      `[import] fuzzy title match: "${input.title}" → "${fuzzy.title}" (year ${mediaReleaseYear(input.releaseDate)})`,
    );
    return fuzzy;
  }
  return null;
}

function isCompatibleTitleMatch(
  input: MediaFormInput,
  item: {
    title: string;
    mediaType: string;
    releaseDate?: Date | string | null;
  },
) {
  if (
    mediaTitleKey(input.title, input.mediaType) !==
    mediaTitleKey(item.title, item.mediaType)
  ) {
    return false;
  }

  const inputYear = mediaReleaseYear(input.releaseDate);
  const itemYear = mediaReleaseYear(item.releaseDate);
  return !inputYear || !itemYear || inputYear === itemYear;
}

// Tier 3 dedup: matches "Wake Up Dead Man" against "Wake Up Dead Man: A
// Knives Out Mystery" when both sides have a year and those years are
// identical. The subtitle-aware comparator additionally guards against
// generic single-word merges (see lib/text-normalization).
function isSubtitleTolerantMatch(
  input: MediaFormInput,
  item: {
    title: string;
    mediaType: string;
    releaseDate?: Date | string | null;
  },
) {
  if (String(input.mediaType) !== String(item.mediaType)) return false;
  const inputYear = mediaReleaseYear(input.releaseDate);
  const itemYear = mediaReleaseYear(item.releaseDate);
  if (inputYear == null || itemYear == null) return false;
  if (inputYear !== itemYear) return false;
  return titleEqualsSubtitleAware(input.title, item.title);
}

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  // Prefix formula-trigger characters so spreadsheet apps treat the cell as
  // text rather than executing it (CSV formula injection / CWE-1236).
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (!/[",\n]/.test(safe)) return safe;
  return `"${safe.replaceAll('"', '""')}"`;
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function stringifyCell(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (isRichTextCell(value))
    return value.richText.map((entry) => entry.text).join("");
  if (isTextCell(value)) return value.text;
  if (isFormulaCell(value)) return stringifyCell(value.result);
  return String(value ?? "").trim();
}

function toBuffer(input: ArrayBuffer | Uint8Array) {
  return input instanceof Uint8Array ? Buffer.from(input) : Buffer.from(input);
}

function rowValues(row: ExcelJS.Row) {
  const values = Array.isArray(row.values) ? row.values.slice(1) : [];
  return values.map((value) => value ?? "");
}

function isRichTextCell(
  value: unknown,
): value is { richText: Array<{ text: string }> } {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as { richText?: unknown }).richText),
  );
}

function isTextCell(value: unknown): value is { text: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as { text?: unknown }).text === "string",
  );
}

function isFormulaCell(value: unknown): value is { result?: unknown } {
  return Boolean(value && typeof value === "object" && "result" in value);
}

function readLetterboxdCell(row: Record<string, string>, key: string) {
  const exact = row[key]?.trim();
  if (exact) return exact;
  const normalizedKey = normalizeHeader(key);
  const match = Object.entries(row).find(
    ([header]) => normalizeHeader(header) === normalizedKey,
  );
  return match?.[1]?.trim() ?? "";
}

function parseLetterboxdYear(value: string) {
  if (!/^\d{4}$/.test(value)) return null;
  return new Date(`${value}-01-01T00:00:00.000Z`);
}

function parseLetterboxdRating(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid rating: ${value}`);
  return parsed * 2;
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}
