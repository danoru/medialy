import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";
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
  const item = mergeUserMedia(rawItem) as unknown as MediaDetailViewItem;

  return <MediaDetailView item={item} userId={userId} />;
}
