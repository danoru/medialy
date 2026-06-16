import { describe, expect, it } from "vitest";
import {
  formatUpcomingRelativeLabel,
  recentlyReleasedSince,
  sortUpcomingItems,
  startOfToday,
} from "@/lib/upcoming";

function datedItem(title: string, date: string) {
  return { title, releaseDate: new Date(`${date}T12:00:00`) };
}

describe("sortUpcomingItems", () => {
  it("sorts by date, breaking ties on title", () => {
    const sorted = sortUpcomingItems([
      datedItem("Zeta", "2026-05-20"),
      datedItem("Beyond", "2026-06-13"),
      datedItem("Alpha", "2026-05-20"),
    ]);

    expect(sorted.map((item) => item.title)).toEqual([
      "Alpha",
      "Zeta",
      "Beyond",
    ]);
  });
});

describe("upcoming labels", () => {
  const now = new Date("2026-05-13T15:30:00");

  it("formats relative date labels from the start of today", () => {
    expect(
      formatUpcomingRelativeLabel(new Date("2026-05-13T23:00:00"), now),
    ).toBe("Today");
    expect(
      formatUpcomingRelativeLabel(new Date("2026-05-14T00:00:00"), now),
    ).toBe("Tomorrow");
    expect(
      formatUpcomingRelativeLabel(new Date("2026-05-25T00:00:00"), now),
    ).toBe("In 12 days");
    expect(
      formatUpcomingRelativeLabel(new Date("2026-05-10T00:00:00"), now),
    ).toBe("3 days ago");
  });

  it("returns local midnight for start of today", () => {
    expect(startOfToday(now)).toEqual(new Date("2026-05-13T00:00:00"));
  });
});

describe("recentlyReleasedSince", () => {
  const now = new Date("2026-05-13T15:30:00");

  it("looks back the default 90-day window from the start of today", () => {
    expect(recentlyReleasedSince(now)).toEqual(new Date("2026-02-12T00:00:00"));
  });

  it("respects a custom window length", () => {
    expect(recentlyReleasedSince(now, 30)).toEqual(
      new Date("2026-04-13T00:00:00"),
    );
  });
});
