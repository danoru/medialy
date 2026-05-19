import { describe, expect, it } from "vitest";
import { sortMediaTitleRows } from "@/lib/media-sort";

describe("sortMediaTitleRows", () => {
  it("sorts lowercase titles alongside uppercase titles", () => {
    const sorted = sortMediaTitleRows([
      { id: "zootopia", title: "Zootopia 2" },
      { id: "mother", title: "mother!" },
      { id: "mortal", title: "Mortal Kombat: Annihilation" },
    ]);

    expect(sorted.map((item) => item.title)).toEqual([
      "Mortal Kombat: Annihilation",
      "mother!",
      "Zootopia 2",
    ]);
  });
});
