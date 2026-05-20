import {
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { MediaStatus } from "@prisma/client";
import { addFriendRating, createFriend } from "@/app/friends/actions";
import { getFriendCompatibility } from "@/lib/insights";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/user";
import { formatMediaType } from "@/lib/format";
import { statusLabel } from "@/lib/status-labels";
import { StatePanel } from "@/components/shared/StatePanel";
import { ActionToastButton } from "@/components/shared/Toasts";
import {
  isVisibleMediaType,
  VISIBLE_MEDIA_TYPES,
  visibleMediaTypeFilter,
} from "@/lib/media-types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Friends" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedType = stringParam(params.type);
  const selectedType = isVisibleMediaType(requestedType)
    ? requestedType
    : VISIBLE_MEDIA_TYPES[0];
  const userId = await requireUserId("/friends");
  const [friends, media, compatibility] = await Promise.all([
    prisma.friend.findMany({
      where: { userId },
      include: {
        ratings: {
          where: { media: { mediaType: visibleMediaTypeFilter() } },
          include: { media: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.mediaItem.findMany({
      where: { isArchived: false, mediaType: visibleMediaTypeFilter() },
      orderBy: { title: "asc" },
    }),
    getFriendCompatibility(),
  ]);
  const filteredMedia = media.filter((item) => item.mediaType === selectedType);

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Tabs
            allowScrollButtonsMobile
            scrollButtons="auto"
            sx={{ mb: 2 }}
            value={selectedType}
            variant="scrollable"
          >
            {VISIBLE_MEDIA_TYPES.map((type) => (
              <Tab
                component="a"
                href={`/friends?type=${type}`}
                key={type}
                label={formatMediaType(type)}
                value={type}
              />
            ))}
          </Tabs>
          <Divider />
        </CardContent>
      </Card>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 2 }} variant="h6">
                Add Friend
              </Typography>
              <form action={createFriend}>
                <Stack spacing={2}>
                  <TextField label="Name" name="name" required />
                  <TextField label="Notes" minRows={3} multiline name="notes" />
                  <ActionToastButton
                    successMessage="Friend added."
                    variant="contained"
                  >
                    Add friend
                  </ActionToastButton>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 2 }} variant="h6">
                Add Friend Rating
              </Typography>
              <form action={addFriendRating}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    defaultValue=""
                    disabled={friends.length === 0}
                    label="Friend"
                    name="friendId"
                    required
                    select
                    sx={{ minWidth: 180 }}
                  >
                    <MenuItem value="">Select friend</MenuItem>
                    {friends.map((friend) => (
                      <MenuItem key={friend.id} value={friend.id}>
                        {friend.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    defaultValue=""
                    disabled={filteredMedia.length === 0}
                    label="Media"
                    name="mediaId"
                    required
                    select
                    sx={{ minWidth: 220 }}
                  >
                    <MenuItem value="">Select media</MenuItem>
                    {filteredMedia.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.title}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Rating"
                    name="rating"
                    slotProps={{ htmlInput: { min: 0, max: 10, step: 0.1 } }}
                    type="number"
                  />
                  <TextField
                    defaultValue=""
                    label="Status"
                    name="status"
                    select
                    sx={{ minWidth: 160 }}
                  >
                    <MenuItem value="">No status</MenuItem>
                    {Object.values(MediaStatus).map((status) => (
                      <MenuItem key={status} value={status}>
                        {statusLabel(status)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <ActionToastButton
                    disabled={
                      friends.length === 0 || filteredMedia.length === 0
                    }
                    successMessage="Friend rating saved."
                    variant="contained"
                  >
                    Save
                  </ActionToastButton>
                </Stack>
              </form>
              {friends.length === 0 || filteredMedia.length === 0 ? (
                <Typography
                  color="text.secondary"
                  sx={{ mt: 2 }}
                  variant="body2"
                >
                  {friends.length === 0
                    ? "Create a friend before adding ratings."
                    : `Add active ${formatMediaType(selectedType).toLowerCase()} media before recording friend ratings.`}
                </Typography>
              ) : null}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        {friends.map((friend) => {
          const match = compatibility.find(
            (entry) => entry.friendId === friend.id,
          );
          const ratings = friend.ratings.filter(
            (rating) => rating.media.mediaType === selectedType,
          );
          return (
            <Grid key={friend.id} size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: "space-between", mb: 1 }}
                  >
                    <Typography sx={{ fontWeight: 700 }} variant="h6">
                      {friend.name}
                    </Typography>
                    <Chip label={`${match?.compatibilityScore ?? 0}% match`} />
                  </Stack>
                  <Typography color="text.secondary" sx={{ mb: 1 }}>
                    {friend.notes || `${ratings.length} ratings`}
                  </Typography>
                  <Stack
                    direction="row"
                    sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}
                  >
                    <Chip
                      label={`${match?.overlapCount ?? 0} shared ratings`}
                      size="small"
                      variant="outlined"
                    />
                    {match?.averageDistance !== null &&
                    match?.averageDistance !== undefined ? (
                      <Chip
                        label={`${match.averageDistance.toFixed(1)} avg rating gap`}
                        size="small"
                        variant="outlined"
                      />
                    ) : null}
                  </Stack>
                  <Typography
                    color="text.secondary"
                    sx={{ mb: 2 }}
                    variant="body2"
                  >
                    {match?.explanation ??
                      "Add ratings for media you have also rated to calculate compatibility."}
                  </Typography>
                  <Stack spacing={1}>
                    {ratings.map((rating) => (
                      <Typography key={rating.id}>
                        {rating.media.title}: {rating.rating ?? "-"}{" "}
                        {rating.status
                          ? `(${statusLabel(rating.status, rating.media.mediaType)})`
                          : ""}
                      </Typography>
                    ))}
                    {ratings.length === 0 ? (
                      <StatePanel
                        description={`Record ratings for ${formatMediaType(selectedType).toLowerCase()} media to compare this friend's taste with yours.`}
                        minHeight={150}
                        title={`No ${formatMediaType(selectedType).toLowerCase()} friend ratings yet`}
                      />
                    ) : null}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
        {friends.length === 0 ? (
          <Grid size={{ xs: 12 }}>
            <StatePanel
              description="Add a friend above, then record their ratings to track overlap and compatibility."
              title="No friends yet"
            />
          </Grid>
        ) : null}
      </Grid>
    </Stack>
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
