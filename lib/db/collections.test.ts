import { describe, expect, it } from "vitest";
import {
  currentMonth,
  groupItemsBySection,
  type CollectionItem,
  type CollectionSection,
} from "@/lib/db/collections";

function section(id: string, position: number): CollectionSection {
  return { id, title: `Section ${id}`, description: null, position };
}

function item(id: string, sectionId: string | null): CollectionItem {
  return {
    id,
    sectionId,
    rank: null,
    note: null,
    media: {
      id: `m-${id}`,
      title: `Media ${id}`,
      mediaType: "MOVIE",
      posterUrl: null,
      releaseDate: null,
    },
  };
}

describe("currentMonth", () => {
  it("formats as YYYY-MM", () => {
    expect(currentMonth()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });
});

describe("groupItemsBySection", () => {
  it("separates ungrouped items and orders sections by position", () => {
    const sections = [section("b", 1), section("a", 0)];
    const items = [
      item("1", null),
      item("2", "a"),
      item("3", "b"),
      item("4", "a"),
      item("5", null),
    ];

    const { ungrouped, sectionGroups } = groupItemsBySection(sections, items);

    expect(ungrouped.map((i) => i.id)).toEqual(["1", "5"]);
    expect(sectionGroups.map((g) => g.section.id)).toEqual(["a", "b"]);
    expect(sectionGroups[0]!.items.map((i) => i.id)).toEqual(["2", "4"]);
    expect(sectionGroups[1]!.items.map((i) => i.id)).toEqual(["3"]);
  });

  it("returns empty item arrays for sections with no items", () => {
    const { ungrouped, sectionGroups } = groupItemsBySection(
      [section("a", 0)],
      [item("1", null)],
    );
    expect(ungrouped).toHaveLength(1);
    expect(sectionGroups[0]!.items).toEqual([]);
  });

  it("drops items whose section no longer exists from groups", () => {
    // An item pointing at a stale sectionId simply doesn't surface under any
    // rendered section (it also isn't ungrouped).
    const { ungrouped, sectionGroups } = groupItemsBySection(
      [section("a", 0)],
      [item("1", "gone")],
    );
    expect(ungrouped).toEqual([]);
    expect(sectionGroups[0]!.items).toEqual([]);
  });
});
