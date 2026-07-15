"use client";

import BookmarkAddedRoundedIcon from "@mui/icons-material/BookmarkAddedRounded";
import BookmarkAddRoundedIcon from "@mui/icons-material/BookmarkAddRounded";
import { Button, Stack } from "@mui/material";
import type { MediaStatus } from "@prisma/client";
import { useState, useTransition } from "react";
import { setMediaStatus } from "@/app/media/actions";
import { useToast } from "@/components/shared/Toasts";

/**
 * Row actions for an upcoming release.
 *
 * "Edit" used to be the `contained` (primary) button on every row — pushing a
 * casual user toward a metadata form when what they actually want is "remind me
 * about this one". The real verb is Watchlist; Edit is demoted to the detail
 * page where it belongs.
 */
export function UpcomingRowActions({
  mediaId,
  status,
  title,
}: {
  mediaId: string;
  status: MediaStatus;
  title: string;
}) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [onWatchlist, setOnWatchlist] = useState(status === "WATCHLIST");

  const toggle = () => {
    const next = !onWatchlist;
    setOnWatchlist(next);
    startTransition(async () => {
      await setMediaStatus(mediaId, next ? "WATCHLIST" : "UNTRACKED");
      showToast({
        message: next
          ? `${title} added to your watchlist.`
          : `${title} removed from your watchlist.`,
      });
    });
  };

  return (
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
      <Button
        href={`/media/${mediaId}`}
        sx={{ minHeight: 44 }}
        variant="outlined"
      >
        Details
      </Button>
      <Button
        aria-pressed={onWatchlist}
        disabled={pending}
        onClick={toggle}
        startIcon={
          onWatchlist ? <BookmarkAddedRoundedIcon /> : <BookmarkAddRoundedIcon />
        }
        sx={{ minHeight: 44 }}
        variant={onWatchlist ? "outlined" : "contained"}
      >
        {onWatchlist ? "On watchlist" : "Watchlist"}
      </Button>
    </Stack>
  );
}
