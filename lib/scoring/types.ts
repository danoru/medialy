import type { ExternalRatingSource, MediaType } from "@prisma/client";

export type ScoredGenre = { genre: { name: string } };
export type ScoredTag = { tag: { name: string } };

export type ScoredMediaItem = {
  mediaType: MediaType;
  personalRating: number | null;
  computedPersonalScore?: number | null;
  personalScoreConfidence?: number | null;
  computedConsensusScore?: number | null;
  consensusConfidence?: number | null;
  pairwiseScore: number;
  comparisonCount: number;
  releaseDate?: Date | string | null;
  genres?: ScoredGenre[];
  tags?: ScoredTag[];
};

export type ExternalRatingLike = {
  source: ExternalRatingSource;
  score: number;
  scale: number;
  fetchedAt?: Date | string;
};

export type MedialyMatchReason = {
  label: string;
  value: number;
};
