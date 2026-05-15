import { describe, expect, it } from "vitest";
import {
  findExistingMediaItem,
  mediaMutationDataWithUniqueTitle,
  mediaReleaseYear,
  mediaTitleBase,
} from "@/lib/media";
import type { MediaFormInput } from "@/lib/types";

describe("media title disambiguation", () => {
  it("strips a trailing release year from the comparable title base", () => {
    expect(mediaTitleBase("Sabrina (1954)")).toBe("Sabrina");
    expect(mediaTitleBase("Sabrina")).toBe("Sabrina");
  });

  it("reads the UTC year from a release date", () => {
    expect(mediaReleaseYear(new Date("1995-12-15T00:00:00.000Z"))).toBe(1995);
    expect(mediaReleaseYear(null)).toBeNull();
  });

  it("adds years to same-type title collisions and updates the existing item", async () => {
    const updates: Array<{ where: { id: string }; data: { title: string } }> =
      [];
    const client = {
      mediaItem: {
        findMany: async (args: { where: { mediaType: string } }) =>
          args.where.mediaType === "MOVIE"
            ? [
                {
                  id: "existing",
                  title: "Sabrina",
                  releaseDate: new Date("1954-09-22T00:00:00.000Z"),
                },
              ]
            : [],
        update: async (args: {
          where: { id: string };
          data: { title: string };
        }) => {
          updates.push(args);
          return args;
        },
      },
    };

    const data = await mediaMutationDataWithUniqueTitle(
      client as never,
      mediaInput({
        title: "Sabrina",
        releaseDate: new Date("1995-12-15T00:00:00.000Z"),
      }),
    );

    expect(data.title).toBe("Sabrina (1995)");
    expect(updates).toEqual([
      { where: { id: "existing" }, data: { title: "Sabrina (1954)" } },
    ]);
  });

  it("keeps the clean title when there is no same-type collision", async () => {
    const client = {
      mediaItem: {
        findMany: async (args: { where: { mediaType: string } }) =>
          args.where.mediaType === "MOVIE"
            ? [
                {
                  id: "existing",
                  title: "Sabrina",
                  releaseDate: new Date("1954-09-22T00:00:00.000Z"),
                },
              ]
            : [],
        update: async () => {
          throw new Error("Unexpected update");
        },
      },
    };

    const data = await mediaMutationDataWithUniqueTitle(
      client as never,
      mediaInput({
        title: "Sabrina",
        mediaType: "TV_SHOW",
        releaseDate: new Date("1995-12-15T00:00:00.000Z"),
      }),
    );

    expect(data.title).toBe("Sabrina");
  });

  it("finds existing same-type items only when the release year is compatible", async () => {
    const client = {
      mediaItem: {
        findMany: async () => [
          {
            id: "older",
            title: "Sabrina (1954)",
            releaseDate: new Date("1954-09-22T00:00:00.000Z"),
          },
          {
            id: "newer",
            title: "Sabrina (1995)",
            releaseDate: new Date("1995-12-15T00:00:00.000Z"),
          },
        ],
      },
    };

    await expect(
      findExistingMediaItem(
        client as never,
        mediaInput({
          title: "Sabrina",
          releaseDate: new Date("1995-01-01T00:00:00.000Z"),
        }),
      ),
    ).resolves.toMatchObject({ id: "newer" });

    await expect(
      findExistingMediaItem(
        client as never,
        mediaInput({
          title: "Sabrina",
          releaseDate: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ),
    ).resolves.toBeNull();
  });

  it("matches existing titles across accent differences", async () => {
    const client = {
      mediaItem: {
        findMany: async () => [
          {
            id: "accented",
            title: "Ghost of Yōtei",
            releaseDate: new Date("2025-10-02T00:00:00.000Z"),
          },
        ],
      },
    };

    await expect(
      findExistingMediaItem(
        client as never,
        mediaInput({
          title: "Ghost of Yotei",
          mediaType: "VIDEO_GAME",
          releaseDate: new Date("2025-01-01T00:00:00.000Z"),
        }),
      ),
    ).resolves.toMatchObject({ id: "accented" });
  });
});

function mediaInput(overrides: Partial<MediaFormInput> = {}): MediaFormInput {
  return {
    title: "Heat",
    mediaType: "MOVIE",
    status: "WATCHLIST",
    description: "",
    releaseDate: null,
    externalUrl: "",
    personalRating: null,
    isFavorite: false,
    genres: [],
    tags: [],
    ...overrides,
  };
}
