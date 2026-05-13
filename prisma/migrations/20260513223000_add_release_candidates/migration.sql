-- CreateTable
CREATE TABLE "ReleaseCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "externalSource" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "description" TEXT,
    "posterUrl" TEXT,
    "releaseDate" DATETIME,
    "upcomingDate" DATETIME,
    "genresJson" TEXT,
    "tagsJson" TEXT,
    "companiesJson" TEXT,
    "platformsJson" TEXT,
    "metadataJson" TEXT,
    "publicInterestScore" REAL NOT NULL DEFAULT 0,
    "localAffinityScore" REAL NOT NULL DEFAULT 0,
    "indieSignalScore" REAL NOT NULL DEFAULT 0,
    "qualityScore" REAL NOT NULL DEFAULT 0,
    "confidenceScore" REAL NOT NULL DEFAULT 0,
    "finalScore" REAL NOT NULL DEFAULT 0,
    "reasonJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
