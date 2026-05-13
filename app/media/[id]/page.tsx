import { notFound } from "next/navigation";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  addNote,
  archiveMediaItem,
  deleteMediaItem,
  unarchiveMediaItem,
  updateNote,
} from "@/app/media/actions";
import { ConfirmMediaAction } from "@/components/media/ConfirmMediaAction";
import { prisma } from "@/lib/prisma";
import { formatMediaType, formatStatus } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MediaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.mediaItem.findUnique({
    where: { id },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
      notes: { orderBy: { updatedAt: "desc" } },
      comparisonsWon: {
        include: { loser: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      comparisonsLost: {
        include: { winner: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!item) notFound();

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between" }}
      >
        <Box>
          <Typography component="h1" sx={{ fontWeight: 700 }} variant="h4">
            {item.title}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 1 }}>
            <Chip label={formatMediaType(item.mediaType)} />
            <Chip label={formatStatus(item.status)} variant="outlined" />
            {item.isFavorite ? (
              <Chip color="secondary" label="Favorite" />
            ) : null}
            {item.isArchived ? <Chip label="Archived" /> : null}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button href={`/media/${item.id}/edit`} variant="contained">
            Edit
          </Button>
          <Button href={`/compare?focus=${item.id}`} variant="outlined">
            Compare
          </Button>
          <ConfirmMediaAction
            action={
              item.isArchived
                ? unarchiveMediaItem.bind(null, item.id)
                : archiveMediaItem.bind(null, item.id)
            }
            actionLabel={item.isArchived ? "Unarchive" : "Archive"}
            description={
              item.isArchived
                ? `${item.title} will return to active library views and comparison candidates.`
                : `${item.title} will be hidden from active library views, recommendations, and comparison candidates.`
            }
            variant={item.isArchived ? "unarchive" : "archive"}
          />
          <ConfirmMediaAction
            action={deleteMediaItem.bind(null, item.id)}
            actionLabel="Delete"
            confirmLabel="Delete permanently"
            description={`${item.title} and its notes, taxonomy links, list entries, and friend ratings will be permanently deleted.`}
            tone="danger"
            variant="delete"
          />
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 1 }} variant="h6">
                Details
              </Typography>
              <Typography sx={{ mb: 2 }}>
                {item.description || "No description yet."}
              </Typography>
              <Info
                label="Pairwise score"
                value={`${Math.round(item.pairwiseScore)} (${item.comparisonCount} comparisons)`}
              />
              <Info
                label="Personal rating"
                value={item.personalRating ?? "-"}
              />
              <Info
                label="Release date"
                value={item.releaseDate?.toLocaleDateString() ?? "-"}
              />
              <Info
                label="Upcoming date"
                value={item.upcomingDate?.toLocaleDateString() ?? "-"}
              />
              <Info
                label="Genres"
                value={
                  item.genres.map((entry) => entry.genre.name).join(", ") || "-"
                }
              />
              <Info
                label="Tags"
                value={
                  item.tags.map((entry) => entry.tag.name).join(", ") || "-"
                }
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 2 }} variant="h6">
                Comparison History
              </Typography>
              <Stack spacing={1.25}>
                {[
                  ...item.comparisonsWon.map((entry) => ({
                    ...entry,
                    result: "Beat",
                    opponent: entry.loser.title,
                  })),
                  ...item.comparisonsLost.map((entry) => ({
                    ...entry,
                    result: "Lost to",
                    opponent: entry.winner.title,
                  })),
                ]
                  .slice(0, 10)
                  .map((entry) => (
                    <Typography key={entry.id} variant="body2">
                      {entry.result} {entry.opponent} on{" "}
                      {entry.createdAt.toLocaleDateString()}
                    </Typography>
                  ))}
                {item.comparisonsWon.length + item.comparisonsLost.length ===
                0 ? (
                  <Typography color="text.secondary">
                    No comparisons yet.
                  </Typography>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent>
          <Typography sx={{ fontWeight: 700, mb: 2 }} variant="h6">
            Notes
          </Typography>
          <Stack spacing={2}>
            {item.notes.map((note) => (
              <form
                action={updateNote.bind(null, note.id, item.id)}
                key={note.id}
              >
                <Stack spacing={1}>
                  <TextField
                    defaultValue={note.body}
                    fullWidth
                    minRows={2}
                    multiline
                    name="body"
                  />
                  <Button
                    sx={{ alignSelf: "flex-start" }}
                    type="submit"
                    variant="outlined"
                  >
                    Save note
                  </Button>
                  <Divider />
                </Stack>
              </form>
            ))}
            <form action={addNote.bind(null, item.id)}>
              <Stack spacing={1}>
                <TextField
                  fullWidth
                  label="New note"
                  minRows={2}
                  multiline
                  name="body"
                />
                <Button
                  sx={{ alignSelf: "flex-start" }}
                  type="submit"
                  variant="contained"
                >
                  Add note
                </Button>
              </Stack>
            </form>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", py: 0.75 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography>{value}</Typography>
    </Stack>
  );
}
