import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({
  prisma: { userMedia: { findMany: vi.fn() } },
}));
vi.mock("@/lib/db/catalog", () => ({ getCatalogWithUser: vi.fn() }));
vi.mock("@/lib/social/follows", () => ({ getFollowingIds: vi.fn() }));
import { getCatalogWithUser, type CatalogItemWithUser } from "@/lib/db/catalog";
import { DEFAULT_USER_MEDIA } from "@/lib/db/user-media";
import { getFollowingIds } from "@/lib/social/follows";
import { prisma } from "@/lib/prisma";
import { getRecommendationsV2 } from "./recommendations-v2";

function catalogItem(
  id: string,
  overrides: Partial<CatalogItemWithUser> = {},
): CatalogItemWithUser {
  return {
    ...DEFAULT_USER_MEDIA,
    id,
    title: id,
    originalTitle: null,
    mediaType: "MOVIE",
    releaseDate: null,
    posterUrl: null,
    externalUrl: null,
    computedConsensusScore: null,
    consensusConfidence: 0,
    updatedAt: new Date("2026-01-01"),
    genres: [{ genre: { name: "Drama" } }],
    tags: [],
    credits: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getFollowingIds).mockResolvedValue([]);
});

describe("v2 recommendation service", () => {
  it("keeps status, release and archive filters separate from scoring", async () => {
    vi.mocked(getCatalogWithUser).mockResolvedValue([
      catalogItem("eligible"),
      catalogItem("completed", { status: "COMPLETED" }),
      catalogItem("active", { status: "IN_PROGRESS" }),
      catalogItem("dropped", { status: "DROPPED" }),
      catalogItem("not-interested", { status: "NOT_INTERESTED" }),
      catalogItem("archived", { isArchived: true }),
      catalogItem("future", { releaseDate: new Date("2099-01-01") }),
      catalogItem("rated", { personalRating: 5 }),
    ]);
    const result = await getRecommendationsV2("viewer", {
      now: new Date("2026-09-18"),
    });
    expect(result.map((r) => r.media.id)).toEqual(["eligible"]);
    expect(getCatalogWithUser).toHaveBeenCalledWith("viewer");
    expect(prisma.userMedia.findMany).not.toHaveBeenCalled();
  });

  it("does not train on stale stored scores for unrated titles", async () => {
    vi.mocked(getCatalogWithUser).mockResolvedValue([
      catalogItem("candidate"),
      catalogItem("stale", {
        status: "COMPLETED",
        computedPersonalScore: 9.9,
        personalScoreConfidence: 1,
      }),
    ]);
    const result = await getRecommendationsV2("viewer");
    expect(result[0].score).toBe(50);
    expect(result[0].confidence).toBe(0);
  });

  it("cannot recommend not-interested titles even when other exclusions are relaxed", async () => {
    vi.mocked(getCatalogWithUser).mockResolvedValue([
      catalogItem("no", { status: "NOT_INTERESTED" }),
    ]);
    expect(
      await getRecommendationsV2("viewer", {
        includeCompleted: true,
        includeDropped: true,
        includeRated: true,
        includeArchived: true,
        includeUpcoming: true,
      }),
    ).toEqual([]);
  });

  it("excludes a candidate's own taste when includeRated is requested", async () => {
    vi.mocked(getCatalogWithUser).mockResolvedValue([
      catalogItem("self", { status: "COMPLETED", personalRating: 10 }),
    ]);
    const result = await getRecommendationsV2("viewer", {
      includeCompleted: true,
      includeRated: true,
    });
    expect(result[0].score).toBe(50);
    expect(result[0].confidence).toBe(0);
  });
});
