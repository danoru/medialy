import { describe, expect, it } from "vitest";
import {
  formatUpcomingRelativeLabel,
  layoutReleaseRadar,
  RADAR_BLIP_PADDING,
  RADAR_HEIGHT,
  RADAR_ORIGIN,
  RADAR_TOP_PADDING,
  RADAR_WIDTH,
  radarBlipSize,
  radarRadiusForDays,
  recentlyReleasedSince,
  sortUpcomingItems,
  startOfToday,
} from "@/lib/upcoming";

function datedItem(title: string, date: string) {
  return { title, releaseDate: new Date(`${date}T12:00:00`) };
}

function radarItem(id: string, title: string, date: string) {
  return { id, title, releaseDate: new Date(`${date}T12:00:00`) };
}

function distanceFromOrigin(point: { x: number; y: number }) {
  return Math.hypot(point.x - RADAR_ORIGIN.x, point.y - RADAR_ORIGIN.y);
}

type PlacedBlip = { x: number; y: number; size: number };

/** Air between two blips' boxes — matches the Chebyshev rule the layout uses,
 * so a negative result means they visibly overlap. */
function blipGap(a: PlacedBlip, b: PlacedBlip) {
  const half = (a.size + b.size) / 2;
  return Math.max(Math.abs(a.x - b.x) - half, Math.abs(a.y - b.y) - half);
}

function closestGap(points: PlacedBlip[]) {
  let closest = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      closest = Math.min(closest, blipGap(points[i], points[j]));
    }
  }
  return closest;
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

describe("radarRadiusForDays", () => {
  it("spans the full radius across the horizon", () => {
    expect(radarRadiusForDays(0)).toBe(60);
    expect(radarRadiusForDays(90)).toBe(660);
  });

  it("pushes the 90-day ring out to the plot's right edge", () => {
    // The outer ring deliberately overshoots the plot's height so the far
    // band spreads along the full width instead of bunching in a corner.
    expect(RADAR_ORIGIN.x + radarRadiusForDays(90)).toBeGreaterThan(
      RADAR_WIDTH - 40,
    );
  });

  it("gives every equal stretch of time an equal area to occupy", () => {
    // The point of the equal-area mapping: each 30-day band is the same
    // annular area, so near-term releases get real room instead of being
    // crushed into the short arcs by the origin.
    const areaOf = (from: number, to: number) =>
      Math.PI * (radarRadiusForDays(to) ** 2 - radarRadiusForDays(from) ** 2);

    expect(areaOf(30, 60)).toBeCloseTo(areaOf(0, 30), 5);
    expect(areaOf(60, 90)).toBeCloseTo(areaOf(0, 30), 5);
  });

  it("pushes the near-term band outward compared with a linear mapping", () => {
    // A linear mapping would put day 19 at 60 + (19/90)·380 ≈ 140.
    expect(radarRadiusForDays(19)).toBeGreaterThan(200);
  });

  it("clamps outside the 0–90 domain", () => {
    expect(radarRadiusForDays(-10)).toBe(60);
    expect(radarRadiusForDays(200)).toBe(660);
  });
});

describe("radarBlipSize", () => {
  it("shrinks band by band, so nearer releases read largest", () => {
    expect(radarBlipSize(0)).toBe(48);
    expect(radarBlipSize(30)).toBe(48);
    expect(radarBlipSize(31)).toBe(40);
    expect(radarBlipSize(60)).toBe(40);
    expect(radarBlipSize(61)).toBe(32);
    expect(radarBlipSize(90)).toBe(32);
  });

  it("falls back to the outermost size past the horizon", () => {
    expect(radarBlipSize(400)).toBe(32);
  });
});

describe("layoutReleaseRadar", () => {
  const now = new Date("2026-05-13T15:30:00");

  it("drops items without a release date or outside the horizon", () => {
    const points = layoutReleaseRadar(
      [
        { id: "a", title: "No date", releaseDate: null },
        { id: "b", title: "Garbage", releaseDate: "not-a-date" },
        radarItem("c", "Past the edge", "2026-08-12"),
        radarItem("d", "In range", "2026-05-20"),
      ],
      now,
    );

    expect(points.map((point) => point.item.title)).toEqual(["In range"]);
  });

  it("places marks at the radius their day offset predicts", () => {
    const points = layoutReleaseRadar(
      [
        radarItem("thirty", "Thirty days out", "2026-06-12"),
        radarItem("sixty", "Sixty days out", "2026-07-12"),
      ],
      now,
    );

    const byTitle = new Map(points.map((point) => [point.item.title, point]));
    expect(distanceFromOrigin(byTitle.get("Thirty days out")!)).toBeCloseTo(
      radarRadiusForDays(30),
      0,
    );
    expect(distanceFromOrigin(byTitle.get("Sixty days out")!)).toBeCloseTo(
      radarRadiusForDays(60),
      0,
    );
  });

  it("is deterministic — the same date lands in the same spot across calls", () => {
    const items = [radarItem("stable-id", "Repeatable", "2026-06-01")];
    const first = layoutReleaseRadar(items, now);
    const second = layoutReleaseRadar(items, now);

    expect(first[0].x).toBe(second[0].x);
    expect(first[0].y).toBe(second[0].y);
  });

  it("keeps same-date releases from stacking on one another", () => {
    // Four releases sharing a date share a radius exactly — the case that
    // previously drew four dots 3px apart.
    const points = layoutReleaseRadar(
      [
        radarItem("buddy", "Buddy", "2026-05-26"),
        radarItem("idiots", "Idiots", "2026-05-26"),
        radarItem("coyote", "Coyote vs. Acme", "2026-05-26"),
        radarItem("dogstars", "The Dog Stars", "2026-05-26"),
      ],
      now,
    );

    expect(points).toHaveLength(4);
    expect(closestGap(points)).toBeGreaterThanOrEqual(RADAR_BLIP_PADDING);
  });

  it("separates a realistic dense slate across the whole horizon", () => {
    // 14 releases clustered on a handful of dates, mirroring one media
    // type's real 90-day slate.
    const dates = [
      "2026-05-14",
      "2026-05-26",
      "2026-05-26",
      "2026-05-26",
      "2026-05-26",
      "2026-06-10",
      "2026-06-10",
      "2026-06-17",
      "2026-06-24",
      "2026-07-01",
      "2026-07-08",
      "2026-07-08",
      "2026-07-15",
      "2026-08-05",
    ];
    const points = layoutReleaseRadar(
      dates.map((date, i) => radarItem(`item-${i}`, `Release ${i}`, date)),
      now,
    );

    // The target spacing isn't always reachable — this slate puts four
    // releases on one date low on the plot, where the arc simply isn't long
    // enough. What must never give is the marks overlapping: the layout
    // falls back to the roomiest angle it found rather than stacking them.
    expect(points).toHaveLength(dates.length);
    expect(closestGap(points)).toBeGreaterThan(0);
  });

  it("hits the full target spacing on a slate with room for it", () => {
    const dates = [
      "2026-05-16",
      "2026-05-24",
      "2026-06-04",
      "2026-06-19",
      "2026-07-02",
      "2026-07-14",
      "2026-07-28",
      "2026-08-09",
    ];
    const points = layoutReleaseRadar(
      dates.map((date, i) => radarItem(`item-${i}`, `Release ${i}`, date)),
      now,
    );

    expect(closestGap(points)).toBeGreaterThanOrEqual(RADAR_BLIP_PADDING);
  });

  it("sizes each blip for the band it lands in", () => {
    const points = layoutReleaseRadar(
      [
        radarItem("soon", "Soon", "2026-05-20"),
        radarItem("mid", "Mid", "2026-06-20"),
        radarItem("far", "Far", "2026-07-20"),
      ],
      now,
    );

    expect(points.map((point) => point.size)).toEqual([48, 40, 32]);
  });

  it("keeps every blip's box inside the plot", () => {
    const dates = [
      "2026-05-14",
      "2026-05-14",
      "2026-05-26",
      "2026-06-10",
      "2026-06-10",
      "2026-06-10",
      "2026-07-01",
      "2026-08-05",
      "2026-08-05",
      "2026-08-11",
    ];
    const points = layoutReleaseRadar(
      dates.map((date, i) => radarItem(`item-${i}`, `Release ${i}`, date)),
      now,
    );

    for (const point of points) {
      const half = point.size / 2;
      expect(point.x - half).toBeGreaterThanOrEqual(0);
      expect(point.x + half).toBeLessThanOrEqual(RADAR_WIDTH);
      expect(point.y - half).toBeGreaterThanOrEqual(0);
      expect(point.y + half).toBeLessThanOrEqual(RADAR_HEIGHT);
    }
  });

  it("caps far-out points so they never cross the top padding", () => {
    // Every angle bucket the hash could produce should still respect the
    // padding once the radius (day=90) is large enough to need capping.
    const points = layoutReleaseRadar(
      Array.from({ length: 12 }, (_, i) =>
        radarItem(`far-${i}`, `Far ${i}`, "2026-08-11"),
      ),
      now,
    );

    for (const point of points) {
      expect(point.y).toBeGreaterThanOrEqual(RADAR_TOP_PADDING - 0.5);
    }
  });
});
