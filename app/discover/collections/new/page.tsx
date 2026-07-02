import { Card, CardContent, Stack, Typography } from "@mui/material";
import { CollectionForm } from "@/app/discover/collections/CollectionForm";
import { createCollection } from "@/app/discover/collections/actions";
import { requireAdmin } from "@/lib/user";

export const metadata = { title: "New Collection" };

export default async function NewCollectionPage() {
  await requireAdmin("/discover/collections/new");
  return (
    <Stack spacing={3}>
      <Typography sx={{ fontWeight: 700 }} variant="h4">
        New collection
      </Typography>
      <Card variant="outlined">
        <CardContent>
          <CollectionForm
            action={createCollection}
            submitLabel="Create collection"
          />
        </CardContent>
      </Card>
    </Stack>
  );
}
