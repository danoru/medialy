import type {
  ComparisonContext,
  ImportSourceType,
  MediaStatus,
  MediaType,
  TagStatus,
} from "@prisma/client";

export type MediaItemDTO = {
  id: string;
  title: string;
  originalTitle?: string | null;
  mediaType: MediaType;
  status: MediaStatus;
  description?: string | null;
  releaseDate?: Date | string | null;
  posterUrl?: string | null;
  externalUrl?: string | null;
  metadataJson?: string | null;
  personalRating?: number | null;
  computedPersonalScore?: number | null;
  personalScoreConfidence?: number | null;
  computedConsensusScore?: number | null;
  consensusConfidence?: number | null;
  pairwiseScore: number;
  comparisonCount: number;
  isFavorite: boolean;
  isArchived: boolean;
  updatedAt?: Date | string;
  genres: string[];
  tags: string[];
  tagDetails?: Array<{ name: string; status: TagStatus }>;
};

export type MediaFormInput = {
  title: string;
  originalTitle?: string;
  mediaType: MediaType;
  status: MediaStatus;
  description?: string;
  releaseDate?: Date | null;
  externalUrl?: string;
  metadataJson?: string;
  personalRating?: number | null;
  isFavorite: boolean;
  genres: string[];
  tags: string[];
};

export type PairwiseComparisonInput = {
  winnerId: string;
  loserId: string;
  context?: ComparisonContext;
  weight?: number;
  notes?: string;
};

export type RecommendationReason = {
  label: string;
  value: number;
};

export type Recommendation = {
  media: MediaItemDTO;
  score: number;
  confidence: number;
  reasons: RecommendationReason[];
};

export type GenreInsight = {
  name: string;
  count: number;
  completedCount: number;
  averageScore: number;
  share: number;
  needsData: boolean;
};

export type DataHealthReport = {
  missingGenres: MediaItemDTO[];
  missingDates: MediaItemDTO[];
  missingPosters: MediaItemDTO[];
  lowComparisonItems: MediaItemDTO[];
  duplicateCandidates: Array<{ key: string; items: MediaItemDTO[] }>;
};

export type CsvMediaRow = {
  title: string;
  mediaType: string;
  status: string;
  originalTitle?: string;
  releaseDate?: string;
  personalRating?: string;
  genres?: string;
  tags?: string;
  description?: string;
  externalUrl?: string;
  isFavorite?: string;
};

export type MediaImportField = keyof CsvMediaRow;

export type MediaImportMapping = Partial<Record<MediaImportField, string>>;

export type LetterboxdImportRole = "watchlist" | "watched";

export type LetterboxdCsvRow = {
  Date?: string;
  Name?: string;
  Year?: string;
  "Letterboxd URI"?: string;
  Rating?: string;
  [key: string]: string | undefined;
};

export type TabularMediaRows = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

export type ImportPreview = {
  valid: boolean;
  creates: number;
  updates: number;
  errors: Array<{ row: number; message: string }>;
  rows: MediaFormInput[];
};

export type ImportResult = {
  importedCount: number;
  skippedCount: number;
  errors: Array<{ row: number; message: string }>;
};

export type MedialyExport = {
  version: 1;
  exportedAt: string;
  media: unknown[];
  genres: unknown[];
  tags: unknown[];
  comparisons: unknown[];
  notes: unknown[];
  lists: unknown[];
  friends: unknown[];
  friendRatings: unknown[];
  importJobs: unknown[];
};

export type FriendCompatibility = {
  friendId: string;
  friendName: string;
  overlapCount: number;
  compatibilityScore: number;
  averageDistance: number | null;
  explanation: string;
};

export type ExportBundleName = ImportSourceType | "MEDIA_CSV";
