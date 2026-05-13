import { MediaStatus, MediaType } from "@prisma/client";
import type { CsvMediaRow, MediaFormInput } from "@/lib/types";

const mediaTypes = new Set<string>(Object.values(MediaType));
const mediaStatuses = new Set<string>(Object.values(MediaStatus));

export function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeKey(title: string, mediaType: string) {
  return `${normalizeName(title).toLowerCase()}::${mediaType.toUpperCase()}`;
}

export function coerceMediaType(
  value: FormDataEntryValue | string | null,
): MediaType {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_");
  if (!mediaTypes.has(normalized)) {
    throw new Error(`Invalid media type: ${String(value ?? "")}`);
  }
  return normalized as MediaType;
}

export function coerceMediaStatus(
  value: FormDataEntryValue | string | null,
): MediaStatus {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_");
  if (!mediaStatuses.has(normalized)) {
    throw new Error(`Invalid status: ${String(value ?? "")}`);
  }
  return normalized as MediaStatus;
}

export function parseOptionalDate(value: FormDataEntryValue | string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${raw}`);
  }
  return parsed;
}

export function parseOptionalNumber(value: FormDataEntryValue | string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number: ${raw}`);
  }
  return parsed;
}

export function splitNames(value: FormDataEntryValue | string | null) {
  return String(value ?? "")
    .split(/[;,]/)
    .map(normalizeName)
    .filter(Boolean);
}

export function mediaFormInputFromFormData(formData: FormData): MediaFormInput {
  const title = normalizeName(String(formData.get("title") ?? ""));
  if (!title) {
    throw new Error("Title is required.");
  }

  const metadataJson = String(formData.get("metadataJson") ?? "").trim();
  if (metadataJson) {
    JSON.parse(metadataJson);
  }

  return {
    title,
    originalTitle: normalizeName(String(formData.get("originalTitle") ?? "")),
    mediaType: coerceMediaType(formData.get("mediaType")),
    status: coerceMediaStatus(formData.get("status")),
    description: String(formData.get("description") ?? "").trim(),
    releaseDate: parseOptionalDate(formData.get("releaseDate")),
    upcomingDate: parseOptionalDate(formData.get("upcomingDate")),
    externalUrl: String(formData.get("externalUrl") ?? "").trim(),
    metadataJson,
    personalRating: parseOptionalNumber(formData.get("personalRating")),
    isFavorite: formData.get("isFavorite") === "on",
    genres: splitNames(formData.get("genres")),
    tags: splitNames(formData.get("tags")),
  };
}

export function mediaFormInputFromCsvRow(row: CsvMediaRow): MediaFormInput {
  const title = normalizeName(row.title ?? "");
  if (!title) throw new Error("Title is required.");

  return {
    title,
    originalTitle: normalizeName(row.originalTitle ?? ""),
    mediaType: coerceMediaType(row.mediaType),
    status: row.status ? coerceMediaStatus(row.status) : "UNTRACKED",
    description: row.description?.trim() ?? "",
    releaseDate: parseOptionalDate(row.releaseDate ?? ""),
    upcomingDate: parseOptionalDate(row.upcomingDate ?? ""),
    externalUrl: row.externalUrl?.trim() ?? "",
    personalRating: parseOptionalNumber(row.personalRating ?? ""),
    isFavorite: parseOptionalBoolean(row.isFavorite ?? ""),
    genres: splitNames(row.genres ?? ""),
    tags: splitNames(row.tags ?? ""),
  };
}

function parseOptionalBoolean(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return false;
  if (["true", "yes", "y", "1", "favorite"].includes(raw)) return true;
  if (["false", "no", "n", "0"].includes(raw)) return false;
  throw new Error(`Invalid boolean: ${value}`);
}

export function assertExportVersion(
  value: unknown,
): asserts value is { version: 1 } {
  if (
    !value ||
    typeof value !== "object" ||
    (value as { version?: unknown }).version !== 1
  ) {
    throw new Error("Unsupported Medialy export version.");
  }
}
