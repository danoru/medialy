-- Persist Elo history per comparison so the UI can render gains/losses
-- and a score timeline. All columns nullable for backfill compatibility.
ALTER TABLE "PairwiseComparison"
  ADD COLUMN "winnerScoreBefore"     DOUBLE PRECISION,
  ADD COLUMN "winnerScoreAfter"      DOUBLE PRECISION,
  ADD COLUMN "loserScoreBefore"      DOUBLE PRECISION,
  ADD COLUMN "loserScoreAfter"       DOUBLE PRECISION,
  ADD COLUMN "winnerDelta"           DOUBLE PRECISION,
  ADD COLUMN "loserDelta"            DOUBLE PRECISION,
  ADD COLUMN "expectedWinnerWinProb" DOUBLE PRECISION;

CREATE INDEX "PairwiseComparison_createdAt_idx" ON "PairwiseComparison"("createdAt");
