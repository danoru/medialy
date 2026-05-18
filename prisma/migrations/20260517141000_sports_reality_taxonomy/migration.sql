INSERT INTO "Genre" ("id", "name")
VALUES
  ('canonical_sports', 'Sports'),
  ('canonical_reality', 'Reality')
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Tag" ("id", "name", "normalizedName", "status", "category", "discoverable", "mediaTypesJson", "approvedAt")
VALUES (
  'canonical_tag_realitycompetition',
  'Reality Competition',
  'realitycompetition',
  'APPROVED',
  'SUBGENRE',
  true,
  '["TV_SHOW"]',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("normalizedName") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "discoverable" = EXCLUDED."discoverable",
  "mediaTypesJson" = EXCLUDED."mediaTypesJson",
  "approvedAt" = COALESCE("Tag"."approvedAt", CURRENT_TIMESTAMP),
  "status" = CASE WHEN "Tag"."status" = 'REJECTED' THEN "Tag"."status" ELSE 'APPROVED' END;
