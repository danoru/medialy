-- Add moderated, normalized tag identity while preserving existing tags.
CREATE TYPE "TagStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

ALTER TABLE "Tag"
  ADD COLUMN "normalizedName" TEXT,
  ADD COLUMN "status" "TagStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Tag"
SET "normalizedName" = regexp_replace(lower("name"), '[^a-z0-9]+', '', 'g'),
    "approvedAt" = CURRENT_TIMESTAMP;

INSERT INTO "MediaTag" ("mediaId", "tagId")
SELECT mt."mediaId", keep."id"
FROM "MediaTag" mt
JOIN "Tag" duplicate ON mt."tagId" = duplicate."id"
JOIN "Tag" keep ON keep."normalizedName" = duplicate."normalizedName"
WHERE duplicate."id" <> keep."id"
  AND keep."id" = (
    SELECT min(t."id")
    FROM "Tag" t
    WHERE t."normalizedName" = duplicate."normalizedName"
  )
ON CONFLICT ("mediaId", "tagId") DO NOTHING;

DELETE FROM "MediaTag" mt
USING "Tag" keep, "Tag" duplicate
WHERE mt."tagId" = duplicate."id"
  AND duplicate."id" <> keep."id"
  AND duplicate."normalizedName" = keep."normalizedName"
  AND keep."id" = (
    SELECT min(t."id")
    FROM "Tag" t
    WHERE t."normalizedName" = duplicate."normalizedName"
  );

DELETE FROM "Tag" duplicate
USING "Tag" keep
WHERE duplicate."id" <> keep."id"
  AND duplicate."normalizedName" = keep."normalizedName"
  AND keep."id" = (
    SELECT min(t."id")
    FROM "Tag" t
    WHERE t."normalizedName" = duplicate."normalizedName"
  );

ALTER TABLE "Tag" ALTER COLUMN "normalizedName" SET NOT NULL;

CREATE UNIQUE INDEX "Tag_normalizedName_key" ON "Tag"("normalizedName");
CREATE INDEX "Tag_status_idx" ON "Tag"("status");

-- Seed canonical genre rows.
INSERT INTO "Genre" ("id", "name")
SELECT concat('canonical_', regexp_replace(lower(value), '[^a-z0-9]+', '', 'g')), value
FROM (
  VALUES
    ('Action'), ('Adventure'), ('Animation'), ('Comedy'), ('Crime'),
    ('Documentary'), ('Drama'), ('Family'), ('Fantasy'), ('Horror'),
    ('Musical'), ('Mystery'), ('Romance'), ('Science Fiction'),
    ('Thriller'), ('War'), ('Western'), ('Fighting'), ('MMO'), ('Party'),
    ('Platformer'), ('Puzzle'), ('Racing'), ('RPG'), ('Sandbox'),
    ('Shooter'), ('Simulation'), ('Sports'), ('Stealth'), ('Strategy'),
    ('Survival'), ('Visual Novel')
) AS canonical(value)
ON CONFLICT ("name") DO NOTHING;

-- Normalize known genre aliases to canonical rows.
INSERT INTO "MediaGenre" ("mediaId", "genreId")
SELECT mg."mediaId", canonical."id"
FROM "MediaGenre" mg
JOIN "Genre" old_genre ON old_genre."id" = mg."genreId"
JOIN "Genre" canonical ON canonical."name" = CASE
  WHEN lower(old_genre."name") IN ('sci-fi', 'scifi', 'science-fiction', 'science fiction action') THEN 'Science Fiction'
  WHEN lower(old_genre."name") IN ('animated') THEN 'Animation'
  WHEN lower(old_genre."name") IN ('kids', 'children', 'childrens') THEN 'Family'
  WHEN lower(old_genre."name") IN ('romcom', 'rom com') THEN 'Romance'
  WHEN lower(old_genre."name") IN ('role playing', 'role-playing') THEN 'RPG'
  ELSE old_genre."name"
END
WHERE old_genre."name" <> canonical."name"
ON CONFLICT ("mediaId", "genreId") DO NOTHING;

DELETE FROM "MediaGenre" mg
USING "Genre" old_genre
WHERE mg."genreId" = old_genre."id"
  AND lower(old_genre."name") IN (
    'sci-fi', 'scifi', 'science-fiction', 'science fiction action',
    'animated', 'kids', 'children', 'childrens', 'romcom', 'rom com',
    'role playing', 'role-playing'
  );

-- Move noncanonical genre labels into approved tags.
INSERT INTO "Tag" ("id", "name", "normalizedName", "status", "approvedAt")
SELECT concat('tag_from_genre_', regexp_replace(lower(g."name"), '[^a-z0-9]+', '', 'g')),
       g."name",
       regexp_replace(lower(g."name"), '[^a-z0-9]+', '', 'g'),
       'APPROVED',
       CURRENT_TIMESTAMP
FROM "Genre" g
WHERE g."name" NOT IN (
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'Horror', 'Musical', 'Mystery', 'Romance',
  'Science Fiction', 'Thriller', 'War', 'Western', 'Fighting', 'MMO',
  'Party', 'Platformer', 'Puzzle', 'Racing', 'RPG', 'Sandbox', 'Shooter',
  'Simulation', 'Sports', 'Stealth', 'Strategy', 'Survival', 'Visual Novel'
)
ON CONFLICT ("normalizedName") DO NOTHING;

INSERT INTO "MediaTag" ("mediaId", "tagId")
SELECT mg."mediaId", t."id"
FROM "MediaGenre" mg
JOIN "Genre" g ON g."id" = mg."genreId"
JOIN "Tag" t ON t."normalizedName" = regexp_replace(lower(g."name"), '[^a-z0-9]+', '', 'g')
WHERE g."name" NOT IN (
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'Horror', 'Musical', 'Mystery', 'Romance',
  'Science Fiction', 'Thriller', 'War', 'Western', 'Fighting', 'MMO',
  'Party', 'Platformer', 'Puzzle', 'Racing', 'RPG', 'Sandbox', 'Shooter',
  'Simulation', 'Sports', 'Stealth', 'Strategy', 'Survival', 'Visual Novel'
)
ON CONFLICT ("mediaId", "tagId") DO NOTHING;

DELETE FROM "MediaGenre" mg
USING "Genre" g
WHERE mg."genreId" = g."id"
  AND g."name" NOT IN (
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Family', 'Fantasy', 'Horror', 'Musical', 'Mystery', 'Romance',
    'Science Fiction', 'Thriller', 'War', 'Western', 'Fighting', 'MMO',
    'Party', 'Platformer', 'Puzzle', 'Racing', 'RPG', 'Sandbox', 'Shooter',
    'Simulation', 'Sports', 'Stealth', 'Strategy', 'Survival', 'Visual Novel'
  );

-- Keep only the first three canonical genres per item.
DELETE FROM "MediaGenre" mg
USING (
  SELECT "mediaId", "genreId",
         row_number() OVER (PARTITION BY "mediaId" ORDER BY "genreId") AS rn
  FROM "MediaGenre"
) ranked
WHERE mg."mediaId" = ranked."mediaId"
  AND mg."genreId" = ranked."genreId"
  AND ranked.rn > 3;
