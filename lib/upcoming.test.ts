import { describe, expect, it } from "vitest";
import {
  formatUpcomingRelativeLabel,
  groupUpcomingItems,
  startOfToday,
} from "@/lib/upcoming";

function datedItem(title: string, date: string) {
  return { title, upcomingDate: new Date(`${date}T12:00:00`) };
}

describe("upcoming grouping", () => {
  const now = new Date("2026-05-13T15:30:00");

  it("splits future dates into next 30 days and later", () => {
    const groups = groupUpcomingItems(
      [
        datedItem("Beyond", "2026-06-13"),
        datedItem("Soon", "2026-05-25"),
        datedItem("Boundary", "2026-06-12"),
      ],
      now,
    );

    expect(groups.next30Days.map((item) => item.title)).toEqual([
      "Soon",
      "Boundary",
    ]);
    expect(groups.later.map((item) => item.title)).toEqual(["Beyond"]);
    expect(groups.needsReview).toEqual([]);
  });

  it("puts past dates in needs review", () => {
    const groups = groupUpcomingItems(
      [
        datedItem("Yesterday", "2026-05-12"),
        datedItem("Last week", "2026-05-06"),
      ],
      now,
    );

    expect(groups.needsReview.map((item) => item.title)).toEqual([
      "Last week",
      "Yesterday",
    ]);
    expect(groups.next30Days).toEqual([]);
  });

  it("counts today as upcoming, not past", () => {
    const groups = groupUpcomingItems([datedItem("Today", "2026-05-13")], now);

    expect(groups.next30Days.map((item) => item.title)).toEqual(["Today"]);
    expect(groups.needsReview).toEqual([]);
  });

  it("sorts matching dates by title", () => {
    const groups = groupUpcomingItems(
      [datedItem("Zeta", "2026-05-20"), datedItem("Alpha", "2026-05-20")],
      now,
    );

    expect(groups.next30Days.map((item) => item.title)).toEqual([
      "Alpha",
      "Zeta",
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
