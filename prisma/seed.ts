import { PrismaClient, type MediaStatus, type MediaType } from "@prisma/client";
import {
  canonicalTagMetadataForName,
  normalizeTagKey,
  normalizeTagName,
} from "../lib/taxonomy";

const prisma = new PrismaClient();

type SeedMediaItem = {
  title: string;
  mediaType: MediaType;
  status: MediaStatus;
  description: string;
  releaseDate?: string;
  personalRating?: number;
  genres: string[];
  tags: string[];
  isFavorite?: boolean;
};

const mediaItems: SeedMediaItem[] = [
  {
    title: "The Matrix",
    mediaType: "MOVIE",
    status: "COMPLETED",
    description: "A reality-bending sci-fi action classic.",
    releaseDate: "1999-03-31",
    personalRating: 9.5,
    genres: ["Science Fiction", "Action"],
    tags: ["Rewatchable", "Cyberpunk"],
    isFavorite: true,
  },
  {
    title: "Severance",
    mediaType: "TV_SHOW",
    status: "WATCHLIST",
    description: "A workplace mystery about memory and identity.",
    releaseDate: "2022-02-18",
    genres: ["Drama", "Mystery", "Science Fiction"],
    tags: ["Slow Burn", "Prestige"],
  },
  {
    title: "The Legend of Zelda: Breath of the Wild",
    mediaType: "VIDEO_GAME",
    status: "COMPLETED",
    description: "Open-world exploration built around curiosity and systems.",
    releaseDate: "2017-03-03",
    personalRating: 9.7,
    genres: ["Adventure"],
    tags: ["Open World", "Exploration", "Systems"],
    isFavorite: true,
  },
  {
    title: "Dune: Part Two",
    mediaType: "MOVIE",
    status: "WATCHLIST",
    description: "A large-scale sci-fi continuation with political spectacle.",
    releaseDate: "2024-03-01",
    genres: ["Science Fiction", "Drama"],
    tags: ["Epic", "Cinematic"],
  },
  {
    title: "Hades II",
    mediaType: "VIDEO_GAME",
    status: "BACKLOG",
    description: "A mythological roguelike action game.",
    releaseDate: "2024-05-06",
    genres: ["Action"],
    tags: ["Roguelike", "Fast", "Replayable"],
  },
  {
    title: "Andor",
    mediaType: "TV_SHOW",
    status: "COMPLETED",
    description: "A grounded political thriller in a sci-fi setting.",
    releaseDate: "2022-09-21",
    personalRating: 9.2,
    genres: ["Science Fiction", "Drama"],
    tags: ["Political", "Tense"],
  },
];

async function connectGenres(mediaId: string, names: string[]) {
  for (const name of names) {
    const genre = await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    await prisma.mediaGenre.upsert({
      where: { mediaId_genreId: { mediaId, genreId: genre.id } },
      update: {},
      create: { mediaId, genreId: genre.id },
    });
  }
}

async function connectTags(mediaId: string, names: string[]) {
  for (const rawName of names) {
    const name = normalizeTagName(rawName);
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
          }
        : {},
      create: {
        name,
        normalizedName: normalizeTagKey(name),
        status: "APPROVED",
        category: metadata?.category ?? "THEME",
        discoverable: metadata?.discoverable ?? false,
        mediaTypesJson: metadata?.mediaTypes
          ? JSON.stringify(metadata.mediaTypes)
          : undefined,
        countryCode: metadata?.countryCode,
        approvedAt: new Date(),
      },
    });

    await prisma.mediaTag.upsert({
      where: { mediaId_tagId: { mediaId, tagId: tag.id } },
      update: {},
      create: { mediaId, tagId: tag.id },
    });
  }
}

async function main() {
  for (const item of mediaItems) {
    const media = await prisma.mediaItem.upsert({
      where: {
        title_mediaType: {
          title: item.title,
          mediaType: item.mediaType,
        },
      },
      update: {
        status: item.status,
        description: item.description,
        releaseDate: item.releaseDate ? new Date(item.releaseDate) : null,
        personalRating: item.personalRating ?? null,
        pairwiseScore: 1000,
        comparisonCount: 0,
        isFavorite: item.isFavorite ?? false,
      },
      create: {
        title: item.title,
        mediaType: item.mediaType,
        status: item.status,
        description: item.description,
        releaseDate: item.releaseDate ? new Date(item.releaseDate) : undefined,
        personalRating: item.personalRating,
        pairwiseScore: 1000,
        comparisonCount: 0,
        isFavorite: item.isFavorite ?? false,
      },
    });

    await connectGenres(media.id, item.genres);
    await connectTags(media.id, item.tags);
  }

  const watchlist = await prisma.customList.upsert({
    where: { name: "Starter Watchlist" },
    update: {},
    create: {
      name: "Starter Watchlist",
      kind: "WATCHLIST",
      description: "Seeded examples for the first Medialy dashboard.",
    },
  });

  const watchlistItems = await prisma.mediaItem.findMany({
    where: { status: { in: ["WATCHLIST", "BACKLOG"] } },
    orderBy: { pairwiseScore: "desc" },
  });

  for (const [index, media] of watchlistItems.entries()) {
    await prisma.listItem.upsert({
      where: { listId_mediaId: { listId: watchlist.id, mediaId: media.id } },
      update: { rank: index + 1 },
      create: {
        listId: watchlist.id,
        mediaId: media.id,
        rank: index + 1,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
