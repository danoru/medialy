"use client";
import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import Link from "next/link";
import type { MediaType } from "@prisma/client";

import {
  mediaAccent,
  mediaTypeIcon,
  posterFallback,
} from "@/lib/media-ui-helpers";

type PosterMedia = {
  id?: string;
  mediaType: MediaType;
  posterUrl?: string | null;
  title?: string;
};

/**
 * Minimal poster artwork box: aspect-ratio 2/3, image cover, gradient
 * fallback when there is no `posterUrl`. Used for unadorned thumbs
 * and small grid tiles (replaces `MiniPoster`, `PosterBlock`, and
 * the unadorned discover `PosterCard`).
 */
export function PosterImage({
  item,
  elevated = false,
  minHeight,
  sx,
}: {
  item: PosterMedia;
  elevated?: boolean;
  minHeight?: number | string;
  sx?: object;
}) {
  return (
    <Box
      sx={{
        aspectRatio: "2 / 3",
        backgroundImage: item.posterUrl
          ? `url(${item.posterUrl})`
          : posterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: "1px solid",
        borderColor: elevated ? "border.strong" : "border.subtle",
        borderLeft: `2px solid ${mediaAccent(item.mediaType)}`,
        borderRadius: 2,
        boxShadow: elevated ? 8 : undefined,
        minHeight,
        overflow: "hidden",
        width: "100%",
        ...sx,
      }}
    />
  );
}

/**
 * Small fixed-size poster thumbnail (used in queue/list rows). The
 * border tint accepts an optional accent so it can echo a score band.
 */
export function PosterThumb({
  item,
  accent,
  size = "md",
}: {
  item: PosterMedia;
  accent?: string;
  size?: "sm" | "md";
}) {
  const dims = size === "sm" ? { h: 48, w: 32 } : { h: 60, w: 40 };
  return (
    <Box
      sx={{
        backgroundImage: item.posterUrl
          ? `url(${item.posterUrl})`
          : posterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: `1px solid ${accent ? alpha(accent, 0.18) : "rgba(255,255,255,0.08)"}`,
        borderLeft: `2px solid ${mediaAccent(item.mediaType)}`,
        borderRadius: 1.5,
        height: dims.h,
        overflow: "hidden",
        position: "relative",
        width: dims.w,
      }}
    />
  );
}

/**
 * Rich poster tile with vignette overlay, optional score badge,
 * fallback media-type icon, and title/meta caption. Used for the
 * "Tonight's pick" and recommendation grids on the dashboard.
 */
export function PosterTile({
  item,
  meta,
  overlay,
  scoreBadge,
}: {
  item: PosterMedia & { id: string; title: string };
  meta?: string[];
  overlay?: ReactNode;
  scoreBadge?: ReactNode;
}) {
  return (
    <Link
      href={`/media/${item.id}`}
      style={{ color: "inherit", display: "block", textDecoration: "none" }}
    >
      <Box
        sx={{
          aspectRatio: "2 / 3",
          bgcolor: "surface.2",
          border: "1px solid",
          borderColor: "border.subtle",
          borderLeft: `2px solid ${mediaAccent(item.mediaType)}`,
          borderRadius: 2,
          minWidth: 0,
          overflow: "hidden",
          position: "relative",
          transition: "transform 200ms ease, border-color 200ms ease",
          "&:hover": {
            borderColor: "border.strong",
            borderLeftColor: mediaAccent(item.mediaType),
            transform: "translateY(-3px)",
            "& .tile-poster": { transform: "scale(1.06)" },
            "& .tile-overlay": { opacity: 1 },
          },
        }}
      >
        <Box
          className="tile-poster"
          sx={{
            backgroundImage: item.posterUrl
              ? `url(${item.posterUrl})`
              : posterFallback(item.mediaType),
            backgroundPosition: "center",
            backgroundSize: "cover",
            inset: 0,
            position: "absolute",
            transition: "transform 500ms cubic-bezier(.2,.8,.2,1)",
          }}
        />
        <Box
          sx={{
            background:
              "linear-gradient(180deg, transparent 35%, rgba(8,8,11,0.45) 62%, rgba(8,8,11,0.92) 100%)",
            inset: 0,
            position: "absolute",
          }}
        />
        {scoreBadge ? (
          <Box sx={{ position: "absolute", right: 6, top: 6, zIndex: 3 }}>
            {scoreBadge}
          </Box>
        ) : null}
        {!item.posterUrl ? (
          <Box
            sx={{
              alignItems: "center",
              color: alpha(mediaAccent(item.mediaType), 0.9),
              display: "flex",
              inset: 0,
              justifyContent: "center",
              position: "absolute",
              zIndex: 1,
              "& svg": { fontSize: 28 },
            }}
          >
            {mediaTypeIcon(item.mediaType)}
          </Box>
        ) : null}
        <Box
          sx={{
            bottom: 0,
            left: 0,
            p: 1,
            position: "absolute",
            right: 0,
            zIndex: 3,
          }}
        >
          <Typography
            sx={{
              color: "#FFFFFF",
              display: "-webkit-box",
              fontSize: "0.875rem",
              fontWeight: 600,
              lineHeight: 1.15,
              overflow: "hidden",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
            title={item.title}
          >
            {item.title}
          </Typography>
          {meta && meta.length > 0 ? (
            <Typography
              sx={{
                color: "rgba(255,255,255,0.7)",
                fontSize: "0.875rem",
                fontWeight: 500,
                lineHeight: 1,
                mt: 0.5,
              }}
            >
              {meta.join(" · ")}
            </Typography>
          ) : null}
        </Box>
        {overlay ? (
          <Box
            className="tile-overlay"
            sx={{
              alignItems: "center",
              background:
                "linear-gradient(180deg, rgba(8,8,11,0.92) 0%, rgba(8,8,11,0.96) 100%)",
              display: "flex",
              inset: 0,
              opacity: 0,
              overflowY: "auto",
              p: 1.25,
              position: "absolute",
              transition: "opacity 200ms ease",
              zIndex: 4,
            }}
          >
            {overlay}
          </Box>
        ) : null}
      </Box>
    </Link>
  );
}
