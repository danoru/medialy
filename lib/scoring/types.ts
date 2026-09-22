import type { ExternalRatingSource, MediaType } from "@prisma/client";

export type ScoredGenre = { genre: { name: string } };
export type ScoredTag = {
  tag: { name: string; status?: string; category?: string | null };
};
export type ScoredCredit = {
  role: string;
  contributor: { id: string; name: string };
};

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
  credits?: ScoredCredit[];
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
