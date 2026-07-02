import {
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { PageAccentBackground } from "@/components/shared/PageAccentBackground";
import { listCollections } from "@/lib/db/collections";
import { requireUser } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collections" };

export default async function CollectionsIndexPage() {
  const user = await requireUser("/discover/collections");
  const collections = await listCollections({ includeDrafts: user.isAdmin });

  return (
    <Box sx={{ mx: "auto" }}>
      <PageAccentBackground mediaType="MOVIE" />
      <Stack spacing={2.5}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="eyebrow">Discover</Typography>
            <Typography sx={{ fontWeight: 700 }} variant="h4">
              Collections
            </Typography>
            <Typography color="text.secondary" variant="body1">
              Themed, hand-picked lists to serve up.
            </Typography>
          </Box>
          {user.isAdmin ? (
            <Button
              component="a"
              href="/discover/collections/new"
              variant="contained"
            >
              New collection
            </Button>
          ) : null}
        </Stack>

        {collections.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            No collections yet.
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                lg: "repeat(3, 1fr)",
              },
            }}
          >
            {collections.map((collection) => (
              <Box
                component="a"
                href={`/discover/collections/${collection.id}`}
                key={collection.id}
                sx={{
                  bgcolor: "surface.1",
                  border: "1px solid",
                  borderColor: "border.subtle",
                  borderRadius: 2,
                  color: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 150,
                  overflow: "hidden",
                  textDecoration: "none",
                  transition: "border-color 160ms ease, transform 160ms ease",
                  "&:hover": {
                    borderColor: "border.strong",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                {collection.coverUrl ? (
                  <Box
                    sx={{
                      backgroundImage: `url(${collection.coverUrl})`,
                      backgroundPosition: "center",
                      backgroundSize: "cover",
                      height: 96,
                      width: "100%",
                    }}
                  />
                ) : null}
                <Box sx={{ flex: 1, p: 1.5 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", mb: 0.5 }}
                  >
                    <Typography sx={{ fontWeight: 650 }} variant="h6">
                      {collection.name}
                    </Typography>
                    {!collection.isPublished ? (
                      <Chip label="Draft" size="small" variant="outlined" />
                    ) : null}
                    {collection.featuredMonth ? (
                      <Chip
                        color="secondary"
                        label={collection.featuredMonth}
                        size="small"
                      />
                    ) : null}
                  </Stack>
                  {collection.subtitle ? (
                    <Typography color="text.secondary" variant="body2">
                      {collection.subtitle}
                    </Typography>
                  ) : null}
                  <Typography
                    color="text.secondary"
                    sx={{ mt: 1 }}
                    variant="caption"
                  >
                    {collection.itemCount} title
                    {collection.itemCount === 1 ? "" : "s"}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Stack>
    </Box>
  );
}
