/** Read-only diagnostic. Run: npm run recommendations:evaluate -- <userId> */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { LEAN_MEDIA_WITH_CREDITS_SELECT } from "@/lib/db/media-select";
import { getFollowingIds } from "@/lib/social/follows";
import { VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import { evaluateRecommendations } from "@/lib/scoring/recommendationEvaluation";

async function main() {
  const userId = process.argv[2];
  if (!userId)
    throw new Error(
      "Pass the user ID to evaluate; no default account is assumed.",
    );
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found.");
  const [observations, following] = await Promise.all([
    prisma.userMedia.findMany({
      where: { userId, isArchived: false, personalRating: { not: null } },
      select: {
        personalRating: true,
        pairwiseScore: true,
        comparisonCount: true,
        status: true,
        isArchived: true,
        media: { select: LEAN_MEDIA_WITH_CREDITS_SELECT },
      },
    }),
    getFollowingIds(userId),
  ]);
  const friendRows = following.length
    ? await prisma.userMedia.findMany({
        where: {
          userId: { in: following },
          isArchived: false,
          OR: [
            { personalRating: { not: null } },
            { status: { in: ["COMPLETED", "WATCHLIST"] } },
          ],
        },
        select: {
          userId: true,
          mediaId: true,
          personalRating: true,
          status: true,
          media: { select: { mediaType: true } },
        },
      })
    : [];
  const friends = friendRows.map((row) => ({
    userId: row.userId,
    mediaId: row.mediaId,
    mediaType: row.media.mediaType,
    rating: row.personalRating,
    status: row.status,
  }));
  console.log(
    JSON.stringify(
      {
        method:
          "Retrospective five-fold explicit-rating check; V2 vs consensus-only; ties = half. Not an online accuracy estimate.",
        results: VISIBLE_MEDIA_TYPES.map((medium) => ({
          medium,
          ...evaluateRecommendations(observations, friends, medium),
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Evaluation failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
