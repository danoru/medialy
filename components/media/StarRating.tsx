"use client";

import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Box, Rating, Typography } from "@mui/material";
import type { MediaStatus, MediaType } from "@prisma/client";
import { useState, useTransition } from "react";
import { setMediaStatus, type RateResult } from "@/app/media/actions";
import { useToast } from "@/components/shared/Toasts";
import { statusLabel } from "@/lib/status-labels";

type RateAction = (formData: FormData) => Promise<RateResult>;

/**
 * The single rating control for the whole app — Library rows, the detail page,
 * and the watchlist.
 *
 * Stored ratings are a 0–10 float; the UI is 5 half-stars, so the value is
 * halved on the way in and doubled on the way out. Tapping a star saves
 * immediately (optimistically) — there is no batch "save" step.
 *
 * Rating something you hadn't started also marks it watched (server-side, see
 * `statusAfterRating`). That's reported in the toast with an Undo, so the status
 * change is never silent.
 *
 * Touch-target note: half-star precision means each half is ~20px wide, under
 * the 44px guideline. This is the standard Letterboxd/IMDb tradeoff; we
 * compensate with a >=44px-tall row and a numeric readout so the value is always
 * confirmable. Drop to `precision={1}` if half-stars prove fiddly.
 */
export function StarRating({
  mediaId,
  mediaType,
  personalRating,
  rateAction,
  readOnly = false,
  size = "medium",
  title,
}: {
  mediaId: string;
  mediaType?: MediaType | null;
  personalRating: number | null;
  rateAction: RateAction;
  /** Signed-out viewers see the stars but can't tap them — the write would
   *  fail server-side, so don't pretend it's interactive. */
  readOnly?: boolean;
  size?: "medium" | "small";
  title: string;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  // Optimistic local value so the stars respond instantly on tap.
  const [rating, setRating] = useState<number | null>(
    personalRating == null ? null : personalRating / 2,
  );

  const handleChange = (value: number | null) => {
    const previous = rating;
    setRating(value);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("personalRating", value == null ? "" : String(value * 2));

      try {
        const result = await rateAction(formData);
        showToast(toastForResult(result, mediaId, mediaType, setMediaStatus));
      } catch {
        setRating(previous); // roll back the optimistic update
        showToast({ message: "Couldn't save that rating.", severity: "error" });
      }
    });
  };

  const scoreLabel = rating == null ? "–" : `${rating * 2}/10`;

  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        gap: 1,
        // Keep the row itself a comfortable target even though each half-star
        // is narrower than 44px.
        minHeight: 44,
      }}
    >
      <Rating
        aria-label={readOnly ? `Rating for ${title}` : `Rate ${title}`}
        icon={<StarRoundedIcon fontSize="inherit" />}
        emptyIcon={<StarRoundedIcon fontSize="inherit" />}
        max={5}
        onChange={(_, value) => handleChange(value)}
        precision={0.5}
        readOnly={readOnly}
        sx={{
          color: "#F59E0B",
          fontSize: size === "small" ? { xs: 32, md: 26 } : { xs: 40, md: 32 },
          "& .MuiRating-iconEmpty": { color: "rgba(216,230,255,0.22)" },
        }}
        value={rating}
      />
      <Typography
        sx={{
          color: rating == null ? "text.secondary" : "text.primary",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          minWidth: 48,
        }}
      >
        {scoreLabel}
      </Typography>
    </Box>
  );
}

function toastForResult(
  result: RateResult,
  mediaId: string,
  mediaType: MediaType | null | undefined,
  restore: (id: string, status: MediaStatus) => Promise<void>,
) {
  if (result.personalRating == null) {
    return { message: "Rating cleared.", severity: "success" as const };
  }

  if (!result.autoCompleted) {
    return {
      message: `Rated ${result.personalRating}/10.`,
      severity: "success" as const,
    };
  }

  const completed = statusLabel("COMPLETED", mediaType);
  return {
    message: `Rated ${result.personalRating}/10 · marked ${completed}.`,
    severity: "success" as const,
    action: {
      label: "Undo",
      onClick: () => {
        void restore(mediaId, result.previousStatus);
      },
    },
  };
}
