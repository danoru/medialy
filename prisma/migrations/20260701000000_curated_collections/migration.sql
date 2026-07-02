-- AlterEnum
ALTER TYPE "ListKind" ADD VALUE 'COLLECTION';

-- AlterTable
ALTER TABLE "CustomList" ADD COLUMN "subtitle" TEXT,
ADD COLUMN "coverUrl" TEXT,
ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "featuredMonth" TEXT;

-- AlterTable
ALTER TABLE "ListItem" ADD COLUMN "sectionId" TEXT;

-- CreateTable
CREATE TABLE "ListSection" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListSection_listId_idx" ON "ListSection"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomList_featuredMonth_key" ON "CustomList"("featuredMonth");

-- CreateIndex
CREATE INDEX "CustomList_kind_idx" ON "CustomList"("kind");

-- CreateIndex
CREATE INDEX "CustomList_isPublished_idx" ON "CustomList"("isPublished");

-- CreateIndex
CREATE INDEX "ListItem_sectionId_idx" ON "ListItem"("sectionId");

-- AddForeignKey
ALTER TABLE "ListSection" ADD CONSTRAINT "ListSection_listId_fkey" FOREIGN KEY ("listId") REFERENCES "CustomList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ListSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
