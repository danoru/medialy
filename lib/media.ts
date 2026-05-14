import type { MediaItem, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MediaFormInput, MediaItemDTO } from "@/lib/types";
import { normalizeTagKey, normalizeTagName } from "@/lib/taxonomy";

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
    const tag = await prisma.tag.upsert({
      where: { normalizedName: normalizeTagKey(name) },
      update: {},
      create: {
        name,
        normalizedName: normalizeTagKey(name),
        status: "PENDING",
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
