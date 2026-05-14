-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'TV_SHOW', 'VIDEO_GAME', 'BOOK', 'BOARD_GAME', 'MUSIC', 'MUSICAL');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('UNTRACKED', 'WATCHLIST', 'BACKLOG', 'IN_PROGRESS', 'COMPLETED', 'DROPPED', 'PAUSED');

-- CreateEnum
CREATE TYPE "ComparisonContext" AS ENUM ('OVERALL', 'REWATCHABILITY', 'STORY', 'GAMEPLAY', 'VISUALS', 'MUSIC', 'COMFORT', 'SOCIAL');

-- CreateEnum
CREATE TYPE "ListKind" AS ENUM ('WATCHLIST', 'FAVORITES', 'TOP_LIST', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExternalReleaseSource" AS ENUM ('TMDB', 'TVMAZE', 'IGDB', 'RAWG');

-- CreateEnum
CREATE TYPE "ReleaseCandidateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IMPORTED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('JSON', 'CSV', 'XLSX');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT,
    "mediaType" "MediaType" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'UNTRACKED',
    "description" TEXT,
    "releaseDate" TIMESTAMP(3),
    "upcomingDate" TIMESTAMP(3),
    "posterUrl" TEXT,
    "externalUrl" TEXT,
    "metadataJson" TEXT,
    "personalRating" DOUBLE PRECISION,
    "pairwiseScore" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "comparisonCount" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseCandidate" (
    "id" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "externalSource" "ExternalReleaseSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "description" TEXT,
    "posterUrl" TEXT,
    "releaseDate" TIMESTAMP(3),
    "upcomingDate" TIMESTAMP(3),
    "genresJson" TEXT,
    "tagsJson" TEXT,
    "companiesJson" TEXT,
    "platformsJson" TEXT,
    "metadataJson" TEXT,
    "publicInterestScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "localAffinityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "indieSignalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reasonJson" TEXT,
    "status" "ReleaseCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaGenre" (
    "mediaId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    CONSTRAINT "MediaGenre_pkey" PRIMARY KEY ("mediaId","genreId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaTag" (
    "mediaId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "MediaTag_pkey" PRIMARY KEY ("mediaId","tagId")
);

-- CreateTable
CREATE TABLE "PairwiseComparison" (
    "id" TEXT NOT NULL,
    "winnerId" TEXT NOT NULL,
    "loserId" TEXT NOT NULL,
    "context" "ComparisonContext",
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairwiseComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ListKind" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "rank" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friend" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FriendRating" (
    "id" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "status" "MediaStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FriendRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL,
    "fileName" TEXT,
    "status" "ImportStatus" NOT NULL,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaItem_mediaType_idx" ON "MediaItem"("mediaType");

-- CreateIndex
CREATE INDEX "MediaItem_status_idx" ON "MediaItem"("status");

-- CreateIndex
CREATE INDEX "MediaItem_pairwiseScore_idx" ON "MediaItem"("pairwiseScore");

-- CreateIndex
CREATE UNIQUE INDEX "MediaItem_title_mediaType_key" ON "MediaItem"("title", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseCandidate_externalSource_externalId_key" ON "ReleaseCandidate"("externalSource", "externalId");

-- CreateIndex
CREATE INDEX "ReleaseCandidate_mediaType_idx" ON "ReleaseCandidate"("mediaType");

-- CreateIndex
CREATE INDEX "ReleaseCandidate_upcomingDate_idx" ON "ReleaseCandidate"("upcomingDate");

-- CreateIndex
CREATE INDEX "ReleaseCandidate_status_idx" ON "ReleaseCandidate"("status");

-- CreateIndex
CREATE INDEX "ReleaseCandidate_finalScore_idx" ON "ReleaseCandidate"("finalScore");

-- CreateIndex
CREATE INDEX "ReleaseCandidate_normalizedTitle_mediaType_idx" ON "ReleaseCandidate"("normalizedTitle", "mediaType");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_name_key" ON "Genre"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "PairwiseComparison_winnerId_idx" ON "PairwiseComparison"("winnerId");

-- CreateIndex
CREATE INDEX "PairwiseComparison_loserId_idx" ON "PairwiseComparison"("loserId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomList_name_key" ON "CustomList"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ListItem_listId_mediaId_key" ON "ListItem"("listId", "mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "FriendRating_friendId_mediaId_key" ON "FriendRating"("friendId", "mediaId");

-- AddForeignKey
ALTER TABLE "MediaGenre" ADD CONSTRAINT "MediaGenre_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaGenre" ADD CONSTRAINT "MediaGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaTag" ADD CONSTRAINT "MediaTag_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaTag" ADD CONSTRAINT "MediaTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairwiseComparison" ADD CONSTRAINT "PairwiseComparison_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "MediaItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairwiseComparison" ADD CONSTRAINT "PairwiseComparison_loserId_fkey" FOREIGN KEY ("loserId") REFERENCES "MediaItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "CustomList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRating" ADD CONSTRAINT "FriendRating_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "Friend"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRating" ADD CONSTRAINT "FriendRating_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
