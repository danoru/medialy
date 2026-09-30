import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/catalog", () => ({
  getCatalogItems: vi.fn(),
  getCatalogWithUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/user", () => ({ getCurrentUserId: vi.fn() }));

type Credit = { id: string; name: string; role: string };
function item(id: string, mediaType: string, credits: Credit[]) {
  return {
    id,
    mediaType,
    credits: credits.map((c) => ({
      role: c.role,
      contributor: { id: c.id, name: c.name, kind: "PERSON" },
    })),
  };
}

async function matches(items: unknown[], search: string, limit?: number) {
  vi.resetModules();
  const catalog = await import("@/lib/db/catalog");
  vi.mocked(catalog.getCatalogItems).mockResolvedValue(items as never);
  const { getLibraryPeopleMatches } = await import("@/lib/db/people");
  return getLibraryPeopleMatches(search, limit);
}

const scorsese = { id: "p1", name: "Martin Scorsese", role: "DIRECTOR" };
const heather = { id: "p2", name: "Heather Graham", role: "ACTOR" };
const inarritu = { id: "p3", name: "Alejandro González Iñárritu", role: "DIRECTOR" };

beforeEach(() => vi.clearAllMocks());

describe("getLibraryPeopleMatches", () => {
  it("suggests substring matches but merges only whole-word ones", async () => {
    const items = [
      item("m1", "MOVIE", [scorsese]),
      item("m2", "MOVIE", [heather]),
    ];
    const partial = await matches(items, "scor");
    expect(partial.people.map((p) => p.name)).toEqual(["Martin Scorsese"]);
    expect(partial.merged).toEqual([]);
    expect(partial.mergedMediaIds).toEqual([]);

    const whole = await matches(items, "scorsese");
    expect(whole.merged).toEqual([{ id: "p1", name: "Martin Scorsese" }]);
    expect(whole.mergedMediaIds).toEqual(["m1"]);

    const heat = await matches(items, "heat");
    expect(heat.people.map((p) => p.name)).toEqual(["Heather Graham"]);
    expect(heat.merged).toEqual([]);
    expect(heat.mergedMediaIds).toEqual([]);
  });

  it("folds accents", async () => {
    const result = await matches([item("m1", "MOVIE", [inarritu])], "inarritu");
    expect(result.people.map((p) => p.name)).toEqual(["Alejandro González Iñárritu"]);
    expect(result.merged).toHaveLength(1);
  });

  it("does not merge when more than 3 people match a whole word", async () => {
    const smiths = ["a", "b", "c", "d", "e", "f"].map((k) => ({
      id: `s${k}`,
      name: `${k.toUpperCase()} Smith`,
      role: "ACTOR",
    }));
    const items = smiths.map((s, i) => item(`m${i}`, "MOVIE", [s]));
    const result = await matches(items, "smith");
    expect(result.merged).toEqual([]);
    expect(result.mergedMediaIds).toEqual([]);
    expect(result.people).toHaveLength(5);
  });

  it("returns nothing for short queries and ignores a trailing star", async () => {
    const items = [item("m1", "MOVIE", [scorsese])];
    const short = await matches(items, "s");
    expect(short).toEqual({
      people: [],
      wholeWordCount: 0,
      merged: [],
      mergedMediaIds: [],
    });
    const starShort = await matches(items, "s*");
    expect(starShort.people).toEqual([]);
    const star = await matches(items, "scorsese*");
    expect(star.merged).toHaveLength(1);
  });

  it("matches names at word starts, never mid-word", async () => {
    const items = [
      item("m1", "MOVIE", [{ id: "p10", name: "Ang Lee", role: "DIRECTOR" }]),
      item("m2", "MOVIE", [{ id: "p11", name: "Hailee Steinfeld", role: "ACTOR" }]),
      item("m3", "MOVIE", [{ id: "p12", name: "Brendan Gleeson", role: "ACTOR" }]),
    ];
    const lee = await matches(items, "lee");
    expect(lee.people.map((p) => p.name)).toEqual(["Ang Lee"]);
    expect(lee.wholeWordCount).toBe(1);
  });

  it("counts a title once per type even with two roles on it", async () => {
    const items = [
      item("m1", "MOVIE", [
        { ...scorsese, role: "DIRECTOR" },
        { ...scorsese, role: "ACTOR" },
      ]),
      item("m2", "MOVIE", [scorsese]),
      item("g1", "VIDEO_GAME", [scorsese]),
    ];
    const [person] = (await matches(items, "scorsese")).people;
    expect(person.titleCount).toBe(3);
    expect(person.types).toEqual(
      expect.arrayContaining([
        { mediaType: "MOVIE", count: 2 },
        { mediaType: "VIDEO_GAME", count: 1 },
      ]),
    );
  });
});

describe("searchCatalogPeople", () => {
  async function suggest(items: unknown[], search: string, kind: "PERSON" | "COMPANY") {
    vi.resetModules();
    const catalog = await import("@/lib/db/catalog");
    vi.mocked(catalog.getCatalogItems).mockResolvedValue(items as never);
    const { searchCatalogPeople } = await import("@/lib/db/people");
    return searchCatalogPeople(search, kind);
  }

  const company = (id: string, mediaType: string, name: string) => ({
    id,
    mediaType,
    credits: [{ role: "DEVELOPER", contributor: { id: `c-${name}`, name, kind: "COMPANY" } }],
  });

  it("suggests people of the right kind by word start, name-first then most prolific", async () => {
    const items = [
      item("m1", "MOVIE", [{ id: "p1", name: "Tom Hardy", role: "ACTOR" }]),
      item("m2", "MOVIE", [{ id: "p2", name: "Tom Hanks", role: "ACTOR" }]),
      item("m3", "MOVIE", [{ id: "p2", name: "Tom Hanks", role: "ACTOR" }]),
      item("m4", "MOVIE", [{ id: "p3", name: "Atom Egoyan", role: "DIRECTOR" }]),
      item("m5", "MOVIE", [{ id: "p4", name: "Ellen Tomlin", role: "ACTOR" }]),
      company("g1", "VIDEO_GAME", "Tomcat Studio"),
    ];
    const found = await suggest(items, "tom", "PERSON");
    // "Atom" is mid-word; the company is the wrong kind for an actor field.
    expect(found.map((p) => p.name)).toEqual(["Tom Hanks", "Tom Hardy", "Ellen Tomlin"]);
    expect(found[0]).toMatchObject({ roles: "Actor", titleCount: 2 });
    expect((await suggest(items, "tom", "COMPANY")).map((p) => p.name)).toEqual([
      "Tomcat Studio",
    ]);
  });

  it("needs two characters", async () => {
    expect(await suggest([item("m1", "MOVIE", [scorsese])], "m", "PERSON")).toEqual([]);
  });
});
