import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { CollectionForm } from "@/app/discover/collections/CollectionForm";
import { CollectionEditor } from "@/app/discover/collections/CollectionEditor";
import { updateCollection } from "@/app/discover/collections/actions";
import { getCollection } from "@/lib/db/collections";
import { requireAdmin } from "@/lib/user";

type PageParams = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { id } = await params;
  const collection = await getCollection(id);
  return { title: collection ? `Edit ${collection.name}` : "Edit Collection" };
}

export default async function EditCollectionPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;
  await requireAdmin(`/discover/collections/${id}/edit`);
  const collection = await getCollection(id);
  if (!collection) notFound();

  const sections = collection.sectionGroups.map((group) => group.section);

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography sx={{ fontWeight: 700 }} variant="h4">
          Edit collection
        </Typography>
        <Button
          component={Link}
          href={`/discover/collections/${collection.id}`}
          size="small"
          variant="outlined"
        >
          View
        </Button>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <CollectionForm
            action={updateCollection.bind(null, collection.id)}
            collection={{
              name: collection.name,
              subtitle: collection.subtitle,
              description: collection.description,
              coverUrl: collection.coverUrl,
              isPublished: collection.isPublished,
            }}
            submitLabel="Save changes"
          />
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2.5}>
            <Typography sx={{ fontWeight: 700 }} variant="h6">
              Curation
            </Typography>
            <CollectionEditor
              featuredMonth={collection.featuredMonth}
              listId={collection.id}
              sectionGroups={collection.sectionGroups}
              sections={sections}
              ungrouped={collection.ungrouped}
            />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
