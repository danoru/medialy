import type {
  ComparisonContext,
  ContributorKind,
  CreditRole,
  ExternalRatingSource,
  ImportSourceType,
  MediaStatus,
  MediaType,
  RelationKind,
  ReleaseKind,
  TagStatus,
} from "@prisma/client";
import type { MedialyMatchExplanation } from "@/lib/scoring/medialyMatch";

export type ExternalRatingDTO = {
  source: ExternalRatingSource;
  score: number;
  scale: number;
};

export type ExternalRatingInput = {
  source: ExternalRatingSource;
  score: number;
  scale: number;
};

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
  credits?: Array<{
    role: CreditRole;
    kind: ContributorKind;
    name: string;
    order: number;
  }>;
  externalRatings?: ExternalRatingDTO[];
};

/**
 * A proposed shared-catalog item, plus (optionally) the submitter's own
 * `UserMedia` fields.
 *
 * The per-user fields are optional because only the CSV/XLSX import path
 * supplies them — a Letterboxd export legitimately carries your rating and
 * watched status. The metadata *form* no longer collects them at all, so they
 * arrive `undefined` there and `userMediaMutationData` skips them.
 */
export type MediaFormInput = {
  title: string;
  originalTitle?: string;
  mediaType: MediaType;
  /** Import-only. The edit/create form does not collect this. */
  status?: MediaStatus;
  description?: string;
  releaseDate?: Date | null;
  externalUrl?: string;
  metadataJson?: string;
  /** Import-only. The edit/create form does not collect this. */
  personalRating?: number | null;
  /** Import-only. The edit/create form does not collect this. */
  isFavorite?: boolean;
  genres: string[];
  tags: string[];
  credits?: Array<{
    role: CreditRole;
    kind: ContributorKind;
    names: string[];
  }>;
  externalRatings?: ExternalRatingInput[];
  /**
   * The complete desired set of relations / re-releases for this item.
   *
   * `undefined` means "this caller doesn't manage connections" (CSV import) and
   * they're left untouched. An empty array means "there are none" and any
   * existing rows are removed. The distinction matters — conflating them would
   * let an import silently wipe curated links.
   */
  relations?: MediaRelationInput[];
  releaseEvents?: MediaReleaseEventInput[];
};

export type MediaRelationInput = {
  kind: RelationKind;
  /** "forward" = this item is the `from` side of the edge. */
  direction: "forward" | "inverse";
  otherId: string;
  otherTitle: string;
};

export type MediaReleaseEventInput = {
  kind: ReleaseKind;
  /** ISO timestamp. */
  date: string;
  title: string | null;
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
  explanations?: MedialyMatchExplanation[];
};

export type GenreInsight = {
  name: string;
  count: number;
  completedCount: number;
  ratedCount: number;
  averageScore: number;
  share: number;
  needsData: boolean;
};

export type InsightScoreBand = {
  label: string;
  count: number;
  share: number;
};

export type InsightMomentumGenre = {
  name: string;
  averageScore: number;
  recentAverageScore: number;
  momentum: number;
  ratedCount: number;
  recentRatedCount: number;
};

export type InsightStandoutTitle = {
  id: string;
  title: string;
  mediaType: MediaType;
  releaseYear: number | null;
  posterUrl?: string | null;
  score: number;
  genres: string[];
};

export type MediaTypeGenreInsights = {
  mediaType: MediaType;
  totalCount: number;
  completedCount: number;
  ratedCount: number;
  averageScore: number;
  coverage: number;
  completedRatio: number;
  genres: GenreInsight[];
  scoreBands: InsightScoreBand[];
  risingGenres: InsightMomentumGenre[];
  standoutTitles: InsightStandoutTitle[];
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
  directors?: string;
  creators?: string;
  developers?: string;
  publishers?: string;
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
  importJobs: unknown[];
};

/**
 * Compatibility between the viewer and one user they follow. Mirrors the old
 * `FriendCompatibility` shape but keyed by `userId`, since "friend" now refers
 * to a real platform user rather than a manual entry.
 */
export type FollowCompatibility = {
  userId: string;
  displayName: string;
  image: string | null;
  avatarColor: string | null;
  overlapCount: number;
  compatibilityScore: number;
  averageDistance: number | null;
  explanation: string;
};

export type ExportBundleName = ImportSourceType | "MEDIA_CSV";
