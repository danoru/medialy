import Link from "next/link";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { CinematicCard } from "@/components/cinematic/CinematicPrimitives";
import { UserAvatar } from "@/components/social/UserAvatar";
import { FollowButton } from "@/components/social/FollowButton";

/**
 * Compact card for the "Discover users" section. Lighter than `FollowCard` —
 * no per-user overlap is precomputed since these are users the viewer doesn't
 * follow yet. Clicking the name opens the full profile where compatibility
 * is shown.
 */
export function DiscoverUserCard({
  user,
}: {
  user: {
    id: string;
    displayName: string;
    image: string | null;
    avatarColor: string | null;
  };
}) {
  return (
    <CinematicCard>
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <UserAvatar
            avatarColor={user.avatarColor}
            displayName={user.displayName}
            image={user.image}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Link
              href={`/u/${user.id}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              <Typography component="span" sx={{ fontWeight: 600 }}>
                {user.displayName}
              </Typography>
            </Link>
            <Chip
              label="View profile"
              size="small"
              sx={{ mt: 0.5 }}
              variant="outlined"
            />
          </Box>
          <FollowButton isFollowing={false} targetUserId={user.id} />
        </Stack>
      </Box>
    </CinematicCard>
  );
}
