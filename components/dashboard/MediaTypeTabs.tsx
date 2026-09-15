"use client";

import { Typography, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { MediaType } from "@prisma/client";
import {
  mediaAccent,
  mediaTypeIcon,
  shortMediaTypeLabel,
} from "@/lib/media-ui-helpers";

export const SWITCHER_MEDIA_TYPES: MediaType[] = [
  "MOVIE",
  "TV_SHOW",
  "VIDEO_GAME",
];

export function MediaTypeTabs({
  onChange,
  value,
}: {
  onChange: (value: MediaType) => void;
  value: MediaType;
}) {
  return (
    <ToggleButtonGroup
      aria-label="Media type"
      exclusive
      onChange={(_, nextValue: MediaType | null) => {
        if (nextValue) onChange(nextValue);
      }}
      size="small"
      sx={{
        bgcolor: "surface.1",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 2,
        display: "inline-flex",
        gap: 0.25,
        p: 0.35,
        width: "max-content",
        "& .MuiToggleButton-root": {
          border: 0,
          borderRadius: 1.5,
          color: "text.secondary",
          gap: 0.6,
          minHeight: 44,
          px: 1,
          py: 0.4,
          textTransform: "none",
          whiteSpace: "nowrap",
          "&.Mui-selected": {
            bgcolor: "background.paper",
            color: "text.primary",
            boxShadow: (theme) => theme.shadows[1],
            "&:hover": { bgcolor: "background.paper" },
          },
        },
      }}
      value={value}
    >
      {SWITCHER_MEDIA_TYPES.map((mediaType) => {
        const accent = mediaAccent(mediaType);
        return (
          <ToggleButton
            key={mediaType}
            value={mediaType}
            sx={{
              borderLeft: `2px solid ${alpha(accent, 0.35)} !important`,
              "& svg": { color: accent },
              "&.Mui-selected": {
                bgcolor: `${alpha(accent, 0.18)} !important`,
                borderLeft: `2px solid ${accent} !important`,
                color: `${accent} !important`,
              },
            }}
          >
            {mediaTypeIcon(mediaType)}
            <Typography
              component="span"
              sx={{ fontSize: "0.875rem", fontWeight: 550 }}
            >
              {shortMediaTypeLabel(mediaType)}
            </Typography>
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}
