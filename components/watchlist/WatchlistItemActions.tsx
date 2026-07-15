"use client";

import CloseIcon from "@mui/icons-material/Close";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import { Button, Stack, Tooltip } from "@mui/material";
import type { MediaType } from "@prisma/client";
import { useTransition } from "react";
import { setMediaStatus, setMediaWatched } from "@/app/media/actions";
import { useToast } from "@/components/shared/Toasts";
import { statusLabel } from "@/lib/status-labels";

/**
 * Real actions for a watchlist row.
 *
 * The watchlist previously rendered "Save watchlist item" and "Dismiss
 * watchlist item" icon buttons with no `onClick` at all — it's a server
 * component, so they *couldn't* have handlers. The two things the page exists
 * to let you do did nothing. These do.
 */
export function WatchlistItemActions({
  mediaId,
  mediaType,
  title,
}: {
  mediaId: string;
  mediaType: MediaType;
  title: string;
}) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  const watchedLabel = statusLabel("COMPLETED", mediaType);

  const markWatched = () => {
    startTransition(async () => {
      await setMediaWatched(mediaId, true);
      showToast({ message: `${title} · ${watchedLabel}.` });
    });
  };

  const dismiss = () => {
    startTransition(async () => {
      await setMediaStatus(mediaId, "NOT_INTERESTED");
      showToast({
        message: `${title} hidden from recommendations.`,
        action: {
          label: "Undo",
          onClick: () => {
            void setMediaStatus(mediaId, "WATCHLIST");
          },
        },
      });
    });
  };

  return (
    <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
      <Button
        disabled={pending}
        fullWidth
        onClick={markWatched}
        startIcon={<DoneRoundedIcon />}
        sx={{ minHeight: 44 }}
        variant="contained"
      >
        {watchedLabel}
      </Button>
      <Button
        href={`/media/${mediaId}`}
        sx={{ minHeight: 44, whiteSpace: "nowrap" }}
        variant="outlined"
      >
        Details
      </Button>
      <Tooltip title="Not interested">
        <Button
          aria-label={`Not interested in ${title}`}
          disabled={pending}
          onClick={dismiss}
          sx={{ minHeight: 44, minWidth: 44, px: 0 }}
          variant="outlined"
        >
          <CloseIcon fontSize="small" />
        </Button>
      </Tooltip>
    </Stack>
  );
}
