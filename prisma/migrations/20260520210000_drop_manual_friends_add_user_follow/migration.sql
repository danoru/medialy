-- Drop the manual Friend / FriendRating tracker entirely. The /friends page is
-- being replaced with a real social follow system between platform users.
-- Cascading FKs on FriendRating point to Friend and MediaItem; dropping
-- FriendRating first and then Friend keeps Postgres happy regardless of order.

DROP TABLE IF EXISTS "FriendRating";
DROP TABLE IF EXISTS "Friend";

-- One-way follow between two users.

CREATE TABLE "UserFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserFollow_followerId_followingId_key"
    ON "UserFollow"("followerId", "followingId");
CREATE INDEX "UserFollow_followerId_idx" ON "UserFollow"("followerId");
CREATE INDEX "UserFollow_followingId_idx" ON "UserFollow"("followingId");

ALTER TABLE "UserFollow"
    ADD CONSTRAINT "UserFollow_followerId_fkey"
    FOREIGN KEY ("followerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFollow"
    ADD CONSTRAINT "UserFollow_followingId_fkey"
    FOREIGN KEY ("followingId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
