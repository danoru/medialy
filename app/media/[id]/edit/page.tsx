import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, Stack } from "@mui/material";
import {
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
    </Stack>
  );
}
