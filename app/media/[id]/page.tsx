import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";
import { calculateCommunityAverage } from "@/lib/scoring/communityAverage";
import { calculateConsensusScore } from "@/lib/scoring/consensus";
import { getMediaItemMatch } from "@/lib/scoring/itemMatch";
import {
  getFriendMediaActivity,
  type FriendMediaEntry,
} from "@/lib/social/visibility";
import {
  getWatchProviders,
  resolveTmdbId,
  tmdbIdFromUrl,
  tmdbMediaKind,
  type TmdbMediaKind,
} from "@/lib/tmdb";
import {
  MediaDetailView,
  type MediaDetailViewItem,
} from "@/components/media/MediaDetailView";
import type {
  RelationView,
  ReleaseEventView,
} from "@/components/media/MediaConnectionsPanel";

/** Parse the stored `platformsJson` (a JSON string array) into names. */
function parsePlatforms(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

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
      // Only the opponent's title is rendered, so don't pull 20 whole
      // MediaItem rows (each carrying description + metadataJson) for it.
      comparisonsLost: {
        where: { userId: userIdFilter },
        include: { winner: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      comparisonsWon: {
        where: { userId: userIdFilter },
        include: { loser: { select: { title: true } } },
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

  // Relations and re-releases are public facts about the title (not per-user
  // joins), so they're fetched unconditionally and rendered read-only here.
  // Editing lives on the edit page via MediaConnectionsPanel.
  // These Neon reads all depend only on the already-loaded `rawItem`, so fire
  // them together rather than serially: the relation/release triad, the
  // community-average rows, the Medialy Match summary, and friend activity.
  // Cuts the detail page's serial round-trips (and the time Neon compute stays
  // active) roughly in half.
  const otherSelect = { id: true, title: true, mediaType: true } as const;
  const [
    [relationsFrom, relationsTo, releaseEventRows],
    otherUserMedia,
    matchSummary,
    friendActivity,
  ] = await Promise.all([
      Promise.all([
        prisma.mediaRelation.findMany({
          where: { fromId: rawItem.id },
          include: { to: { select: otherSelect } },
          orderBy: { createdAt: "asc" },
        }),
        prisma.mediaRelation.findMany({
          where: { toId: rawItem.id },
          include: { from: { select: otherSelect } },
          orderBy: { createdAt: "asc" },
        }),
        prisma.mediaReleaseEvent.findMany({
          where: { mediaId: rawItem.id },
          orderBy: { date: "asc" },
        }),
      ]),
      // Community average: mean of other Medialy users' computedPersonalScore.
      // Distinct from Consensus (external sources only). Always excludes the
      // viewing user so they don't see their own score reflected back.
      prisma.userMedia.findMany({
        where: { mediaId: rawItem.id, ...(userId ? { NOT: { userId } } : {}) },
        select: { computedPersonalScore: true },
      }),
      getMediaItemMatch(rawItem.id, userId),
      // What people the viewer follows have done with this title. Anonymous
      // viewers get nothing — a follow graph is what makes the extra statuses
      // visible at all.
      userId
        ? getFriendMediaActivity(userId, rawItem.id)
        : Promise.resolve<FriendMediaEntry[]>([]),
    ]);
  const relations: RelationView[] = [
    ...relationsFrom.map((relation) => ({
      id: relation.id,
      kind: relation.kind,
      direction: "forward" as const,
      other: relation.to,
    })),
    ...relationsTo.map((relation) => ({
      id: relation.id,
      kind: relation.kind,
      direction: "inverse" as const,
      other: relation.from,
    })),
  ];
  const releaseEvents: ReleaseEventView[] = releaseEventRows.map((event) => ({
    id: event.id,
    kind: event.kind,
    date: event.date.toISOString(),
    title: event.title,
  }));

  const community = calculateCommunityAverage(otherUserMedia);

  // Recompute consensus on the fly to expose agreement % for the tooltip.
  // The persisted `computedConsensusScore` is what we display; this call is
  // only for the breakdown fields (agreementConfidence, usedSourceCount).
  const consensus = calculateConsensusScore(rawItem.externalRatings, {
    mediaType: rawItem.mediaType,
  });

  // "Where to watch" for movies/TV is fetched live (availability changes over
  // time) and cached by lib/tmdb. Game platforms are static, so they are read
  // from the persisted `platformsJson` column populated by metadata:backfill.
  const watchableKind: TmdbMediaKind | null =
    rawItem.mediaType === MediaType.MOVIE
      ? "movie"
      : rawItem.mediaType === MediaType.TV_SHOW
        ? "tv"
        : null;
  const watchProviders = watchableKind
    ? await getWatchProviders(
        // `externalUrl` isn't always a TMDB link — items imported from
        // Letterboxd, RAWG, etc. store *their* source's URL there instead, so
        // a TMDB id is never recoverable from it for those items. Fall back
        // to a live, read-only title search (writes nothing to the DB) so
        // "Where to watch" still works for them.
        tmdbIdFromUrl(rawItem.externalUrl) ??
          (await resolveTmdbId(
            rawItem.title,
            rawItem.releaseDate?.getUTCFullYear() ?? null,
            watchableKind,
          )),
        tmdbMediaKind(rawItem.externalUrl) ?? watchableKind,
      )
    : null;
  const platforms =
    rawItem.mediaType === MediaType.VIDEO_GAME
      ? parsePlatforms(rawItem.platformsJson)
      : [];

  const merged = mergeUserMedia(rawItem);
  const item = {
    ...merged,
    communityScore: community.score,
    communityRaterCount: community.raterCount,
    consensusAgreement: consensus.agreementConfidence,
    consensusUsedSourceCount: consensus.usedSourceCount,
    matchSummary,
    watchProviders,
    platforms,
  } as unknown as MediaDetailViewItem;

  return (
    <MediaDetailView
      friendActivity={friendActivity}
      item={item}
      relations={relations}
      releaseEvents={releaseEvents}
      userId={userId}
    />
  );
}
