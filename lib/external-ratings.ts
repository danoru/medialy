import type { ExternalRatingSource, MediaType } from "@prisma/client";
import type { ExternalRatingInput } from "@/lib/types";

export type ManualExternalRatingDef = {
  source: ExternalRatingSource;
  label: string;
  field: string;
  scale: number;
  mediaTypes: MediaType[];
};

export const MANUAL_EXTERNAL_RATING_DEFS: ManualExternalRatingDef[] = [
  {
    source: "METACRITIC",
    label: "Metacritic",
    field: "externalRating:METACRITIC",
    scale: 100,
    mediaTypes: ["MOVIE", "TV_SHOW", "VIDEO_GAME"],
  },
  {
    source: "OPENCRITIC",
    label: "OpenCritic",
    field: "externalRating:OPENCRITIC",
    scale: 100,
    // Games only, matching SOURCE_MEDIA_APPLICABILITY in lib/scoring/config.ts.
    mediaTypes: ["VIDEO_GAME"],
  },
  {
    source: "ROTTEN_TOMATOES_CRITICS",
    label: "Rotten Tomatoes (Critics)",
    field: "externalRating:ROTTEN_TOMATOES_CRITICS",
    scale: 100,
    mediaTypes: ["MOVIE", "TV_SHOW"],
  },
];

export function manualRatingsForMediaType(mediaType: MediaType) {
  return MANUAL_EXTERNAL_RATING_DEFS.filter((def) =>
    def.mediaTypes.includes(mediaType),
  );
}

export function manualRatingDef(source: ExternalRatingSource) {
  return MANUAL_EXTERNAL_RATING_DEFS.find((def) => def.source === source);
}

/** Checkbox field paired with each score input, for clearing it outright. */
export function manualRatingRemoveField(source: ExternalRatingSource) {
  return `externalRatingRemove:${source}`;
}

/**
 * Which scores the user ticked "remove" on. An unchecked box submits nothing,
 * so absence means "leave it alone" — the safe default.
 */
export function parseManualExternalRatingRemovals(
  formData: FormData,
  mediaType: MediaType,
): ExternalRatingSource[] {
  return manualRatingsForMediaType(mediaType)
    .filter((def) => formData.get(manualRatingRemoveField(def.source)) != null)
    .map((def) => def.source);
}

export type ManualRatingWrite =
  | {
      source: ExternalRatingSource;
      action: "upsert";
      score: number;
      scale: number;
    }
  | { source: ExternalRatingSource; action: "delete" };

/**
 * Decide what a form submit should do to an item's manual external scores.
 *
 * Pure, and deliberately so: the invariant this encodes — *a blank field
 * produces no write at all* — is the one that used to be violated, silently
 * deleting curated scores on every edit. Keeping it as data rather than
 * control flow makes it testable without a database.
 */
export function planManualExternalRatingWrites(
  mediaType: MediaType,
  ratings: ExternalRatingInput[] | undefined,
  removals: ExternalRatingSource[] | undefined,
): ManualRatingWrite[] {
  const provided = new Map(
    (ratings ?? []).map((rating) => [rating.source, rating]),
  );
  const removalSet = new Set(removals ?? []);
  const writes: ManualRatingWrite[] = [];

  for (const def of manualRatingsForMediaType(mediaType)) {
    const next = provided.get(def.source);
    if (next) {
      writes.push({
        source: def.source,
        action: "upsert",
        score: next.score,
        scale: next.scale,
      });
    } else if (removalSet.has(def.source)) {
      writes.push({ source: def.source, action: "delete" });
    }
    // Blank, and not explicitly removed: no write. This is the whole point.
  }

  return writes;
}

export function parseManualExternalRatings(
  formData: FormData,
  mediaType: MediaType,
): ExternalRatingInput[] {
  const ratings: ExternalRatingInput[] = [];
  for (const def of manualRatingsForMediaType(mediaType)) {
    const raw = String(formData.get(def.field) ?? "").trim();
    if (!raw) continue;
    const score = Number(raw);
    if (!Number.isFinite(score)) {
      throw new Error(`Invalid ${def.label} score: ${raw}`);
    }
    if (score < 0 || score > def.scale) {
      throw new Error(
        `${def.label} score must be between 0 and ${def.scale}: ${raw}`,
      );
    }
    ratings.push({ source: def.source, score, scale: def.scale });
  }
  return ratings;
}
