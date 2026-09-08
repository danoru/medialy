import { describe, expect, it } from "vitest";
import {
  manualRatingRemoveField,
  manualRatingsForMediaType,
  parseManualExternalRatingRemovals,
  parseManualExternalRatings,
  planManualExternalRatingWrites,
} from "@/lib/external-ratings";

/**
 * These tests exist because the old behavior lost real data.
 *
 * `replaceManualExternalRatings` used to delete any manual source whose form
 * field arrived blank. Every edit was therefore a potential deletion: a stale
 * form, or an approved edit suggestion whose snapshot predated a fetched
 * score, would silently drop it. The rule now is that only an explicit removal
 * deletes, and that is what these lock down.
 */
describe("planManualExternalRatingWrites", () => {
  it("does not touch a source whose field arrived blank", () => {
    expect(planManualExternalRatingWrites("MOVIE", [], [])).toEqual([]);
    expect(
      planManualExternalRatingWrites("MOVIE", undefined, undefined),
    ).toEqual([]);
  });

  it("writes only the scores actually provided", () => {
    const writes = planManualExternalRatingWrites(
      "MOVIE",
      [{ source: "METACRITIC", score: 88, scale: 100 }],
      [],
    );

    expect(writes).toEqual([
      { source: "METACRITIC", action: "upsert", score: 88, scale: 100 },
    ]);
    // Rotten Tomatoes is also a manual source for MOVIE, and was left blank —
    // it must not appear at all, in any form.
    expect(writes.some((w) => w.source === "ROTTEN_TOMATOES_CRITICS")).toBe(
      false,
    );
  });

  it("deletes only when the source is explicitly removed", () => {
    expect(planManualExternalRatingWrites("MOVIE", [], ["METACRITIC"])).toEqual(
      [{ source: "METACRITIC", action: "delete" }],
    );
  });

  it("prefers a provided score over a removal for the same source", () => {
    const writes = planManualExternalRatingWrites(
      "MOVIE",
      [{ source: "METACRITIC", score: 70, scale: 100 }],
      ["METACRITIC"],
    );

    expect(writes).toEqual([
      { source: "METACRITIC", action: "upsert", score: 70, scale: 100 },
    ]);
  });

  it("ignores sources that don't apply to the media type", () => {
    // OpenCritic is games-only; proposing it for a film writes nothing.
    expect(
      planManualExternalRatingWrites(
        "MOVIE",
        [{ source: "OPENCRITIC", score: 90, scale: 100 }],
        [],
      ),
    ).toEqual([]);
  });

  it("offers OpenCritic for games and not for films or shows", () => {
    const sourcesFor = (mediaType: "MOVIE" | "TV_SHOW" | "VIDEO_GAME") =>
      manualRatingsForMediaType(mediaType).map((def) => def.source);

    expect(sourcesFor("VIDEO_GAME")).toContain("OPENCRITIC");
    expect(sourcesFor("MOVIE")).not.toContain("OPENCRITIC");
    expect(sourcesFor("TV_SHOW")).not.toContain("OPENCRITIC");
  });
});

describe("parsing a submitted edit form", () => {
  it("treats an empty field as no opinion rather than a deletion", () => {
    const formData = new FormData();
    formData.set("externalRating:METACRITIC", "");

    expect(parseManualExternalRatings(formData, "MOVIE")).toEqual([]);
    expect(parseManualExternalRatingRemovals(formData, "MOVIE")).toEqual([]);
    expect(
      planManualExternalRatingWrites(
        "MOVIE",
        parseManualExternalRatings(formData, "MOVIE"),
        parseManualExternalRatingRemovals(formData, "MOVIE"),
      ),
    ).toEqual([]);
  });

  it("reads a ticked removal checkbox", () => {
    const formData = new FormData();
    formData.set("externalRating:METACRITIC", "");
    formData.set(manualRatingRemoveField("METACRITIC"), "on");

    expect(parseManualExternalRatingRemovals(formData, "MOVIE")).toEqual([
      "METACRITIC",
    ]);
  });

  it("rejects a score outside the source's scale", () => {
    const formData = new FormData();
    formData.set("externalRating:METACRITIC", "140");

    expect(() => parseManualExternalRatings(formData, "MOVIE")).toThrow(
      /between 0 and 100/,
    );
  });
});
