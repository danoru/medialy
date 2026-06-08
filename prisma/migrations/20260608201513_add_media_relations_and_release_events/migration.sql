-- CreateEnum
CREATE TYPE "RelationKind" AS ENUM ('FOLLOWS', 'SPINOFF_OF', 'REMAKE_OF', 'ADAPTED_FROM');

-- CreateEnum
CREATE TYPE "ReleaseKind" AS ENUM ('REMASTER', 'PORT', 'RERELEASE', 'DLC');

-- AlterEnum
ALTER TYPE "MediaStatus" ADD VALUE 'NOT_INTERESTED';

-- CreateTable
CREATE TABLE "MediaRelation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" "RelationKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaReleaseEvent" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" "ReleaseKind" NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaReleaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaRelation_fromId_idx" ON "MediaRelation"("fromId");

-- CreateIndex
CREATE INDEX "MediaRelation_toId_idx" ON "MediaRelation"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaRelation_fromId_toId_kind_key" ON "MediaRelation"("fromId", "toId", "kind");

-- CreateIndex
CREATE INDEX "MediaReleaseEvent_mediaId_idx" ON "MediaReleaseEvent"("mediaId");

-- CreateIndex
CREATE INDEX "MediaReleaseEvent_date_idx" ON "MediaReleaseEvent"("date");

-- AddForeignKey
ALTER TABLE "MediaRelation" ADD CONSTRAINT "MediaRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRelation" ADD CONSTRAINT "MediaRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaReleaseEvent" ADD CONSTRAINT "MediaReleaseEvent_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
