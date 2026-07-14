/**
 * Read-only audit of taxonomy damage. Writes nothing, ever.
 *
 * Reports three problems the old `metadata:backfill` could create, and which it
 * can no longer self-correct (it only fills blank fields, so a bad value is
 * sticky):
 *
 *   1. genre-tags     — a tag whose name duplicates one of the item's own genres
 *                       (TMDB's tag list is literally its genre list, so the old
 *                       script copied genres into the tag field).
 *   2. over-cap       — more than MAX_GENRES_PER_ITEM genres, a state the media
 *                       form will refuse to save.
 *   3. non-canonical  — a genre not in the taxonomy for that media type.
 *
 * Usage: pnpm.cmd run taxonomy:report
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  MAX_GENRES_PER_ITEM,
  normalizeGenreName,
  normalizeTagKey,
} from "@/lib/taxonomy";

type Row = {
  title: string;
  mediaType: string;
  genres: string[];
  tags: string[];
};

async function main() {
  const items = await prisma.mediaItem.findMany({
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
    },
    orderBy: [{ mediaType: "asc" }, { title: "asc" }],
  });

  const genreTags: Array<Row & { duplicated: string[] }> = [];
  const overCap: Row[] = [];
  const nonCanonical: Array<Row & { invalid: string[] }> = [];

  for (const item of items) {
    const genres = item.genres.map((entry) => entry.genre.name);
    const tags = item.tags.map((entry) => entry.tag.name);
    const row: Row = { title: item.title, mediaType: item.mediaType, genres, tags };

    const genreKeys = new Set(genres.map((name) => normalizeTagKey(name)));
    const duplicated = tags.filter((name) => genreKeys.has(normalizeTagKey(name)));
    if (duplicated.length > 0) genreTags.push({ ...row, duplicated });

    if (genres.length > MAX_GENRES_PER_ITEM) overCap.push(row);

    const invalid = genres.filter(
      (name) => normalizeGenreName(name, item.mediaType) == null,
    );
    if (invalid.length > 0) nonCanonical.push({ ...row, invalid });
  }

  console.log(`Scanned ${items.length} media items.\n`);

  section(
    `Tags that duplicate the item's own genres (${genreTags.length} items)`,
    genreTags.map((row) => ({
      title: row.title,
      type: row.mediaType,
      genres: row.genres.join(", "),
      duplicateTags: row.duplicated.join(", "),
      otherTags:
        row.tags.filter((tag) => !row.duplicated.includes(tag)).join(", ") ||
        "—",
    })),
  );

  section(
    `Over the ${MAX_GENRES_PER_ITEM}-genre cap (${overCap.length} items)`,
    overCap.map((row) => ({
      title: row.title,
      type: row.mediaType,
      count: row.genres.length,
      genres: row.genres.join(", "),
    })),
  );

  section(
    `Non-canonical genres for their media type (${nonCanonical.length} items)`,
    nonCanonical.map((row) => ({
      title: row.title,
      type: row.mediaType,
      invalid: row.invalid.join(", "),
    })),
  );

  console.log(
    "\nNothing was written. Review the lists above and clean up by hand, " +
      "or ask for a targeted fix script.",
  );
}

function section(heading: string, rows: object[]) {
  console.log(`\n=== ${heading} ===`);
  if (rows.length === 0) {
    console.log("None.");
    return;
  }
  console.table(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
