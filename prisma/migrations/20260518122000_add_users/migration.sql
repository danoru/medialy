-- Introduce a User account and scope friends / friend ratings to it.
-- Medialy is still single-user, so we seed one default user and backfill
-- existing rows onto it. The id is fixed so seed.ts / getCurrentUser() can
-- rely on it deterministically across environments.

CREATE TABLE "User" (
    "id"          TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email"       TEXT,
    "avatarColor" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

INSERT INTO "User" ("id", "displayName", "createdAt", "updatedAt")
VALUES ('usr_default', 'Daniel', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Friend.userId
ALTER TABLE "Friend" ADD COLUMN "userId" TEXT;
UPDATE "Friend" SET "userId" = 'usr_default' WHERE "userId" IS NULL;
ALTER TABLE "Friend" ALTER COLUMN "userId" SET NOT NULL;
CREATE INDEX "Friend_userId_idx" ON "Friend"("userId");
ALTER TABLE "Friend"
    ADD CONSTRAINT "Friend_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FriendRating.userId
ALTER TABLE "FriendRating" ADD COLUMN "userId" TEXT;
UPDATE "FriendRating" SET "userId" = 'usr_default' WHERE "userId" IS NULL;
ALTER TABLE "FriendRating" ALTER COLUMN "userId" SET NOT NULL;
CREATE INDEX "FriendRating_userId_idx" ON "FriendRating"("userId");
ALTER TABLE "FriendRating"
    ADD CONSTRAINT "FriendRating_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
