CREATE TYPE "TagCategory" AS ENUM ('SUBGENRE', 'COUNTRY', 'THEME', 'MECHANIC', 'MOOD', 'FORMAT');

ALTER TABLE "Tag"
  ADD COLUMN "category" "TagCategory" NOT NULL DEFAULT 'THEME',
  ADD COLUMN "discoverable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mediaTypesJson" TEXT,
  ADD COLUMN "countryCode" TEXT;

CREATE INDEX "Tag_category_idx" ON "Tag"("category");
CREATE INDEX "Tag_discoverable_idx" ON "Tag"("discoverable");
CREATE INDEX "Tag_countryCode_idx" ON "Tag"("countryCode");

INSERT INTO "Genre" ("id", "name")
VALUES
  ('canonical_casual', 'Casual'),
  ('canonical_rhythm', 'Rhythm')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "MediaGenre" ("mediaId", "genreId")
SELECT mg."mediaId", casual."id"
FROM "MediaGenre" mg
JOIN "Genre" old_genre ON old_genre."id" = mg."genreId"
JOIN "Genre" casual ON casual."name" = 'Casual'
WHERE old_genre."name" = 'Party'
ON CONFLICT ("mediaId", "genreId") DO NOTHING;

DELETE FROM "MediaGenre" mg
USING "Genre" old_genre
WHERE mg."genreId" = old_genre."id"
  AND old_genre."name" = 'Party';

INSERT INTO "Tag" ("id", "name", "normalizedName", "status", "category", "discoverable", "mediaTypesJson", "approvedAt")
VALUES ('canonical_tag_stealth', 'Stealth', 'stealth', 'APPROVED', 'SUBGENRE', true, '["VIDEO_GAME"]', CURRENT_TIMESTAMP)
ON CONFLICT ("normalizedName") DO UPDATE SET
  "category" = 'SUBGENRE',
  "discoverable" = true,
  "mediaTypesJson" = '["VIDEO_GAME"]',
  "approvedAt" = COALESCE("Tag"."approvedAt", CURRENT_TIMESTAMP),
  "status" = CASE WHEN "Tag"."status" = 'REJECTED' THEN "Tag"."status" ELSE 'APPROVED' END;

INSERT INTO "MediaTag" ("mediaId", "tagId")
SELECT mg."mediaId", tag."id"
FROM "MediaGenre" mg
JOIN "Genre" stealth ON stealth."id" = mg."genreId"
JOIN "Tag" tag ON tag."normalizedName" = 'stealth'
WHERE stealth."name" = 'Stealth'
ON CONFLICT ("mediaId", "tagId") DO NOTHING;

DELETE FROM "MediaGenre" mg
USING "Genre" stealth
WHERE mg."genreId" = stealth."id"
  AND stealth."name" = 'Stealth';

DELETE FROM "Genre"
WHERE "name" IN ('Party', 'Stealth')
  AND NOT EXISTS (
    SELECT 1
    FROM "MediaGenre"
    WHERE "MediaGenre"."genreId" = "Genre"."id"
  );

INSERT INTO "Tag" ("id", "name", "normalizedName", "status", "category", "discoverable", "mediaTypesJson", "countryCode", "approvedAt")
SELECT concat('canonical_tag_', regexp_replace(lower(value), '[^a-z0-9]+', '', 'g')),
       value,
       regexp_replace(lower(value), '[^a-z0-9]+', '', 'g'),
       'APPROVED',
       category::"TagCategory",
       discoverable,
       "mediaTypesJson",
       "countryCode",
       CURRENT_TIMESTAMP
FROM (
  VALUES
    ('4X', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Action RPG', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Anime', 'SUBGENRE', true, '["MOVIE","TV_SHOW"]', NULL),
    ('Arcade Rhythm', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Body Horror', 'SUBGENRE', true, '["MOVIE"]', NULL),
    ('Character Action', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Cyberpunk', 'SUBGENRE', true, '["MOVIE"]', NULL),
    ('Folk Horror', 'SUBGENRE', true, '["MOVIE"]', NULL),
    ('JRPG', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Kart Racer', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Metroidvania', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Open World', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Party Game', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Prestige TV', 'SUBGENRE', true, '["TV_SHOW"]', NULL),
    ('Psychological Horror', 'SUBGENRE', true, '["MOVIE","VIDEO_GAME"]', NULL),
    ('Psychological Thriller', 'SUBGENRE', true, '["MOVIE"]', NULL),
    ('Real-Time Strategy', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Roguelike', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Soulslike', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Space Opera', 'SUBGENRE', true, '["MOVIE","TV_SHOW"]', NULL),
    ('Survival Crafting', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Survival Horror', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Tactical Shooter', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Tactics', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('Turn-Based RPG', 'SUBGENRE', true, '["VIDEO_GAME"]', NULL),
    ('France', 'COUNTRY', true, '["MOVIE","TV_SHOW"]', 'FR'),
    ('Japan', 'COUNTRY', true, '["MOVIE","TV_SHOW","VIDEO_GAME"]', 'JP'),
    ('South Korea', 'COUNTRY', true, '["MOVIE","TV_SHOW"]', 'KR'),
    ('United Kingdom', 'COUNTRY', true, '["MOVIE","TV_SHOW"]', 'GB'),
    ('United States', 'COUNTRY', true, '["MOVIE","TV_SHOW","VIDEO_GAME"]', 'US')
) AS canonical(value, category, discoverable, "mediaTypesJson", "countryCode")
ON CONFLICT ("normalizedName") DO UPDATE SET
  "category" = EXCLUDED."category",
  "discoverable" = EXCLUDED."discoverable",
  "mediaTypesJson" = EXCLUDED."mediaTypesJson",
  "countryCode" = EXCLUDED."countryCode",
  "approvedAt" = COALESCE("Tag"."approvedAt", CURRENT_TIMESTAMP),
  "status" = CASE WHEN "Tag"."status" = 'REJECTED' THEN "Tag"."status" ELSE 'APPROVED' END;
