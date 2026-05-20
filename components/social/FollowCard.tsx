import Link from "next/link";
import {
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import {
  CinematicCard,
  CompactStatCard,
} from "@/components/cinematic/CinematicPrimitives";
import { UserAvatar } from "@/components/social/UserAvatar";
import { FollowButton } from "@/components/social/FollowButton";
import type { UserOverlap } from "@/lib/social/overlap";

/**
 * A user card on `/friends`. Shows compatibility, overlap counts, top shared
 * genres, and "watch next together" suggestions inline so each row is a
 * standalone, scannable unit.
 */
export function FollowCard({
  user,
  overlap,
  isFollowing,
}: {
  user: {
    id: string;
    displayName: string;
    image: string | null;
    avatarColor: string | null;
  };
  overlap: UserOverlap;
  isFollowing: boolean;
}) {
  return (
    <CinematicCard>
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
          <UserAvatar
            avatarColor={user.avatarColor}
            displayName={user.displayName}
            image={user.image}
            size={52}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Link
                href={`/u/${user.id}`}
                style={{ color: "inherit", textDecoration: "none" }}
              >
                <Typography component="span" sx={{ fontWeight: 700 }} variant="h6">
                  {user.displayName}
                </Typography>
              </Link>
              <Chip
                color={
                  overlap.compatibilityScore >= 70
                    ? "success"
                    : overlap.compatibilityScore >= 40
                      ? "default"
                      : "warning"
                }
                label={`${overlap.compatibilityScore}% match`}
                size="small"
              />
            </Stack>
            {overlap.topSharedGenres.length > 0 ? (
              <Typography color="text.secondary" sx={{ fontSize: "0.8125rem" }}>
                You both gravitate toward {overlap.topSharedGenres.slice(0, 3).join(", ")}.
              </Typography>
            ) : (
              <Typography color="text.secondary" sx={{ fontSize: "0.8125rem" }}>
                Not enough shared completed items to spot a pattern yet.
              </Typography>
            )}
          </Box>
          <FollowButton isFollowing={isFollowing} targetUserId={user.id} />
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
          <CompactStatCard
            accent="#7C7AED"
            label="Shared ratings"
            value={overlap.overlapCount.toString()}
          />
          <CompactStatCard
            accent="#3FD693"
            label="Both completed"
            value={overlap.sharedCompletedCount.toString()}
          />
          <CompactStatCard
            accent="#F0B649"
            label="Avg rating gap"
            value={
              overlap.averageDistance == null
                ? "—"
                : overlap.averageDistance.toFixed(1)
            }
          />
        </Stack>

        {overlap.watchNextTogether.length > 0 ? (
          <Box>
            <Typography
              color="text.secondary"
              sx={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: 0.6, mb: 1, textTransform: "uppercase" }}
            >
              Watch next together
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              {overlap.watchNextTogether.map((entry) => (
                <Link
                  href={`/media/${entry.mediaId}`}
                  key={entry.mediaId}
                  style={{ textDecoration: "none" }}
                >
                  <Button
                    component="span"
                    size="small"
                    sx={{ textTransform: "none" }}
                    variant="outlined"
                  >
                    {entry.title}
                    {entry.reason === "they-love-it-you-havent-seen" &&
                    entry.theirRating != null
                      ? ` · they rated ${entry.theirRating}/10`
                      : " · shared watchlist"}
                  </Button>
                </Link>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Box>
    </CinematicCard>
  );
}
