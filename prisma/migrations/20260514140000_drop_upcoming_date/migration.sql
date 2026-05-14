DROP INDEX IF EXISTS "ReleaseCandidate_upcomingDate_idx";

ALTER TABLE "MediaItem" DROP COLUMN IF EXISTS "upcomingDate";
ALTER TABLE "ReleaseCandidate" DROP COLUMN IF EXISTS "upcomingDate";
