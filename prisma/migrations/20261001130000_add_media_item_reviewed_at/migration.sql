-- AlterTable
ALTER TABLE "MediaItem" ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MediaItem_reviewedAt_idx" ON "MediaItem"("reviewedAt");
