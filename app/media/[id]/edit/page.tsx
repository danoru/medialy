import { notFound } from "next/navigation";
import { Card, CardContent, Stack, Typography } from "@mui/material";
import { updateMediaItem } from "@/app/media/actions";
import { MediaForm } from "@/components/media/MediaForm";
import { getMediaItemDTO } from "@/lib/media";

export default async function EditMediaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getMediaItemDTO(id);
  if (!item) notFound();

  return (
    <Stack spacing={3}>
      <div>
        <Typography component="h1" sx={{ fontWeight: 700 }} variant="h4">
          Edit {item.title}
        </Typography>
        <Typography color="text.secondary">
          Update details, tags, genres, notes, and ratings.
        </Typography>
      </div>
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
