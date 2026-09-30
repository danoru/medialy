import { describe, expect, it, vi } from "vitest";
import {
  contributorKey,
  creditKindForRole,
  creditLabel,
  replaceMediaCredits,
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

describe("replaceMediaCredits", () => {
  function mockClient(previous: unknown[] = []) {
    const calls: string[] = [];
    const findMany = vi.fn(async () => {
      calls.push("findMany");
      return previous;
    });
    const deleteMany = vi.fn(async () => {
      calls.push("deleteMany");
      return { count: 0 };
    });
    const create = vi.fn(async () => ({}));
    const upsert = vi.fn(
      async (args: { create: { normalizedName: string } }) => ({
        id: `c:${args.create.normalizedName}`,
      }),
    );
    const client = {
      mediaCredit: { findMany, deleteMany, create },
      contributor: { upsert },
    };
    return { client: client as never, calls, findMany, deleteMany, create };
  }
  const created = (create: ReturnType<typeof vi.fn>) =>
    create.mock.calls.map((call) => (call[0] as { data: Record<string, unknown> }).data);

  it("writes aligned sourceIds with the source on each credit", async () => {
    const { client, create } = mockClient();
    await replaceMediaCredits(client, "m1", [
      { role: "DIRECTOR", kind: "PERSON", names: ["A", "B"], source: "TMDB", sourceIds: ["1", "2"] },
    ]);
    expect(created(create)).toEqual([
      expect.objectContaining({ role: "DIRECTOR", order: 0, source: "TMDB", sourceId: "1" }),
      expect.objectContaining({ role: "DIRECTOR", order: 1, source: "TMDB", sourceId: "2" }),
    ]);
  });

  it("keeps ids aligned after de-duplicating names", async () => {
    const { client, create } = mockClient();
    await replaceMediaCredits(client, "m1", [
      { role: "ACTOR", kind: "PERSON", names: ["A", "a ", "B"], source: "TMDB", sourceIds: ["1", "2", "3"] },
    ]);
    const rows = created(create);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ contributorId: "c:a", order: 0, sourceId: "1" });
    expect(rows[1]).toMatchObject({ contributorId: "c:b", order: 1, sourceId: "3" });
  });

  it("carries over a stored source and sourceId when the input has none", async () => {
    const { client, create } = mockClient([
      { contributorId: "c:a", role: "DIRECTOR", source: "TMDB", sourceId: "77" },
    ]);
    await replaceMediaCredits(client, "m1", [
      { role: "DIRECTOR", kind: "PERSON", names: ["A", "New"] },
    ]);
    const rows = created(create);
    expect(rows[0]).toMatchObject({ contributorId: "c:a", source: "TMDB", sourceId: "77" });
    expect(rows[1]).toMatchObject({ contributorId: "c:new", sourceId: null });
    expect(rows[1].source).toBeUndefined();
  });

  it("reads existing credits before deleting them", async () => {
    const { client, calls } = mockClient();
    await replaceMediaCredits(client, "m1", [
      { role: "DIRECTOR", kind: "PERSON", names: ["A"] },
    ]);
    expect(calls).toEqual(["findMany", "deleteMany"]);
  });
});
