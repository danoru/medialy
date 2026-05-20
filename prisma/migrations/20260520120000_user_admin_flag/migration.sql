-- Add an admin flag to User so tag moderation (and any future admin-only
-- surface) can gate on a single boolean. The seeded usr_default account is
-- the install owner, so it's promoted to admin in the same migration.

ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "isAdmin" = true WHERE "id" = 'usr_default';
