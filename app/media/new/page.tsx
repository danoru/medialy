import { Card, CardContent, Stack } from "@mui/material";
import { MediaForm } from "@/components/media/MediaForm";
import { createMediaItem } from "@/app/media/actions";

export const metadata = { title: "Add Media" };

export default function NewMediaPage() {
  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <MediaForm action={createMediaItem} submitLabel="Create media" />
        </CardContent>
      </Card>
    </Stack>
  );
}
