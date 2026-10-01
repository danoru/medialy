import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mediaItem: { count: vi.fn() },
    mediaEditSuggestion: { count: vi.fn() },
    tag: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getAdminReviewCounts } from "./admin-review";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAdminReviewCounts", () => {
  it("sums new items, pending suggestions and pending tags", async () => {
    vi.mocked(prisma.mediaItem.count).mockResolvedValue(4);
    vi.mocked(prisma.mediaEditSuggestion.count).mockResolvedValue(2);
    vi.mocked(prisma.tag.count).mockResolvedValue(1);

    await expect(getAdminReviewCounts()).resolves.toEqual({
      newItems: 4,
      suggestions: 2,
      tags: 1,
      total: 7,
    });
  });

  it("only counts unreviewed items created by non-admins", async () => {
    vi.mocked(prisma.mediaItem.count).mockResolvedValue(0);
    vi.mocked(prisma.mediaEditSuggestion.count).mockResolvedValue(0);
    vi.mocked(prisma.tag.count).mockResolvedValue(0);

    await getAdminReviewCounts();

    expect(prisma.mediaItem.count).toHaveBeenCalledWith({
      where: { reviewedAt: null, createdBy: { isAdmin: false } },
    });
  });
});
