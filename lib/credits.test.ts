import { describe, expect, it } from "vitest";
import {
  contributorKey,
  creditKindForRole,
  creditLabel,
  splitCreditNames,
} from "@/lib/credits";

describe("media credits", () => {
  it("labels roles by media type", () => {
    expect(creditLabel("MOVIE", "DIRECTOR")).toBe("Directed by");
    expect(creditLabel("TV_SHOW", "CREATOR")).toBe("Created by");
    expect(creditLabel("VIDEO_GAME", "DEVELOPER")).toBe("Developed by");
    expect(creditLabel("VIDEO_GAME", "PUBLISHER")).toBe("Published by");
  });

  it("normalizes contributor keys and semicolon-separated names", () => {
    expect(contributorKey(" Martin  Scorsese ")).toBe("martin scorsese");
    expect(splitCreditNames("Nintendo; Bandai Namco, FromSoftware")).toEqual([
      "Nintendo",
      "Bandai Namco",
      "FromSoftware",
    ]);
  });

  it("uses companies for game studio roles and people for creator roles", () => {
    expect(creditKindForRole("DEVELOPER")).toBe("COMPANY");
    expect(creditKindForRole("PUBLISHER")).toBe("COMPANY");
    expect(creditKindForRole("DIRECTOR")).toBe("PERSON");
    expect(creditKindForRole("CREATOR")).toBe("PERSON");
  });
});
