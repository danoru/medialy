import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import {
  markAllMediaReviewed,
  markMediaReviewed,
} from "@/app/admin/review/actions";
import { StatePanel } from "@/components/shared/StatePanel";
import { ActionToastButton } from "@/components/shared/Toasts";
import {
  getMediaAwaitingReview,
  type ReviewQueueItem,
} from "@/lib/db/admin-review";
import { formatMediaType } from "@/lib/format";
import { requireAdmin } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue" };

export default async function AdminReviewPage() {
  await requireAdmin("/admin/review");

  const items = await getMediaAwaitingReview();
  // Bound to the ids on screen, so a title added while this page is open
  // stays in the queue instead of being waved through unseen.
  const ids = items.map((item) => item.id);

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="eyebrow">Admin</Typography>
        <Typography component="h1" sx={{ fontWeight: 650 }} variant="h4">
          Review queue
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Titles users added through search or imports. They are live already —
          check the data, fix or remove what&apos;s wrong, then mark them
          reviewed.
        </Typography>
      </Stack>

      <Card variant="outlined">
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", mb: 1.5 }}
          >
            <Typography sx={{ flex: 1, fontWeight: 650 }} variant="h6">
              Awaiting review
            </Typography>
            <Chip label={items.length} size="small" />
            {items.length > 0 ? (
              <form action={markAllMediaReviewed.bind(null, ids)}>
                <ActionToastButton
                  size="small"
                  successMessage="Marked reviewed."
                  variant="outlined"
                >
                  Mark all reviewed
                </ActionToastButton>
              </form>
            ) : null}
          </Stack>
          {items.length > 0 ? (
            <Stack spacing={1.25}>
              {items.map((item) => (
                <ReviewRow item={item} key={item.id} />
              ))}
            </Stack>
          ) : (
            <StatePanel
              description="Nothing waiting on you. Titles users add will show up here."
              minHeight={140}
              title="All caught up"
            />
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

function ReviewRow({ item }: { item: ReviewQueueItem }) {
  const year = item.releaseDate?.getFullYear();
  const genres = item.genres.map((entry) => entry.genre.name);
  const addedBy = item.createdBy?.displayName ?? "Unknown";

  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: { sm: "center" },
        borderBottom: "1px solid",
        borderColor: "divider",
        flexWrap: { xs: "wrap", sm: "nowrap" },
        pb: 1.25,
      }}
    >
      {item.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={item.posterUrl}
          style={{
            aspectRatio: "2/3",
            borderRadius: 6,
            flexShrink: 0,
            objectFit: "cover",
            width: 48,
          }}
        />
      ) : null}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Link href={`/media/${item.id}`} style={{ textDecoration: "none" }}>
          <Typography sx={{ color: "primary.main", fontWeight: 650 }}>
            {item.title}
          </Typography>
        </Link>
        <Typography color="text.secondary" variant="body2">
          {[formatMediaType(item.mediaType), year, genres.join(", ")]
            .filter(Boolean)
            .join(" · ")}
        </Typography>
        <Typography color="text.secondary" variant="caption">
          Added by {addedBy} on {item.createdAt.toLocaleDateString()}
        </Typography>
      </Box>
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
        <form action={markMediaReviewed.bind(null, item.id)}>
          <ActionToastButton
            size="small"
            successMessage="Marked reviewed."
            variant="contained"
          >
            Mark reviewed
          </ActionToastButton>
        </form>
        <Button href={`/media/${item.id}/edit`} size="small" variant="outlined">
          Edit
        </Button>
      </Stack>
    </Stack>
  );
}
