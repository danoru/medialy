"use client";

import Link from "next/link";
import { Box } from "@mui/material";
import type { MediaType } from "@prisma/client";
import { alpha } from "@mui/material/styles";
import {
  mediaAccent,
  mediaTypeIcon,
  posterFallback,
} from "@/lib/media-ui-helpers";

type ThumbMedia = {
  id: string;
  title: string;
  mediaType: MediaType;
  posterUrl: string | null;
};

/** A small linked poster for list rows (activity, notes, people). */
export function MediaThumb({ item }: { item: ThumbMedia }) {
  return (
    <Box
      aria-label={item.title}
      component={Link}
      href={`/media/${item.id}`}
      sx={{
        backgroundImage: item.posterUrl
          ? `url(${item.posterUrl})`
          : posterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: "1px solid",
        borderColor: "border.subtle",
        borderLeft: `2px solid ${mediaAccent(item.mediaType)}`,
        borderRadius: "6px",
        alignItems: "center",
        color: alpha(mediaAccent(item.mediaType), 0.8),
        display: "flex",
        flexShrink: 0,
        height: 54,
        justifyContent: "center",
        width: 36,
        "& svg": { fontSize: 16 },
      }}
      title={item.title}
    >
      {/* No poster: the type's glyph, as on poster tiles, so the thumb
          doesn't collapse into a dark sliver. */}
      {item.posterUrl ? null : mediaTypeIcon(item.mediaType)}
    </Box>
  );
}

/** An inline title link that turns peach on hover. */
export function MediaTitleLink({ item }: { item: Pick<ThumbMedia, "id" | "title"> }) {
  return (
    <Box
      component={Link}
      href={`/media/${item.id}`}
      sx={{
        color: "inherit",
        fontWeight: 600,
        textDecoration: "none",
        "&:hover": { color: "primary.main" },
      }}
    >
      {item.title}
    </Box>
  );
}
