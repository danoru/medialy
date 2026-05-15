INSERT INTO "Tag" ("id", "name", "normalizedName", "status", "category", "discoverable", "approvedAt")
VALUES
  ('tag_from_genre_mmo', 'MMO', 'mmo', 'APPROVED', 'THEME', false, CURRENT_TIMESTAMP),
  ('tag_from_genre_sandbox', 'Sandbox', 'sandbox', 'APPROVED', 'THEME', false, CURRENT_TIMESTAMP)
ON CONFLICT ("normalizedName") DO UPDATE SET
  "category" = 'THEME',
  "discoverable" = false,
  "approvedAt" = COALESCE("Tag"."approvedAt", CURRENT_TIMESTAMP),
  "status" = CASE WHEN "Tag"."status" = 'REJECTED' THEN "Tag"."status" ELSE 'APPROVED' END;

INSERT INTO "MediaTag" ("mediaId", "tagId")
SELECT mg."mediaId", tag."id"
FROM "MediaGenre" mg
JOIN "Genre" genre ON genre."id" = mg."genreId"
JOIN "Tag" tag ON tag."normalizedName" = regexp_replace(lower(genre."name"), '[^a-z0-9]+', '', 'g')
WHERE genre."name" IN ('MMO', 'Sandbox')
ON CONFLICT ("mediaId", "tagId") DO NOTHING;

DELETE FROM "MediaGenre" mg
USING "Genre" genre
WHERE mg."genreId" = genre."id"
  AND genre."name" IN ('MMO', 'Sandbox');

DELETE FROM "Genre"
WHERE "name" IN ('MMO', 'Sandbox')
  AND NOT EXISTS (
    SELECT 1
    FROM "MediaGenre"
    WHERE "MediaGenre"."genreId" = "Genre"."id"
  );
