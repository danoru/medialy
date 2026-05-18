"use client";

import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Rating, Stack, Typography } from "@mui/material";
import { useRef, useState } from "react";

type RatingAction = (formData: FormData) => void | Promise<void>;

export function MediaRatingControl({
  action,
  personalRating,
}: {
  action: RatingAction;
  personalRating: number | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rating, setRating] = useState<number | null>(
    personalRating == null ? null : personalRating / 2,
  );
  const ratingValue = rating == null ? "" : String(rating * 2);

  return (
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
