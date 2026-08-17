import Link from "next/link";
import { Box, Button, Grid, Stack, Typography } from "@mui/material";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/user";
import { getFollowingIds, getDiscoverableUsers } from "@/lib/social/follows";
import { getUserOverlaps } from "@/lib/social/overlap";
import { getActivityFeed } from "@/lib/social/feed";
import { ActivityFeed } from "@/components/social/ActivityFeed";
import { FollowCard } from "@/components/social/FollowCard";
import { DiscoverUserCard } from "@/components/social/DiscoverUserCard";
import { StatePanel } from "@/components/shared/StatePanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Friends" };

export default async function FriendsPage() {
  const viewerId = await requireUserId("/friends");

  const [followingIds, discoverable, activity] = await Promise.all([
    getFollowingIds(viewerId),
    getDiscoverableUsers(viewerId),
    getActivityFeed(viewerId, { limit: 10 }),
  ]);

  const followingUsers = followingIds.length
    ? await prisma.user.findMany({
        where: { id: { in: followingIds } },
        select: { id: true, displayName: true, image: true, avatarColor: true },
        orderBy: { displayName: "asc" },
      })
    : [];

  const overlapByUser = await getUserOverlaps(
    viewerId,
    followingUsers.map((user) => user.id),
  );
  const overlaps = followingUsers.map((user) => ({
    user,
    overlap: overlapByUser.get(user.id)!,
  }));

  // Sort by compatibility desc, fallback to displayName.
  overlaps.sort(
    (a, b) =>
      b.overlap.compatibilityScore - a.overlap.compatibilityScore ||
      a.user.displayName.localeCompare(b.user.displayName),
  );

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography sx={{ fontWeight: 700 }} variant="h4">
            Friends
          </Typography>
          <Typography color="text.secondary" variant="body2">
            See what people you follow are watching, playing, and rating.
          </Typography>
        </Box>
        {/* <Link href="/friends/guest" style={{ textDecoration: "none" }}>
          <Button component="span" variant="outlined">
            Recommend something to a guest →
          </Button>
        </Link> */}
      </Stack>

      <ActivityFeed items={activity} />

      <Box>
        <Typography sx={{ fontWeight: 700, mb: 1.5 }} variant="h6">
          People you follow
        </Typography>
        {overlaps.length === 0 ? (
          <StatePanel
            description="Follow other Medialy users below to see compatibility, shared watchlists, and what they're rating."
            title="You don't follow anyone yet"
          />
        ) : (
          <Grid container spacing={2}>
            {overlaps.map(({ user, overlap }) => (
              <Grid key={user.id} size={{ xs: 12, lg: 6 }}>
                <FollowCard isFollowing overlap={overlap} user={user} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Box>
        <Typography sx={{ fontWeight: 700, mb: 1.5 }} variant="h6">
          Discover users
        </Typography>
        {discoverable.length === 0 ? (
          <StatePanel
            description="You're following everyone on the platform — nothing new to discover."
            minHeight={140}
            title="No new users to discover"
          />
        ) : (
          <Grid container spacing={2}>
            {discoverable.map((user) => (
              <Grid key={user.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <DiscoverUserCard user={user} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Stack>
  );
}
