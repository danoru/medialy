import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";
import { calculateCommunityAverage } from "@/lib/scoring/communityAverage";
import { calculateConsensusScore } from "@/lib/scoring/consensus";
import {
  MediaDetailView,
  type MediaDetailViewItem,
} from "@/components/media/MediaDetailView";

/**
 * Server shell for the media detail page. All UI lives in
 * `components/media/MediaDetailView.tsx` — a client component — because the
 * view's `sx` blocks include theme callbacks that can't cross the RSC
 * boundary into MUI's client components. This file handles data fetching
 * and hands the view a serializable `item` plus the resolved `userId`.
 */

export const dynamic = "force-dynamic";

type PageParams = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await prisma.mediaItem.findUnique({
    select: { title: true },
    where: { id },
  });

  return { title: item?.title ?? "Media Details" };
}

export default async function MediaDetailPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  // Anonymous viewers see the public detail page without personal joins
  // (comparisons/notes belong to a user). We use a sentinel that never
  // matches so the typed query is happy and the relations come back empty.
  const userIdFilter = userId ?? "__anonymous__";
  const rawItem = await prisma.mediaItem.findUnique({
    include: {
      comparisonsLost: {
        where: { userId: userIdFilter },
        include: { winner: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      comparisonsWon: {
        where: { userId: userIdFilter },
        include: { loser: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      externalRatings: { orderBy: [{ source: "asc" }] },
      genres: { include: { genre: true } },
      credits: { include: { contributor: true }, orderBy: { order: "asc" } },
      notes: { where: { userId: userIdFilter }, orderBy: { updatedAt: "desc" } },
      tags: { include: { tag: true } },
      ...userMediaInclude(userId),
    },
    where: { id },
  });
  if (!rawItem) notFound();

  // Community average: mean of other Medialy users' computedPersonalScore.
  // Distinct from Consensus (external sources only). Always excludes the
  // viewing user so they don't see their own score reflected back.
  const otherUserMedia = await prisma.userMedia.findMany({
    where: {
      mediaId: rawItem.id,
      ...(userId ? { NOT: { userId } } : {}),
    },
    select: { computedPersonalScore: true },
  });
  const community = calculateCommunityAverage(otherUserMedia);

  // Recompute consensus on the fly to expose agreement % for the tooltip.
  // The persisted `computedConsensusScore` is what we display; this call is
  // only for the breakdown fields (agreementConfidence, usedSourceCount).
  const consensus = calculateConsensusScore(rawItem.externalRatings, {
    mediaType: rawItem.mediaType,
  });

  const merged = mergeUserMedia(rawItem);
  const item = {
    ...merged,
    communityScore: community.score,
    communityRaterCount: community.raterCount,
    consensusAgreement: consensus.agreementConfidence,
    consensusUsedSourceCount: consensus.usedSourceCount,
  } as unknown as MediaDetailViewItem;

  return <MediaDetailView item={item} userId={userId} />;
}
