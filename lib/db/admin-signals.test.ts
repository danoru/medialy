import { describe, expect, it } from "vitest";
import { bucketByDay } from "./admin-signals";

describe("bucketByDay", () => {
  const now = new Date("2026-05-22T12:00:00Z");

  it("returns one bucket per requested day", () => {
    const buckets = bucketByDay([], 30, now);
    expect(buckets).toHaveLength(30);
  });

  it("fills empty days with zero counts", () => {
    const buckets = bucketByDay([], 5, now);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("ends on today's UTC date", () => {
    const buckets = bucketByDay([], 3, now);
    expect(buckets.at(-1)?.date).toBe("2026-05-22");
    expect(buckets[0]?.date).toBe("2026-05-20");
  });

  it("counts timestamps into their UTC day", () => {
    const stamps = [
      new Date("2026-05-22T01:00:00Z"),
      new Date("2026-05-22T23:00:00Z"),
      new Date("2026-05-21T10:00:00Z"),
      new Date("2026-04-01T10:00:00Z"), // outside window — dropped
    ];
    const buckets = bucketByDay(stamps, 7, now);
    const map = new Map(buckets.map((b) => [b.date, b.count]));
    expect(map.get("2026-05-22")).toBe(2);
    expect(map.get("2026-05-21")).toBe(1);
    expect(map.get("2026-05-20")).toBe(0);
  });
});
