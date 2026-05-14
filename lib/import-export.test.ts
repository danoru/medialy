import { describe, expect, it } from "vitest";
import {
  buildMediaImportTemplateCsv,
  buildMediaImportTemplateXlsx,
  mapTabularMediaRows,
  parseLetterboxdRowsForImport,
  parseMediaCsv,
  parseMediaCsvTabular,
  parseMediaXlsx,
  suggestMediaImportMapping,
} from "@/lib/import-export";
import { mediaFormInputFromCsvRow } from "@/lib/validation";

describe("media csv import", () => {
  it("parses genres and tags from semicolon-separated columns", () => {
    const [row] = parseMediaCsv(
      "title,mediaType,status,releaseDate,personalRating,genres,tags,description,externalUrl\n" +
        "Heat,MOVIE,WATCHLIST,1995-12-15,9,Crime;Drama,heist;rewatchable,Classic,http://example.test",
    );
    const input = mediaFormInputFromCsvRow(row);

    expect(input.genres).toEqual(["Crime", "Drama"]);
    expect(input.tags).toEqual(["Heist", "Rewatchable"]);
    expect(input.personalRating).toBe(9);
  });

  it("moves noncanonical imported genre labels into normalized tags", () => {
    const [row] = parseMediaCsv(
      "title,mediaType,status,genres,tags\n" +
        "Blade Runner,MOVIE,COMPLETED,Sci-Fi;Cyberpunk,found-family",
    );
    const input = mediaFormInputFromCsvRow(row);

    expect(input.genres).toEqual(["Science Fiction"]);
    expect(input.tags).toEqual(["Cyberpunk", "Found Family"]);
  });

  it("returns row-level validation errors for invalid enum values", () => {
    const [row] = parseMediaCsv(
      "title,mediaType,status\nBad,NOT_A_TYPE,WATCHLIST",
    );

    expect(() => mediaFormInputFromCsvRow(row)).toThrow(/Invalid media type/);
  });

  it("parses the generated XLSX template into media rows", async () => {
    const tabular = await parseMediaXlsx(await buildMediaImportTemplateXlsx());
    const [row] = mapTabularMediaRows(tabular);
    const input = mediaFormInputFromCsvRow(row);

    expect(input.title).toBe("Heat");
    expect(input.mediaType).toBe("MOVIE");
    expect(input.isFavorite).toBe(true);
  });

  it("parses the generated CSV template into media rows", () => {
    const [row] = parseMediaCsv(buildMediaImportTemplateCsv());
    const input = mediaFormInputFromCsvRow(row);

    expect(input.title).toBe("Heat");
    expect(input.mediaType).toBe("MOVIE");
  });

  it("maps custom column headers to medialy fields", () => {
    const mapping = suggestMediaImportMapping(["Name", "Type", "My Score"]);
    const [row] = mapTabularMediaRows(
      {
        headers: ["Name", "Type", "My Score"],
        rows: [{ Name: "Arrival", Type: "MOVIE", "My Score": "8.5" }],
      },
      { ...mapping, personalRating: "My Score" },
    );
    const input = mediaFormInputFromCsvRow(row);

    expect(input.title).toBe("Arrival");
    expect(input.personalRating).toBe(8.5);
  });

  it("maps Letterboxd watchlist exports to movie watchlist rows", () => {
    const parsed = parseLetterboxdRowsForImport(
      parseMediaCsvTabular(
        "Date,Name,Year,Letterboxd URI\n2026-05-01,Heat,1995,https://boxd.it/29qU",
      ),
      "watchlist",
    );
    const [input] = parsed.rows;

    expect(parsed.errors).toEqual([]);
    expect(input.title).toBe("Heat");
    expect(input.mediaType).toBe("MOVIE");
    expect(input.status).toBe("WATCHLIST");
    expect(input.releaseDate?.toISOString().slice(0, 10)).toBe("1995-01-01");
    expect(input.externalUrl).toBe("https://boxd.it/29qU");
    expect(JSON.parse(input.metadataJson ?? "{}")).toEqual({
      letterboxd: {
        addedDate: "2026-05-01",
        sourceStatus: "watchlist",
        uri: "https://boxd.it/29qU",
        year: "1995",
      },
    });
  });

  it("maps Letterboxd watched exports to completed rows and converts ratings to a 10-point scale", () => {
    const parsed = parseLetterboxdRowsForImport(
      parseMediaCsvTabular(
        "Date,Name,Year,Letterboxd URI,Rating\n2026-05-01,Arrival,2016,https://boxd.it/aNGk,4.5",
      ),
      "watched",
    );
    const [input] = parsed.rows;

    expect(parsed.errors).toEqual([]);
    expect(input.status).toBe("COMPLETED");
    expect(input.personalRating).toBe(9);
  });

  it("returns row-level Letterboxd errors for rows without a name", () => {
    const parsed = parseLetterboxdRowsForImport(
      parseMediaCsvTabular(
        "Date,Name,Year,Letterboxd URI\n2026-05-01,,1995,https://boxd.it/29qU",
      ),
      "watchlist",
    );

    expect(parsed.rows).toEqual([]);
    expect(parsed.errors).toEqual([{ row: 2, message: "Name is required." }]);
  });
});
