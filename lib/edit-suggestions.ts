import type {
  ExternalRatingSource,
  RelationKind,
  ReleaseKind,
} from "@prisma/client";
import { manualRatingDef } from "@/lib/external-ratings";
import {
  RELATION_FORWARD_LABEL,
  RELATION_INVERSE_LABEL,
  RELEASE_KIND_LABEL,
} from "@/lib/media-relations";
import type { MediaFormInput } from "@/lib/types";
import { prisma } from "@/lib/prisma";

/**
 * Edit suggestions store the full proposed `MediaFormInput` so the admin
 * approval path can re-run the existing mutation helpers verbatim. We snapshot
 * the relevant subset of the current `MediaItem` (+ taxonomy) at submission
 * time so the diff stays comparable even if the underlying item is later
 * touched directly by an admin between submission and review.
 */

export type SnapshotRelation = {
  kind: string;
  direction: "forward" | "inverse";
  otherId: string;
  otherTitle: string;
};

export type SnapshotReleaseEvent = {
  kind: string;
  date: string; // ISO
  title: string | null;
};

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
  externalRatings: Array<{ source: string; score: number; scale: number }>;
  relations: SnapshotRelation[];
  releaseEvents: SnapshotReleaseEvent[];
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
    externalRatings: (input.externalRatings ?? [])
      .map((rating) => ({
        source: rating.source,
        score: rating.score,
        scale: rating.scale,
      }))
      .sort((a, b) => a.source.localeCompare(b.source)),
    relations: sortRelations(
      (input.relations ?? []).map((relation) => ({
        kind: relation.kind,
        direction: relation.direction,
        otherId: relation.otherId,
        otherTitle: relation.otherTitle,
      })),
    ),
    releaseEvents: sortReleaseEvents(
      (input.releaseEvents ?? []).map((event) => ({
        kind: event.kind,
        date: event.date,
        title: event.title,
      })),
    ),
  };
}

function sortRelations(relations: SnapshotRelation[]): SnapshotRelation[] {
  return [...relations].sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      a.otherTitle.localeCompare(b.otherTitle) ||
      a.otherId.localeCompare(b.otherId),
  );
}

function sortReleaseEvents(
  events: SnapshotReleaseEvent[],
): SnapshotReleaseEvent[] {
  return [...events].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.kind.localeCompare(b.kind) ||
      (a.title ?? "").localeCompare(b.title ?? ""),
  );
}

export async function snapshotMediaItem(
  mediaId: string,
): Promise<EditSuggestionSnapshot | null> {
  const otherSelect = { id: true, title: true } as const;
  const [item, relationsFrom, relationsTo, releaseEvents] = await Promise.all([
    prisma.mediaItem.findUnique({
      where: { id: mediaId },
      include: {
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
        credits: { include: { contributor: true }, orderBy: { order: "asc" } },
        externalRatings: {
          select: { source: true, score: true, scale: true },
          orderBy: { source: "asc" },
        },
      },
    }),
    prisma.mediaRelation.findMany({
      where: { fromId: mediaId },
      include: { to: { select: otherSelect } },
    }),
    prisma.mediaRelation.findMany({
      where: { toId: mediaId },
      include: { from: { select: otherSelect } },
    }),
    prisma.mediaReleaseEvent.findMany({ where: { mediaId } }),
  ]);
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
    externalRatings: item.externalRatings
      .filter((rating) => manualRatingDef(rating.source) != null)
      .map((rating) => ({
        source: rating.source,
        score: rating.score,
        scale: rating.scale,
      }))
      .sort((a, b) => a.source.localeCompare(b.source)),
    relations: sortRelations([
      ...relationsFrom.map((relation) => ({
        kind: relation.kind as string,
        direction: "forward" as const,
        otherId: relation.to.id,
        otherTitle: relation.to.title,
      })),
      ...relationsTo.map((relation) => ({
        kind: relation.kind as string,
        direction: "inverse" as const,
        otherId: relation.from.id,
        otherTitle: relation.from.title,
      })),
    ]),
    releaseEvents: sortReleaseEvents(
      releaseEvents.map((event) => ({
        kind: event.kind as string,
        date: event.date.toISOString(),
        title: event.title,
      })),
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
  externalRatings: "External scores",
  relations: "Related titles",
  releaseEvents: "Re-releases",
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
  if (key === "externalRatings" && Array.isArray(value)) {
    return value
      .map(
        (rating: { source: string; score: number; scale: number }) =>
          `${manualRatingDef(rating.source as ExternalRatingSource)?.label ?? rating.source}: ${rating.score}/${rating.scale}`,
      )
      .join(" · ");
  }
  if (key === "relations" && Array.isArray(value)) {
    return (value as SnapshotRelation[])
      .map(
        (relation) =>
          `${
            relation.direction === "forward"
              ? RELATION_FORWARD_LABEL[relation.kind as RelationKind]
              : RELATION_INVERSE_LABEL[relation.kind as RelationKind]
          } ${relation.otherTitle}`,
      )
      .join(" · ");
  }
  if (key === "releaseEvents" && Array.isArray(value)) {
    return (value as SnapshotReleaseEvent[])
      .map(
        (event) =>
          `${RELEASE_KIND_LABEL[event.kind as ReleaseKind]}${
            event.title ? ` "${event.title}"` : ""
          }: ${event.date.slice(0, 10)}`,
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
    externalRatings: [],
    relations: [],
    releaseEvents: [],
  };
}
