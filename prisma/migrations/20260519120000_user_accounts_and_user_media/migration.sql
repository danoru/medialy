-- Phase 0 of multi-user transition: move per-user MediaItem fields onto a new
-- UserMedia row, scope PairwiseComparison / Note / CustomList by userId, and
-- introduce Auth.js (NextAuth) adapter tables (Account, Session,
-- VerificationToken). All existing data is owned by the seeded `usr_default`
-- account; we never had a real second user, so this is safe to backfill in-place.

-- --------------------------------------------------------------------------
-- 1. Extend User with NextAuth fields.
-- --------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN "name" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "image" TEXT;

-- --------------------------------------------------------------------------
-- 2. Auth.js adapter tables.
-- --------------------------------------------------------------------------
CREATE TABLE "Account" (
    "id"                 TEXT NOT NULL,
    "userId"             TEXT NOT NULL,
    "type"               TEXT NOT NULL,
    "provider"           TEXT NOT NULL,
    "providerAccountId"  TEXT NOT NULL,
    "refresh_token"      TEXT,
    "access_token"       TEXT,
    "expires_at"         INTEGER,
    "token_type"         TEXT,
    "scope"              TEXT,
    "id_token"           TEXT,
    "session_state"      TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key"
    ON "Account"("provider", "providerAccountId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
ALTER TABLE "Account"
    ADD CONSTRAINT "Account_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Session" (
    "id"           TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "expires"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
ALTER TABLE "Session"
    ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "expires"    TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key"
    ON "VerificationToken"("identifier", "token");

-- --------------------------------------------------------------------------
-- 3. UserMedia: per-user state previously stored on MediaItem.
-- --------------------------------------------------------------------------
CREATE TABLE "UserMedia" (
    "id"                      TEXT NOT NULL,
    "userId"                  TEXT NOT NULL,
    "mediaId"                 TEXT NOT NULL,
    "status"                  "MediaStatus" NOT NULL DEFAULT 'UNTRACKED',
    "personalRating"          DOUBLE PRECISION,
    "computedPersonalScore"   DOUBLE PRECISION,
    "personalScoreConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pairwiseScore"           DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "comparisonCount"         INTEGER NOT NULL DEFAULT 0,
    "isFavorite"              BOOLEAN NOT NULL DEFAULT false,
    "isArchived"              BOOLEAN NOT NULL DEFAULT false,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserMedia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserMedia_userId_mediaId_key" ON "UserMedia"("userId", "mediaId");
CREATE INDEX "UserMedia_userId_idx" ON "UserMedia"("userId");
CREATE INDEX "UserMedia_mediaId_idx" ON "UserMedia"("mediaId");
CREATE INDEX "UserMedia_userId_status_idx" ON "UserMedia"("userId", "status");
CREATE INDEX "UserMedia_userId_pairwiseScore_idx" ON "UserMedia"("userId", "pairwiseScore");
CREATE INDEX "UserMedia_userId_computedPersonalScore_idx"
    ON "UserMedia"("userId", "computedPersonalScore");
ALTER TABLE "UserMedia"
    ADD CONSTRAINT "UserMedia_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserMedia"
    ADD CONSTRAINT "UserMedia_mediaId_fkey"
    FOREIGN KEY ("mediaId") REFERENCES "MediaItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill every existing MediaItem into a UserMedia row for usr_default.
-- We materialize a row even for UNTRACKED items so that subsequent reads
-- (joins) don't need a LEFT JOIN fallback during transition. The cost is
-- tiny — one row per item — and a later cleanup can drop UNTRACKED rows.
INSERT INTO "UserMedia" (
    "id", "userId", "mediaId", "status",
    "personalRating", "computedPersonalScore", "personalScoreConfidence",
    "pairwiseScore", "comparisonCount", "isFavorite", "isArchived",
    "createdAt", "updatedAt"
)
SELECT
    'um_' || "id",
    'usr_default',
    "id",
    "status",
    "personalRating",
    "computedPersonalScore",
    "personalScoreConfidence",
    "pairwiseScore",
    "comparisonCount",
    "isFavorite",
    "isArchived",
    "createdAt",
    "updatedAt"
FROM "MediaItem";

-- --------------------------------------------------------------------------
-- 4. PairwiseComparison.userId — scope existing comparisons to usr_default.
-- --------------------------------------------------------------------------
ALTER TABLE "PairwiseComparison" ADD COLUMN "userId" TEXT;
UPDATE "PairwiseComparison" SET "userId" = 'usr_default' WHERE "userId" IS NULL;
ALTER TABLE "PairwiseComparison" ALTER COLUMN "userId" SET NOT NULL;
CREATE INDEX "PairwiseComparison_userId_idx" ON "PairwiseComparison"("userId");
ALTER TABLE "PairwiseComparison"
    ADD CONSTRAINT "PairwiseComparison_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- 5. Note.userId — scope existing notes to usr_default.
-- --------------------------------------------------------------------------
ALTER TABLE "Note" ADD COLUMN "userId" TEXT;
UPDATE "Note" SET "userId" = 'usr_default' WHERE "userId" IS NULL;
ALTER TABLE "Note" ALTER COLUMN "userId" SET NOT NULL;
CREATE INDEX "Note_userId_idx" ON "Note"("userId");
CREATE INDEX "Note_mediaId_idx" ON "Note"("mediaId");
ALTER TABLE "Note"
    ADD CONSTRAINT "Note_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- 6. CustomList.userId — scope existing lists to usr_default. The old global
--    `name` unique becomes `(userId, name)` so two users can have lists with
--    the same name.
-- --------------------------------------------------------------------------
ALTER TABLE "CustomList" ADD COLUMN "userId" TEXT;
UPDATE "CustomList" SET "userId" = 'usr_default' WHERE "userId" IS NULL;
ALTER TABLE "CustomList" ALTER COLUMN "userId" SET NOT NULL;
DROP INDEX "CustomList_name_key";
CREATE UNIQUE INDEX "CustomList_userId_name_key" ON "CustomList"("userId", "name");
CREATE INDEX "CustomList_userId_idx" ON "CustomList"("userId");
ALTER TABLE "CustomList"
    ADD CONSTRAINT "CustomList_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- 7. Drop the per-user columns from MediaItem now that UserMedia holds them.
-- --------------------------------------------------------------------------
DROP INDEX IF EXISTS "MediaItem_status_idx";
DROP INDEX IF EXISTS "MediaItem_pairwiseScore_idx";
DROP INDEX IF EXISTS "MediaItem_computedPersonalScore_idx";

ALTER TABLE "MediaItem" DROP COLUMN "status";
ALTER TABLE "MediaItem" DROP COLUMN "personalRating";
ALTER TABLE "MediaItem" DROP COLUMN "computedPersonalScore";
ALTER TABLE "MediaItem" DROP COLUMN "personalScoreConfidence";
ALTER TABLE "MediaItem" DROP COLUMN "pairwiseScore";
ALTER TABLE "MediaItem" DROP COLUMN "comparisonCount";
ALTER TABLE "MediaItem" DROP COLUMN "isFavorite";
ALTER TABLE "MediaItem" DROP COLUMN "isArchived";
