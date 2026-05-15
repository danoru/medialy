import type {
  MediaItem,
  MediaType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MediaFormInput, MediaItemDTO } from "@/lib/types";
import { normalizeSearchText } from "@/lib/text-normalization";
import {
  canonicalTagMetadataForName,
  normalizeTagKey,
  normalizeTagName,
} from "@/lib/taxonomy";

const includeTaxonomy = {
  genres: { include: { genre: true } },
  tags: { include: { tag: true } },
} as const;

type MediaWithTaxonomy = MediaItem & {
  genres: Array<{ genre: { name: string } }>;
  tags: Array<{
    tag: { name: string; status: "APPROVED" | "PENDING" | "REJECTED" };
  }>;
};

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export function toMediaItemDTO(item: MediaWithTaxonomy): MediaItemDTO {
  return {
    ...item,
    genres: item.genres.map((entry) => entry.genre.name).sort(),
    tags: item.tags.map((entry) => entry.tag.name).sort(),
    tagDetails: item.tags
      .map((entry) => ({
        name: entry.tag.name,
        status: entry.tag.status,
      }))
      .sort((first, second) => first.name.localeCompare(second.name)),
  };
}

export async function getMediaItemDTO(id: string) {
  const item = await prisma.mediaItem.findUnique({
    where: { id },
    include: includeTaxonomy,
  });

  return item ? toMediaItemDTO(item) : null;
}

export async function getMediaItemDTOs(where: Prisma.MediaItemWhereInput = {}) {
  const items = await prisma.mediaItem.findMany({
    where,
    include: includeTaxonomy,
    orderBy: [{ title: "asc" }],
  });

  return items.map(toMediaItemDTO);
}

export async function upsertTaxonomy(
  mediaId: string,
  genres: string[],
  tags: string[],
) {
  await prisma.mediaGenre.deleteMany({ where: { mediaId } });
  await prisma.mediaTag.deleteMany({ where: { mediaId } });

  for (const name of [...new Set(genres)]) {
    const genre = await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    await prisma.mediaGenre.create({ data: { mediaId, genreId: genre.id } });
  }

  const normalizedTags = [
    ...new Map(
      tags
        .map((rawName) => normalizeTagName(rawName))
        .filter(Boolean)
        .map((name) => [normalizeTagKey(name), name]),
    ).values(),
  ];

  for (const name of normalizedTags) {
    const metadata = canonicalTagMetadataForName(name);
    const tag = await prisma.tag.upsert({
      where: { normalizedName: normalizeTagKey(name) },
      update: metadata
        ? {
            category: metadata.category,
            discoverable: metadata.discoverable,
            mediaTypesJson: metadata.mediaTypes
              ? JSON.stringify(metadata.mediaTypes)
              : undefined,
            countryCode: metadata.countryCode,
            status: "APPROVED",
            approvedAt: new Date(),
          }
        : {},
      create: {
        name,
        normalizedName: normalizeTagKey(name),
        status: metadata ? "APPROVED" : "PENDING",
        category: metadata?.category ?? "THEME",
        discoverable: metadata?.discoverable ?? false,
        mediaTypesJson: metadata?.mediaTypes
          ? JSON.stringify(metadata.mediaTypes)
          : undefined,
        countryCode: metadata?.countryCode,
        approvedAt: metadata ? new Date() : undefined,
      },
    });
    await prisma.mediaTag.create({ data: { mediaId, tagId: tag.id } });
  }
}

export function mediaMutationData(input: MediaFormInput) {
  return {
    title: input.title,
    originalTitle: input.originalTitle || null,
    mediaType: input.mediaType,
    status: input.status,
    description: input.description || null,
    releaseDate: input.releaseDate,
    externalUrl: input.externalUrl || null,
    metadataJson: input.metadataJson || null,
    personalRating: input.personalRating,
    isFavorite: input.isFavorite,
  };
}

export async function mediaMutationDataWithUniqueTitle(
  client: PrismaLike,
  input: MediaFormInput,
  excludeId?: string,
) {
  return {
    ...mediaMutationData(input),
    title: await uniqueMediaTitle(client, input, excludeId),
  };
}

export async function findExistingMediaItem(
  client: PrismaLike,
  input: Pick<MediaFormInput, "title" | "mediaType" | "releaseDate">,
  excludeId?: string,
) {
  const items = await client.mediaItem.findMany({
    where: { mediaType: input.mediaType },
    select: { id: true, title: true, releaseDate: true },
  });
  const inputKey = mediaTitleKey(input.title, input.mediaType);
  const inputYear = mediaReleaseYear(input.releaseDate);

  return (
    items.find((item) => {
      if (item.id === excludeId) return false;
      if (mediaTitleKey(item.title, input.mediaType) !== inputKey) return false;

      const itemYear = mediaReleaseYear(item.releaseDate);
      return !inputYear || !itemYear || inputYear === itemYear;
    }) ?? null
  );
}

export function mediaTitleBase(value: string) {
  return value
    .trim()
    .replace(/\s+\(\d{4}\)$/, "")
    .replace(/\s+/g, " ");
}

export function mediaTitleKey(value: string, mediaType: MediaType | string) {
  return `${normalizeSearchText(mediaTitleBase(value))}::${String(mediaType).toUpperCase()}`;
}

export function mediaReleaseYear(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear();
}

async function uniqueMediaTitle(
  client: PrismaLike,
  input: MediaFormInput,
  excludeId?: string,
) {
  const items = await client.mediaItem.findMany({
    where: { mediaType: input.mediaType },
    select: { id: true, title: true, releaseDate: true },
  });
  const inputKey = mediaTitleKey(input.title, input.mediaType);
  const collisions = items.filter(
    (item) =>
      item.id !== excludeId &&
      mediaTitleKey(item.title, input.mediaType) === inputKey,
  );

  if (collisions.length === 0) return input.title;

  const baseTitle = mediaTitleBase(input.title);
  const usedTitles = new Map(
    items.map((item) => [item.title.toLowerCase(), item.id]),
  );

  for (const item of collisions) {
    const year = mediaReleaseYear(item.releaseDate);
    if (!year) continue;

    const nextTitle = availableDatedTitle(baseTitle, year, item.id, usedTitles);
    if (nextTitle === item.title) continue;

    usedTitles.delete(item.title.toLowerCase());
    usedTitles.set(nextTitle.toLowerCase(), item.id);
    await client.mediaItem.update({
      where: { id: item.id },
      data: { title: nextTitle },
    });
  }

  const inputYear = mediaReleaseYear(input.releaseDate);
  if (!inputYear) return input.title;

  return availableDatedTitle(baseTitle, inputYear, excludeId, usedTitles);
}

function availableDatedTitle(
  baseTitle: string,
  year: number,
  ownerId: string | undefined,
  usedTitles: Map<string, string>,
) {
  const title = `${baseTitle} (${year})`;
  const existingOwner = usedTitles.get(title.toLowerCase());
  if (!existingOwner || existingOwner === ownerId) return title;

  let index = 2;
  while (true) {
    const fallbackTitle = `${baseTitle} (${year} ${index})`;
    const fallbackOwner = usedTitles.get(fallbackTitle.toLowerCase());
    if (!fallbackOwner || fallbackOwner === ownerId) return fallbackTitle;
    index += 1;
  }
}
