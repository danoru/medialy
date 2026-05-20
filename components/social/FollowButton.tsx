"use client";

import { useTransition } from "react";
import { Button } from "@mui/material";
import { followUserAction, unfollowUserAction } from "@/app/friends/actions";

/**
 * Optimistic follow/unfollow toggle. Server action revalidates the relevant
 * paths, so we don't need to manage local state beyond the pending flag.
 */
export function FollowButton({
  targetUserId,
  isFollowing,
  fullWidth = false,
  size = "small",
}: {
  targetUserId: string;
  isFollowing: boolean;
  fullWidth?: boolean;
  size?: "small" | "medium";
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      disabled={isPending}
      fullWidth={fullWidth}
      onClick={() => {
        startTransition(async () => {
          if (isFollowing) {
            await unfollowUserAction(targetUserId);
          } else {
            await followUserAction(targetUserId);
          }
        });
      }}
      size={size}
      variant={isFollowing ? "outlined" : "contained"}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}
