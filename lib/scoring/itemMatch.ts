import { prisma } from "@/lib/prisma";
import { AFFINITY_TUNING } from "@/lib/scoring/config";
import { saturate } from "@/lib/scoring/affinity";
import { calculateMedialyMatch } from "@/lib/scoring/medialyMatch";
import { calculateTaxonomySimilarity } from "@/lib/scoring/taxonomySimilarity";
import { getAffinityMaps, buildContributorDetail } from "@/lib/recommendations";

/**
 * Single-item Medialy Match summary for the media detail page. Distinct from
 * `getRecommendations`, which only scores items the viewer hasn't consumed —
 * here we want to explain the match for *any* item (including ones already
 * watched/in the library).
 */
export type MediaItemMatchSummary = {
  score: number;
  /** Top user-rated titles that share signal with this item. */
  similarTitles: string[];
  /** "Director X — you rated Y 9/10" or null when no contributor match. */
  contributorReason: string | null;
};

export async function getMediaItemMatch(
  mediaId: string,
  userId: string | null,
): Promise<MediaItemMatchSummary | null> {
  if (!userId) return null;

  const item = await prisma.mediaItem.findUnique({
    where: { id: mediaId },
    include: {
      genres: { include: { genre: true } },
      tags: { where: { tag: { status: "APPROVED" } }, include: { tag: true } },
      credits: { include: { contributor: true } },
    },
  });
  if (!item) return null;

  // Exclude the current item from the affinity pool so reasons don't
  // self-reference (e.g. "Director X — you rated <this item> 9/10").
  const affinity = await getAffinityMaps(userId, { excludeMediaId: mediaId });

  const genreRaw = item.genres.reduce(
    (total, entry) => total + (affinity.genres.get(entry.genre.name) ?? 0),
    0,
  );
  const tagRaw = item.tags.reduce(
    (total, entry) => total + (affinity.tags.get(entry.tag.name) ?? 0),
    0,
  );
  const contributorRaw = item.credits.reduce(
    (total, entry) =>
      total + (affinity.contributors.get(entry.contributor.id)?.weight ?? 0),
    0,
  );

  // Friend signal isn't surfaced in the detail page reason, so we skip the
  // followed-user fetch and pass 0 — the match score still reflects the
  // taste/contributor/consensus pieces, which is what the inline copy explains.
  const match = calculateMedialyMatch({
    genreAffinity: saturate(genreRaw, AFFINITY_TUNING.saturationK.genre),
    tagAffinity: saturate(tagRaw, AFFINITY_TUNING.saturationK.tag),
    contributorAffinity: saturate(
      contributorRaw,
      AFFINITY_TUNING.saturationK.contributor,
    ),
    friendAffinity: 0,
    consensusScore: item.computedConsensusScore,
  });

  const contributorReason = buildContributorDetail(
    item.credits.map((credit) => ({
      contributor: { id: credit.contributor.id },
      role: credit.role,
    })),
    affinity,
  ) ?? null;

  const similarTitles = await findSimilarTitles(userId, {
    id: item.id,
    genres: item.genres.map((entry) => entry.genre.name),
    tags: item.tags.map((entry) => entry.tag.name),
    contributorIds: item.credits.map((credit) => credit.contributor.id),
  });

  return {
    score: match.score,
    similarTitles,
    contributorReason,
  };
}

async function findSimilarTitles(
  userId: string,
  reference: {
    id: string;
    genres: string[];
    tags: string[];
    contributorIds: string[];
  },
): Promise<string[]> {
  const rated = await prisma.userMedia.findMany({
    where: {
      userId,
      isArchived: false,
      mediaId: { not: reference.id },
      OR: [
        { personalRating: { gte: 8 } },
        { computedPersonalScore: { gte: 8 } },
      ],
    },
    include: {
      media: {
        include: {
          genres: { include: { genre: true } },
          tags: {
            where: { tag: { status: "APPROVED" } },
            include: { tag: true },
          },
          credits: { include: { contributor: true } },
        },
      },
    },
    take: 80,
  });

  const referenceContributors = new Set(reference.contributorIds);

  const scored = rated
    .map((row) => {
      const otherGenres = row.media.genres.map((entry) => entry.genre.name);
      const otherTags = row.media.tags.map((entry) => entry.tag.name);
      const sharedContributors = row.media.credits.filter((credit) =>
        referenceContributors.has(credit.contributor.id),
      ).length;
      const taxonomy = calculateTaxonomySimilarity(
        { genres: reference.genres, tags: reference.tags },
        { genres: otherGenres, tags: otherTags },
      );
      // Contributor overlap is rarer than genre/tag overlap, so weight it
      // heavily so titles by the same director surface near the top.
      const score = taxonomy.score + sharedContributors * 25;
      return { title: row.media.title, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const titles: string[] = [];
  for (const entry of scored) {
    if (seen.has(entry.title)) continue;
    seen.add(entry.title);
    titles.push(entry.title);
    if (titles.length >= 3) break;
  }
  return titles;
}
