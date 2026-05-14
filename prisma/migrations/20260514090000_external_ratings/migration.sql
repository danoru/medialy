-- CreateEnum
CREATE TYPE "ExternalRatingSource" AS ENUM ('METACRITIC');

-- CreateTable
CREATE TABLE "ExternalRating" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "source" "ExternalRatingSource" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "sourceUrl" TEXT,
    "metadataJson" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRating_mediaId_source_key" ON "ExternalRating"("mediaId", "source");

-- CreateIndex
CREATE INDEX "ExternalRating_source_idx" ON "ExternalRating"("source");

-- CreateIndex
CREATE INDEX "ExternalRating_score_idx" ON "ExternalRating"("score");

-- AddForeignKey
ALTER TABLE "ExternalRating" ADD CONSTRAINT "ExternalRating_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
