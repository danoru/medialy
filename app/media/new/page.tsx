import { Card, CardContent, Stack, Typography } from "@mui/material";
import { MediaForm } from "@/components/media/MediaForm";
import { createMediaItem } from "@/app/media/actions";

export default function NewMediaPage() {
  return (
    <Stack spacing={3}>
      <div>
        <Typography component="h1" sx={{ fontWeight: 700 }} variant="h4">
          Add Media
        </Typography>
        <Typography color="text.secondary">
          Create a local library item.
        </Typography>
      </div>
      <Card variant="outlined">
        <CardContent>
          <MediaForm action={createMediaItem} submitLabel="Create media" />
        </CardContent>
      </Card>
    </Stack>
  );
}
