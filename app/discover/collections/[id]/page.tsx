import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { PosterTile } from "@/components/media/PosterCard";
import { PageAccentBackground } from "@/components/shared/PageAccentBackground";
import {
  getCollection,
  type CollectionItem,
} from "@/lib/db/collections";
import { getCurrentUser } from "@/lib/user";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { id } = await params;
  const collection = await getCollection(id);
  return { title: collection ? collection.name : "Collection" };
}

export default async function CollectionViewPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;
  const [collection, user] = await Promise.all([
    getCollection(id),
    getCurrentUser(),
  ]);
  const isAdmin = user?.isAdmin ?? false;
  if (!collection || (!collection.isPublished && !isAdmin)) notFound();

  return (
    <Box sx={{ mx: "auto" }}>
      <PageAccentBackground mediaType="MOVIE" />
      <Stack spacing={3}>
        <Box
          sx={{
            border: "1px solid",
            borderColor: "border.subtle",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          {collection.coverUrl ? (
            <Box
              sx={{
                backgroundImage: `url(${collection.coverUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
                height: { xs: 160, md: 240 },
                width: "100%",
              }}
            />
          ) : null}
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="eyebrow">Collection</Typography>
                {!collection.isPublished ? (
                  <Chip label="Draft" size="small" variant="outlined" />
                ) : null}
                {collection.featuredMonth ? (
                  <Chip
                    color="secondary"
                    label={`Featured · ${collection.featuredMonth}`}
                    size="small"
                  />
                ) : null}
              </Stack>
              {isAdmin ? (
                <Button
                  component={Link}
                  href={`/discover/collections/${collection.id}/edit`}
                  size="small"
                  variant="outlined"
                >
                  Edit
                </Button>
              ) : null}
            </Stack>
            <Typography sx={{ fontWeight: 700, mt: 1 }} variant="h4">
              {collection.name}
            </Typography>
            {collection.subtitle ? (
              <Typography color="text.secondary" variant="h6">
                {collection.subtitle}
              </Typography>
            ) : null}
            {collection.description ? (
              <Typography
                sx={{ mt: 1.5, whiteSpace: "pre-line" }}
                variant="body1"
              >
                {collection.description}
              </Typography>
            ) : null}
          </Box>
        </Box>

        {collection.ungrouped.length > 0 ? (
          <ItemGrid items={collection.ungrouped} />
        ) : null}

        {collection.sectionGroups.map((group) =>
          group.items.length > 0 ? (
            <Stack key={group.section.id} spacing={1.5}>
              <Box>
                <Typography sx={{ fontWeight: 700 }} variant="h5">
                  {group.section.title}
                </Typography>
                {group.section.description ? (
                  <Typography
                    color="text.secondary"
                    sx={{ whiteSpace: "pre-line" }}
                    variant="body2"
                  >
                    {group.section.description}
                  </Typography>
                ) : null}
              </Box>
              <ItemGrid items={group.items} />
            </Stack>
          ) : null,
        )}
      </Stack>
    </Box>
  );
}

function ItemGrid({ items }: { items: CollectionItem[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(3, 1fr)",
          md: "repeat(4, 1fr)",
          lg: "repeat(5, 1fr)",
        },
      }}
    >
      {items.map((item) => (
        <Stack key={item.id} spacing={0.75}>
          <PosterTile
            item={{
              id: item.media.id,
              title: item.media.title,
              mediaType: item.media.mediaType,
              posterUrl: item.media.posterUrl,
            }}
          />
          {item.note ? (
            <Typography
              color="text.secondary"
              sx={{ whiteSpace: "pre-line" }}
              variant="caption"
            >
              {item.note}
            </Typography>
          ) : null}
        </Stack>
      ))}
    </Box>
  );
}
