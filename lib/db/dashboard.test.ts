import { describe, expect, it } from "vitest";
import {
  dashboardUpcomingOrderBy,
  getDashboardUpcomingWhere,
} from "@/lib/db/dashboard";

describe("dashboard upcoming query", () => {
  it("selects the next non-archived upcoming items without status filtering", () => {
    const today = new Date("2026-05-13T00:00:00");

    expect(getDashboardUpcomingWhere(today)).toEqual({
      isArchived: false,
      mediaType: { in: ["MOVIE", "TV_SHOW", "VIDEO_GAME"] },
      releaseDate: { gte: today },
    });
  });

  it("sorts upcoming dashboard items by date, then title", () => {
    expect(dashboardUpcomingOrderBy).toEqual([
      { releaseDate: "asc" },
      { title: "asc" },
    ]);
  });
});
