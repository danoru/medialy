import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent, Stack } from "@mui/material";
import { updateMediaItem } from "@/app/media/actions";
import { MediaForm } from "@/components/media/MediaForm";
import { getMediaItemDTO } from "@/lib/media";

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
  const item = await getMediaItemDTO(id);
  if (!item) notFound();

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <MediaForm
            action={updateMediaItem.bind(null, id)}
            item={item}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>
    </Stack>
  );
}
