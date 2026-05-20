"use client";

import StarRoundedIcon from "@mui/icons-material/StarRounded";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Rating,
  Stack,
  Typography,
} from "@mui/material";
import { MediaStatus, type MediaType } from "@prisma/client";
import { useRef, useState } from "react";
import { availableStatuses, statusLabel } from "@/lib/status-labels";

type RatingAction = (formData: FormData) => void | Promise<void>;
type StatusAction = (formData: FormData) => void | Promise<void>;

export function MediaRatingControl({
  action,
  mediaType,
  personalRating,
  status,
  statusAction,
}: {
  action: RatingAction;
  mediaType?: MediaType;
  personalRating: number | null;
  status?: MediaStatus;
  statusAction?: StatusAction;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rating, setRating] = useState<number | null>(
    personalRating == null ? null : personalRating / 2,
  );
  const [promptOpen, setPromptOpen] = useState(false);
  const ratingValue = rating == null ? "" : String(rating * 2);

  const canPrompt =
    status === "UNTRACKED" && statusAction != null && mediaType != null;

  return (
    <>
      <form action={action} ref={formRef}>
        <input name="personalRating" type="hidden" value={ratingValue} />
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            gap: 1,
            justifyContent: "space-between",
          }}
        >
          <Rating
            icon={<StarRoundedIcon fontSize="inherit" />}
            max={5}
            onChange={(_, value) => {
              setRating(value);
              window.requestAnimationFrame(() => {
                formRef.current?.requestSubmit();
                if (value != null && canPrompt) setPromptOpen(true);
              });
            }}
            precision={0.5}
            sx={ratingSx}
            value={rating}
          />
          <Typography sx={ratingValueSx}>
            {rating == null ? "-" : `${ratingValue}/10`}
          </Typography>
        </Stack>
      </form>

      {canPrompt ? (
        <StatusPromptDialog
          mediaType={mediaType!}
          onClose={() => setPromptOpen(false)}
          open={promptOpen}
          statusAction={statusAction!}
        />
      ) : null}
    </>
  );
}

function StatusPromptDialog({
  mediaType,
  onClose,
  open,
  statusAction,
}: {
  mediaType: MediaType;
  onClose: () => void;
  open: boolean;
  statusAction: StatusAction;
}) {
  const statuses = availableStatuses(mediaType).filter(
    (value) => value !== "UNTRACKED",
  );

  const submitStatus = (value: MediaStatus) => {
    const formData = new FormData();
    formData.set("status", value);
    void statusAction(formData);
    onClose();
  };

  return (
    <Dialog onClose={onClose} open={open}>
      <DialogTitle>Update status?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          You just rated this but it's still marked Untracked. Want to set a
          status?
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 0.5, px: 3, pb: 2 }}>
        <Button onClick={onClose}>Keep untracked</Button>
        {statuses.map((value) => (
          <Button
            key={value}
            onClick={() => submitStatus(value)}
            variant="outlined"
          >
            {statusLabel(value, mediaType)}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );
}

const ratingSx = {
  color: "#F59E0B",
  fontSize: 30,
  "& .MuiRating-iconEmpty": {
    color: "rgba(216,230,255,0.16)",
  },
};

const ratingValueSx = {
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1,
};
