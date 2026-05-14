ALTER TABLE "MediaItem"
ADD COLUMN "computedPersonalScore" DOUBLE PRECISION,
ADD COLUMN "personalScoreConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "computedConsensusScore" DOUBLE PRECISION,
ADD COLUMN "consensusConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX "MediaItem_computedPersonalScore_idx" ON "MediaItem"("computedPersonalScore");
CREATE INDEX "MediaItem_computedConsensusScore_idx" ON "MediaItem"("computedConsensusScore");
