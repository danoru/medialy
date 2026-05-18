import { Card, CardContent, Stack } from "@mui/material";
import { MediaForm } from "@/components/media/MediaForm";
import { createMediaItem } from "@/app/media/actions";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Add Media" };

export default async function NewMediaPage() {
  const tags = await prisma.tag.findMany({
    where: { status: { in: ["APPROVED", "PENDING"] } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: { mediaTypesJson: true, name: true, status: true },
  });

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <MediaForm
            action={createMediaItem}
            submitLabel="Create media"
            tagOptions={tags}
          />
        </CardContent>
      </Card>
    </Stack>
  );
}
