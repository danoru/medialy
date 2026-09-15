-- AlterTable
ALTER TABLE "UserMedia" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedAtUnsure" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "UserMedia_userId_completedAt_idx" ON "UserMedia"("userId", "completedAt");
