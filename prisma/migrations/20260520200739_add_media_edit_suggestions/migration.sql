-- CreateEnum
CREATE TYPE "EditSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MediaEditSuggestion" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT,
    "userId" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT NOT NULL,
    "status" "EditSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,

    CONSTRAINT "MediaEditSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaEditSuggestion_status_idx" ON "MediaEditSuggestion"("status");

-- CreateIndex
CREATE INDEX "MediaEditSuggestion_mediaId_idx" ON "MediaEditSuggestion"("mediaId");

-- CreateIndex
CREATE INDEX "MediaEditSuggestion_userId_idx" ON "MediaEditSuggestion"("userId");

-- CreateIndex
CREATE INDEX "MediaEditSuggestion_createdAt_idx" ON "MediaEditSuggestion"("createdAt");

-- AddForeignKey
ALTER TABLE "MediaEditSuggestion" ADD CONSTRAINT "MediaEditSuggestion_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaEditSuggestion" ADD CONSTRAINT "MediaEditSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaEditSuggestion" ADD CONSTRAINT "MediaEditSuggestion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
