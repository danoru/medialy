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
