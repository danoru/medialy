-- AlterTable
ALTER TABLE "MediaItem" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "MediaItem_createdById_idx" ON "MediaItem"("createdById");

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
