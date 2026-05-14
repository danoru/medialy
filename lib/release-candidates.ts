import {
  ExternalReleaseSource,
  MediaStatus,
  MediaType,
  ReleaseCandidateStatus,
  type ReleaseCandidate,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mediaMutationData, upsertTaxonomy } from "@/lib/media";
import { splitGenresAndTags, normalizeTagName } from "@/lib/taxonomy";

export type CandidateReason = {
  label: string;
  value: number;
};

export type ReleaseCandidateInput = {
  mediaType: MediaType;
  title: string;
  externalSource: ExternalReleaseSource;
  externalId: string;
  externalUrl?: string | null;
  description?: string | null;
  posterUrl?: string | null;
  releaseDate?: Date | null;
  genres?: string[];
  tags?: string[];
  companies?: string[];
  platforms?: string[];
  metadata?: unknown;
  sourceSignals?: {
    popularity?: number | null;
    voteCount?: number | null;
    voteAverage?: number | null;
    hypes?: number | null;
    follows?: number | null;
    rating?: number | null;
  };
};

export type CandidateScore = {
  publicInterestScore: number;
  localAffinityScore: number;
  indieSignalScore: number;
  qualityScore: number;
  confidenceScore: number;
  finalScore: number;
  reasons: CandidateReason[];
};

export async function upsertReleaseCandidate(input: ReleaseCandidateInput) {
  const normalizedTitle = normalizeTitle(input.title);
  const taxonomy = normalizeCandidateTaxonomy(input);
  const score = await scoreReleaseCandidate(input);
  const data = {
    mediaType: input.mediaType,
    title: input.title.trim(),
    normalizedTitle,
    externalUrl: input.externalUrl || null,
    description: input.description || null,
    posterUrl: input.posterUrl || null,
    releaseDate: input.releaseDate ?? null,
    genresJson: stringifyList(taxonomy.genres),
    tagsJson: stringifyList(taxonomy.tags),
    companiesJson: stringifyList(input.companies),
    platformsJson: stringifyList(input.platforms),
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    publicInterestScore: score.publicInterestScore,
    localAffinityScore: score.localAffinityScore,
    indieSignalScore: score.indieSignalScore,
    qualityScore: score.qualityScore,
    confidenceScore: score.confidenceScore,
    finalScore: score.finalScore,
    reasonJson: JSON.stringify(score.reasons),
    fetchedAt: new Date(),
  };

  return prisma.releaseCandidate.upsert({
    where: {
      externalSource_externalId: {
        externalSource: input.externalSource,
        externalId: input.externalId,
      },
    },
    update: data,
    create: {
      ...data,
      externalSource: input.externalSource,
      externalId: input.externalId,
      status:
        score.finalScore >= 75
          ? ReleaseCandidateStatus.PENDING
          : ReleaseCandidateStatus.IGNORED,
    },
  });
}

export async function scoreReleaseCandidate(
  input: ReleaseCandidateInput,
): Promise<CandidateScore> {
  const [affinity, duplicate] = await Promise.all([
    getLocalAffinity(input.mediaType),
    findExistingMediaMatch(input),
  ]);

  const taxonomy = normalizeCandidateTaxonomy(input);
  const genres = taxonomy.genres;
  const tags = taxonomy.tags;
  const companies = normalizeList(input.companies);
  const reasons: CandidateReason[] = [];

  const publicInterestScore = publicInterest(input.sourceSignals);
  pushReason(reasons, "Public interest", publicInterestScore);

  const genreAffinity = genres.reduce(
    (total, genre) => total + (affinity.genres.get(genre.toLowerCase()) ?? 0),
    0,
  );
  const tagAffinity = tags.reduce(
    (total, tag) => total + (affinity.tags.get(tag.toLowerCase()) ?? 0),
    0,
  );
  const localAffinityScore = clamp(genreAffinity + tagAffinity, 0, 35);
  pushReason(reasons, "Local affinity", localAffinityScore);

  const indieSignalScore = getIndieSignal(
    input.mediaType,
    tags,
    companies,
    input.sourceSignals,
  );
  pushReason(reasons, "Indie signal", indieSignalScore);

  const qualityScore = qualitySignal(input);
  pushReason(reasons, "Metadata quality", qualityScore);

  const confidenceScore = confidenceSignal(input);
  pushReason(reasons, "Source confidence", confidenceScore);

  const releaseBoost = upcomingBoost(input.releaseDate ?? null);
  pushReason(reasons, "Release soon", releaseBoost);

  const duplicatePenalty = duplicate ? 100 : 0;
  if (duplicatePenalty)
    reasons.push({ label: "Already in library", value: -duplicatePenalty });

  const finalScore = clamp(
    publicInterestScore +
      localAffinityScore +
      indieSignalScore +
      qualityScore +
      confidenceScore +
      releaseBoost -
      duplicatePenalty,
    0,
    100,
  );

  return {
    publicInterestScore,
    localAffinityScore,
    indieSignalScore,
    qualityScore,
    confidenceScore,
    finalScore,
    reasons,
  };
}

export async function importReleaseCandidate(id: string) {
  const candidate = await prisma.releaseCandidate.findUnique({ where: { id } });
  if (!candidate) return null;

  const genres = parseList(candidate.genresJson);
  const tags = parseList(candidate.tagsJson);
  const metadata = {
    releaseCandidate: {
      id: candidate.id,
      source: candidate.externalSource,
      externalId: candidate.externalId,
      importedAt: new Date().toISOString(),
    },
    source: parseJson(candidate.metadataJson),
  };
  const existing = await findExistingMediaMatch({
    mediaType: candidate.mediaType,
    title: candidate.title,
    externalSource: candidate.externalSource,
    externalId: candidate.externalId,
    externalUrl: candidate.externalUrl,
    releaseDate: candidate.releaseDate,
  });
  const status =
    candidate.mediaType === MediaType.VIDEO_GAME
      ? MediaStatus.BACKLOG
      : MediaStatus.WATCHLIST;

  const mediaData = mediaMutationData({
    title: candidate.title,
    mediaType: candidate.mediaType,
    status,
    description: candidate.description ?? undefined,
    releaseDate: candidate.releaseDate,
    externalUrl: candidate.externalUrl ?? undefined,
    metadataJson: JSON.stringify(metadata),
    personalRating: null,
    isFavorite: false,
    genres,
    tags,
  });

  const media = existing
    ? await prisma.mediaItem.update({
        where: { id: existing.id },
        data: mediaData,
      })
    : await prisma.mediaItem.create({ data: mediaData });

  await upsertTaxonomy(media.id, genres, tags);
  await prisma.releaseCandidate.update({
    where: { id },
    data: { status: ReleaseCandidateStatus.IMPORTED },
  });

  return media;
}

export async function setReleaseCandidateStatus(
  id: string,
  status: ReleaseCandidateStatus,
) {
  return prisma.releaseCandidate.update({ where: { id }, data: { status } });
}

export function candidateReasons(
  candidate: Pick<ReleaseCandidate, "reasonJson">,
) {
  const parsed = parseJson(candidate.reasonJson);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (reason): reason is CandidateReason =>
      reason &&
      typeof reason === "object" &&
      typeof reason.label === "string" &&
      typeof reason.value === "number",
  );
}

export function parseList(value: string | null | undefined) {
  const parsed = parseJson(value);
  return Array.isArray(parsed)
    ? parsed.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function normalizeTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function findExistingMediaMatch(
  input: Pick<
    ReleaseCandidateInput,
    | "mediaType"
    | "title"
    | "externalSource"
    | "externalId"
    | "externalUrl"
    | "releaseDate"
  >,
) {
  const normalizedTitle = normalizeTitle(input.title);
  const items = await prisma.mediaItem.findMany({
    where: {
      mediaType: input.mediaType,
      OR: [
        input.externalUrl ? { externalUrl: input.externalUrl } : undefined,
        { title: { equals: input.title } },
      ].filter(Boolean) as Array<
        { externalUrl: string } | { title: { equals: string } }
      >,
    },
    select: {
      id: true,
      title: true,
      releaseDate: true,
      metadataJson: true,
    },
  });

  const inputYear = yearFromDate(input.releaseDate ?? null);
  return (
    items.find((item) => {
      if (
        metadataHasExternalId(
          item.metadataJson,
          input.externalSource,
          input.externalId,
        )
      )
        return true;
      if (normalizeTitle(item.title) !== normalizedTitle) return false;
      const itemYear = yearFromDate(item.releaseDate ?? null);
      return !inputYear || !itemYear || inputYear === itemYear;
    }) ?? null
  );
}

async function getLocalAffinity(mediaType: MediaType) {
  const completed = await prisma.mediaItem.findMany({
    where: {
      mediaType,
      isArchived: false,
      status: MediaStatus.COMPLETED,
      OR: [
        { computedPersonalScore: { gte: 8 } },
        { personalRating: { gte: 8 } },
        { pairwiseScore: { gte: 1150 } },
      ],
    },
    include: {
      genres: { include: { genre: true } },
      tags: { where: { tag: { status: "APPROVED" } }, include: { tag: true } },
    },
  });

  const genres = new Map<string, number>();
  const tags = new Map<string, number>();

  for (const item of completed) {
    const boost = Math.max(
      3,
      Math.min(
        8,
        ((item.computedPersonalScore ?? item.pairwiseScore / 100) - 5) * 2,
      ),
    );
    for (const entry of item.genres)
      genres.set(
        entry.genre.name.toLowerCase(),
        (genres.get(entry.genre.name.toLowerCase()) ?? 0) + boost,
      );
    for (const entry of item.tags)
      tags.set(
        entry.tag.name.toLowerCase(),
        (tags.get(entry.tag.name.toLowerCase()) ?? 0) + boost * 0.3,
      );
  }

  return { genres, tags };
}

function publicInterest(signals: ReleaseCandidateInput["sourceSignals"]) {
  if (!signals) return 0;
  const popularity = Math.log10((signals.popularity ?? 0) + 1) * 14;
  const votes = Math.log10((signals.voteCount ?? 0) + 1) * 7;
  const hypes = Math.log10((signals.hypes ?? 0) + 1) * 11;
  const follows = Math.log10((signals.follows ?? 0) + 1) * 8;
  const rating = Math.max(
    0,
    ((signals.voteAverage ?? signals.rating ?? 0) - 6) * 4,
  );
  return clamp(popularity + votes + hypes + follows + rating, 0, 35);
}

function getIndieSignal(
  mediaType: MediaType,
  tags: string[],
  companies: string[],
  signals: ReleaseCandidateInput["sourceSignals"],
) {
  const haystack = [...tags, ...companies].join(" ");
  const explicitIndie = /\bindie|independent|self[- ]published\b/i.test(
    haystack,
  );
  if (!explicitIndie && mediaType !== MediaType.VIDEO_GAME) return 0;
  const lowPublicSignal =
    (signals?.popularity ?? signals?.hypes ?? signals?.follows ?? 0) < 40;
  return explicitIndie ? (lowPublicSignal ? 16 : 10) : 0;
}

function qualitySignal(input: ReleaseCandidateInput) {
  let score = 0;
  if (input.description) score += 5;
  if (input.posterUrl) score += 5;
  if (input.releaseDate) score += 5;
  if (input.genres?.length) score += 5;
  return score;
}

function confidenceSignal(input: ReleaseCandidateInput) {
  let score = 8;
  if (input.externalUrl) score += 4;
  if (
    input.externalSource === ExternalReleaseSource.TMDB ||
    input.externalSource === ExternalReleaseSource.IGDB
  )
    score += 6;
  if (input.releaseDate) score += 4;
  return clamp(score, 0, 20);
}

function upcomingBoost(date: Date | null) {
  if (!date) return 0;
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 0;
  if (days <= 30) return 10;
  if (days <= 90) return 7;
  if (days <= 180) return 4;
  return 0;
}

function stringifyList(value: string[] | undefined) {
  const normalized = normalizeList(value);
  return normalized.length ? JSON.stringify(normalized) : null;
}

function normalizeList(value: string[] | undefined) {
  return [
    ...new Set((value ?? []).map((entry) => entry.trim()).filter(Boolean)),
  ];
}

function normalizeCandidateTaxonomy(input: ReleaseCandidateInput) {
  const split = splitGenresAndTags(input.mediaType, input.genres ?? []);
  const tags = [
    ...split.tags,
    ...(input.tags ?? []).map(normalizeTagName).filter(Boolean),
  ];

  return {
    genres: split.genres,
    tags: [...new Set(tags)],
  };
}

function pushReason(reasons: CandidateReason[], label: string, value: number) {
  if (Math.round(value) !== 0)
    reasons.push({ label, value: Math.round(value) });
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function metadataHasExternalId(
  metadataJson: string | null,
  source: ExternalReleaseSource,
  externalId: string,
) {
  const metadata = parseJson(metadataJson);
  if (!metadata || typeof metadata !== "object") return false;
  const text = JSON.stringify(metadata);
  return text.includes(source) && text.includes(externalId);
}

function yearFromDate(date: Date | null) {
  return date ? date.getUTCFullYear() : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
