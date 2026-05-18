CREATE TYPE "ContributorKind" AS ENUM ('PERSON', 'COMPANY');
CREATE TYPE "CreditRole" AS ENUM ('DIRECTOR', 'CREATOR', 'DEVELOPER', 'PUBLISHER');

CREATE TABLE "Contributor" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "kind" "ContributorKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Contributor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaCredit" (
  "mediaId" TEXT NOT NULL,
  "contributorId" TEXT NOT NULL,
  "role" "CreditRole" NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT,
  "sourceId" TEXT,

  CONSTRAINT "MediaCredit_pkey" PRIMARY KEY ("mediaId", "contributorId", "role")
);

CREATE UNIQUE INDEX "Contributor_normalizedName_kind_key" ON "Contributor"("normalizedName", "kind");
CREATE INDEX "Contributor_name_idx" ON "Contributor"("name");
CREATE INDEX "Contributor_kind_idx" ON "Contributor"("kind");
CREATE INDEX "MediaCredit_role_idx" ON "MediaCredit"("role");
CREATE INDEX "MediaCredit_contributorId_idx" ON "MediaCredit"("contributorId");

ALTER TABLE "MediaCredit"
  ADD CONSTRAINT "MediaCredit_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaCredit"
  ADD CONSTRAINT "MediaCredit_contributorId_fkey"
  FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
