import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import {
  deleteMediaItem,
  mergeMediaItem,
  previewMediaMerge,
  searchMediaItemsForRelation,
  updateMediaItem,
} from "@/app/media/actions";
import { ConfirmMediaAction } from "@/components/media/ConfirmMediaAction";
import { MediaForm } from "@/components/media/MediaForm";
import { MergeMediaAction } from "@/components/media/MergeMediaAction";
import {
  MediaConnectionsPanel,
  type RelationView,
} from "@/components/media/MediaConnectionsPanel";
import { getMediaItemDTO } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

type PageParams = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await getMediaItemDTO(id);

  return { title: item ? `Edit ${item.title}` : "Edit Media" };
}

export default async function EditMediaPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;
  const otherSelect = { id: true, title: true, mediaType: true } as const;
  const [item, tags, user, relationsFrom, relationsTo, releaseEvents] =
    await Promise.all([
      getMediaItemDTO(id),
      prisma.tag.findMany({
        where: { status: { in: ["APPROVED", "PENDING"] } },
        orderBy: [{ status: "asc" }, { name: "asc" }],
        select: { mediaTypesJson: true, name: true, status: true },
      }),
      getCurrentUser(),
      prisma.mediaRelation.findMany({
        where: { fromId: id },
        include: { to: { select: otherSelect } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.mediaRelation.findMany({
        where: { toId: id },
        include: { from: { select: otherSelect } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.mediaReleaseEvent.findMany({
        where: { mediaId: id },
        orderBy: { date: "asc" },
      }),
    ]);
  if (!item) notFound();

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

  const events = releaseEvents.map((event) => ({
    id: event.id,
    kind: event.kind,
    date: event.date.toISOString(),
    title: event.title,
  }));

  // One card, one form, one Save button. Relations and re-releases are staged
  // inside the same form rather than saving themselves on click.
  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <MediaForm
            action={updateMediaItem.bind(null, id)}
            connections={
              <MediaConnectionsPanel
                canEdit={Boolean(user)}
                events={events}
                fallbackTitle={item.title}
                relations={relations}
                searchAction={searchMediaItemsForRelation.bind(null, id)}
              />
            }
            isAdmin={user?.isAdmin ?? false}
            item={item}
            submitLabel="Save changes"
            tagOptions={tags}
          />
        </CardContent>
      </Card>

      {user?.isAdmin ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={3}>
              <Stack spacing={2}>
                <Typography sx={{ fontWeight: 700 }} variant="h6">
                  This is a duplicate
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Move everything attached to this entry onto the item it
                  duplicates, then delete it. Other people&rsquo;s statuses and
                  ratings come along; where both entries have a value, the one
                  you keep wins.
                </Typography>
                <Stack direction="row">
                  <MergeMediaAction
                    action={mergeMediaItem.bind(null, id)}
                    duplicateTitle={item.title}
                    previewAction={previewMediaMerge.bind(null, id)}
                    searchAction={searchMediaItemsForRelation.bind(null, id)}
                  />
                </Stack>
              </Stack>

              <Divider />

              <Stack spacing={2}>
                <Typography sx={{ fontWeight: 700 }} variant="h6">
                  Delete from catalog
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Removes this item for everyone, along with all statuses,
                  ratings, comparisons, notes, list entries and pending edit
                  suggestions attached to it. Prefer merging if another entry
                  covers the same thing — archive instead if you just want it
                  out of your own library.
                </Typography>
                <Stack direction="row">
                  <ConfirmMediaAction
                    action={deleteMediaItem.bind(null, id)}
                    actionLabel="Delete media item"
                    confirmLabel="Delete permanently"
                    description={`Permanently delete "${item.title}"? Everyone's statuses, ratings, comparisons, notes and list entries for it go too. This can't be undone.`}
                    tone="danger"
                    variant="delete"
                  />
                </Stack>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
