import { ImportStatus } from "@prisma/client";
import ExcelJS from "exceljs";
import { mediaMutationData, upsertTaxonomy } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { recomputeMediaScores } from "@/lib/scoring/recompute";
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
  normalizeKey,
} from "@/lib/validation";
import { VISIBLE_MEDIA_TYPES } from "@/lib/media-types";

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
    key: "upcomingDate",
    label: "Upcoming date",
    required: false,
    aliases: ["upcoming date", "planned date"],
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
  "upcomingDate",
  "genres",
  "tags",
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
  const [
    media,
    genres,
    tags,
    comparisons,
    notes,
    lists,
    friends,
    friendRatings,
    importJobs,
  ] = await Promise.all([
    prisma.mediaItem.findMany({
      include: {
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
      },
    }),
    prisma.genre.findMany(),
    prisma.tag.findMany(),
    prisma.pairwiseComparison.findMany(),
    prisma.note.findMany(),
    prisma.customList.findMany({ include: { items: true } }),
    prisma.friend.findMany(),
    prisma.friendRating.findMany(),
    prisma.importJob.findMany(),
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
    friends,
    friendRatings,
    importJobs,
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
  const items = await prisma.mediaItem.findMany({
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
    },
    orderBy: { title: "asc" },
  });
  const header = [
    "title",
    "mediaType",
    "status",
    "releaseDate",
    "upcomingDate",
    "personalRating",
    "genres",
    "tags",
    "description",
    "externalUrl",
  ];
  const rows = items.map((item) =>
    [
      item.title,
      item.mediaType,
      item.status,
      formatDate(item.releaseDate),
      formatDate(item.upcomingDate),
      item.personalRating ?? "",
      item.genres.map((entry) => entry.genre.name).join(";"),
      item.tags.map((entry) => entry.tag.name).join(";"),
      item.description ?? "",
      item.externalUrl ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );

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
    upcomingDate: null,
    externalUrl: uri,
    metadataJson: JSON.stringify(metadata),
    personalRating: rating ? parseLetterboxdRating(rating) : null,
    isFavorite: false,
    genres: [],
    tags: [],
  };
}

export async function previewLetterboxdImport(
  rows: MediaFormInput[],
  initialErrors: ImportPreview["errors"] = [],
): Promise<ImportPreview> {
  const existing = await prisma.mediaItem.findMany({
    select: { title: true, mediaType: true, externalUrl: true },
  });
  const existingKeys = new Set(
    existing.map((item) => normalizeKey(item.title, item.mediaType)),
  );
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
        existingKeys.has(normalizeKey(input.title, input.mediaType))
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
    select: { title: true, mediaType: true },
  });
  const existingKeys = new Set(
    existing.map((item) => normalizeKey(item.title, item.mediaType)),
  );
  const parsed: MediaFormInput[] = [];
  const errors: ImportPreview["errors"] = [];
  let creates = 0;
  let updates = 0;

  rows.forEach((row, index) => {
    try {
      const input = mediaFormInputFromCsvRow(row);
      parsed.push(input);
      if (existingKeys.has(normalizeKey(input.title, input.mediaType)))
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
  const errors: ImportResult["errors"] = [];
  let importedCount = 0;

  for (const [index, input] of rows.entries()) {
    try {
      const media = await prisma.mediaItem.upsert({
        where: {
          title_mediaType: { title: input.title, mediaType: input.mediaType },
        },
        update: mediaMutationData(input),
        create: mediaMutationData(input),
      });
      await upsertTaxonomy(media.id, input.genres, input.tags);
      await recomputeMediaScores(media.id);
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
  const errors: ImportResult["errors"] = [];
  let importedCount = 0;

  for (const [index, input] of rows.entries()) {
    try {
      const existingByUrl = input.externalUrl
        ? await prisma.mediaItem.findFirst({
            where: { externalUrl: input.externalUrl },
            select: { id: true },
          })
        : null;
      const data = mediaMutationData(input);
      const media = existingByUrl
        ? await prisma.mediaItem.update({
            where: { id: existingByUrl.id },
            data,
          })
        : await prisma.mediaItem.upsert({
            where: {
              title_mediaType: {
                title: input.title,
                mediaType: input.mediaType,
              },
            },
            update: data,
            create: data,
          });

      await upsertTaxonomy(media.id, input.genres, input.tags);
      await recomputeMediaScores(media.id);
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
  const errors: ImportResult["errors"] = [];
  let importedCount = 0;

  for (const [index, raw] of bundle.media.entries()) {
    const item = raw as {
      title?: string;
      mediaType?: string;
      status?: string;
      description?: string | null;
      releaseDate?: string | Date | null;
      upcomingDate?: string | Date | null;
      personalRating?: number | null;
      externalUrl?: string | null;
      genres?: Array<{ genre?: { name?: string } }>;
      tags?: Array<{ tag?: { name?: string } }>;
    };
    try {
      const input = mediaFormInputFromCsvRow({
        title: item.title ?? "",
        mediaType: item.mediaType ?? "",
        status: item.status ?? "UNTRACKED",
        releaseDate: item.releaseDate
          ? String(item.releaseDate).slice(0, 10)
          : "",
        upcomingDate: item.upcomingDate
          ? String(item.upcomingDate).slice(0, 10)
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
      });
      const media = await prisma.mediaItem.upsert({
        where: {
          title_mediaType: { title: input.title, mediaType: input.mediaType },
        },
        update: mediaMutationData(input),
        create: mediaMutationData(input),
      });
      await upsertTaxonomy(media.id, input.genres, input.tags);
      await recomputeMediaScores(media.id);
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

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replaceAll('"', '""')}"`;
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
