import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, Stack, Typography } from "@mui/material";
import {
  addMediaRelation,
  addReleaseEvent,
  removeMediaRelation,
  removeReleaseEvent,
  searchMediaItemsForRelation,
  updateMediaItem,
} from "@/app/media/actions";
import { MediaForm } from "@/components/media/MediaForm";
import {
  MediaConnectionsPanel,
  type RelationView,
} from "@/components/media/MediaConnectionsPanel";
import { getMediaItemDTO } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/user";

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
  const [item, tags, userId, relationsFrom, relationsTo, releaseEvents] =
    await Promise.all([
      getMediaItemDTO(id),
      prisma.tag.findMany({
        where: { status: { in: ["APPROVED", "PENDING"] } },
        orderBy: [{ status: "asc" }, { name: "asc" }],
        select: { mediaTypesJson: true, name: true, status: true },
      }),
      getCurrentUserId(),
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

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <MediaForm
            action={updateMediaItem.bind(null, id)}
            item={item}
            submitLabel="Save changes"
            tagOptions={tags}
          />
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2.5}>
            <Typography sx={{ fontWeight: 700 }} variant="h6">
              Connections
            </Typography>
            <MediaConnectionsPanel
              addEventAction={addReleaseEvent.bind(null, id)}
              addRelationAction={addMediaRelation.bind(null, id)}
              canEdit={Boolean(userId)}
              events={events}
              fallbackTitle={item.title}
              relations={relations}
              removeEventAction={removeReleaseEvent.bind(null, id)}
              removeRelationAction={removeMediaRelation.bind(null, id)}
              searchAction={searchMediaItemsForRelation.bind(null, id)}
            />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
