import type { MediaFormInput } from "@/lib/types";
import { prisma } from "@/lib/prisma";

/**
 * Edit suggestions store the full proposed `MediaFormInput` so the admin
 * approval path can re-run the existing mutation helpers verbatim. We snapshot
 * the relevant subset of the current `MediaItem` (+ taxonomy) at submission
 * time so the diff stays comparable even if the underlying item is later
 * touched directly by an admin between submission and review.
 */

export type EditSuggestionSnapshot = {
  title: string;
  originalTitle: string;
  mediaType: string;
  description: string;
  releaseDate: string | null; // ISO date (YYYY-MM-DD) or null
  externalUrl: string;
  metadataJson: string;
  genres: string[];
  tags: string[];
  credits: Array<{ role: string; kind: string; names: string[] }>;
};

export function inputToSnapshot(input: MediaFormInput): EditSuggestionSnapshot {
  return {
    title: input.title,
    originalTitle: input.originalTitle ?? "",
    mediaType: input.mediaType,
    description: input.description ?? "",
    releaseDate: isoDate(input.releaseDate),
    externalUrl: input.externalUrl ?? "",
    metadataJson: input.metadataJson ?? "",
    genres: [...(input.genres ?? [])].sort(),
    tags: [...(input.tags ?? [])].sort(),
    credits: (input.credits ?? [])
      .map((credit) => ({
        role: credit.role,
        kind: credit.kind,
        names: [...credit.names],
      }))
      .sort((a, b) => a.role.localeCompare(b.role)),
  };
}

export async function snapshotMediaItem(
  mediaId: string,
): Promise<EditSuggestionSnapshot | null> {
  const item = await prisma.mediaItem.findUnique({
    where: { id: mediaId },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
      credits: { include: { contributor: true }, orderBy: { order: "asc" } },
    },
  });
  if (!item) return null;

  const creditsByRole = new Map<
    string,
    { role: string; kind: string; names: string[] }
  >();
  for (const credit of item.credits) {
    const entry = creditsByRole.get(credit.role) ?? {
      role: credit.role,
      kind: credit.contributor.kind,
      names: [],
    };
    entry.names.push(credit.contributor.name);
    creditsByRole.set(credit.role, entry);
  }

  return {
    title: item.title,
    originalTitle: item.originalTitle ?? "",
    mediaType: item.mediaType,
    description: item.description ?? "",
    releaseDate: isoDate(item.releaseDate),
    externalUrl: item.externalUrl ?? "",
    metadataJson: item.metadataJson ?? "",
    genres: item.genres.map((entry) => entry.genre.name).sort(),
    tags: item.tags.map((entry) => entry.tag.name).sort(),
    credits: Array.from(creditsByRole.values()).sort((a, b) =>
      a.role.localeCompare(b.role),
    ),
  };
}

export type SuggestionDiffField = {
  field: string;
  label: string;
  before: string;
  after: string;
};

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  originalTitle: "Original title",
  mediaType: "Type",
  description: "Description",
  releaseDate: "Release date",
  externalUrl: "External URL",
  metadataJson: "Metadata JSON",
  genres: "Genres",
  tags: "Tags",
  credits: "Credits",
};

export function diffSnapshots(
  before: EditSuggestionSnapshot | null,
  after: EditSuggestionSnapshot,
): SuggestionDiffField[] {
  const fields: SuggestionDiffField[] = [];
  const beforeRecord = (before ?? emptySnapshot()) as Record<string, unknown>;
  const afterRecord = after as unknown as Record<string, unknown>;

  for (const key of Object.keys(FIELD_LABELS)) {
    const beforeValue = formatField(key, beforeRecord[key]);
    const afterValue = formatField(key, afterRecord[key]);
    if (beforeValue === afterValue) continue;
    fields.push({
      field: key,
      label: FIELD_LABELS[key],
      before: beforeValue,
      after: afterValue,
    });
  }
  return fields;
}

function formatField(key: string, value: unknown): string {
  if (value == null) return "";
  if (key === "credits" && Array.isArray(value)) {
    return value
      .map(
        (credit: { role: string; names: string[] }) =>
          `${credit.role}: ${credit.names.join("; ")}`,
      )
      .join(" · ");
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function emptySnapshot(): EditSuggestionSnapshot {
  return {
    title: "",
    originalTitle: "",
    mediaType: "",
    description: "",
    releaseDate: null,
    externalUrl: "",
    metadataJson: "",
    genres: [],
    tags: [],
    credits: [],
  };
}
