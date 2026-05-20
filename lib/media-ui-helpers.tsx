import type { ReactNode } from "react";
import { alpha } from "@mui/material/styles";
import { MediaType } from "@prisma/client";
import MovieIcon from "@mui/icons-material/Movie";
import TvIcon from "@mui/icons-material/Tv";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CasinoIcon from "@mui/icons-material/Casino";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import TheaterComedyIcon from "@mui/icons-material/TheaterComedy";

import { formatMediaType } from "@/lib/format";

/**
 * Canonical media-type accent palette. Tuned to be readable on both
 * light and dark surfaces. Used for icon tints, poster fallback
 * gradients, and chip borders across dashboard, watchlist, discover,
 * insights, and profile views.
 *
 * Note: the watchlist page previously used a different palette
 * (blue/green/purple). It is intentionally migrated here so all
 * surfaces share one media-type identity.
 */
export const MEDIA_ACCENT: Record<MediaType, string> = {
  MOVIE: "#6366F1",
  TV_SHOW: "#0EA5A4",
  VIDEO_GAME: "#D97706",
  BOOK: "#DC2626",
  BOARD_GAME: "#16A34A",
  MUSIC: "#0EA5A4",
  MUSICAL: "#DC2626",
};

export function mediaAccent(mediaType: MediaType): string {
  return MEDIA_ACCENT[mediaType] ?? "#6366F1";
}

/** Short, plural label suitable for nav/filter chips. */
export function shortMediaTypeLabel(mediaType: MediaType): string {
  if (mediaType === MediaType.TV_SHOW) return "TV";
  if (mediaType === MediaType.VIDEO_GAME) return "Games";
  if (mediaType === MediaType.MOVIE) return "Movies";
  if (mediaType === MediaType.BOOK) return "Books";
  if (mediaType === MediaType.BOARD_GAME) return "Board";
  if (mediaType === MediaType.MUSIC) return "Music";
  if (mediaType === MediaType.MUSICAL) return "Musicals";
  return formatMediaType(mediaType);
}

export function mediaTypeIcon(
  mediaType: MediaType,
  props: { fontSize?: "inherit" | "small" | "medium" | "large" } = {
    fontSize: "small",
  },
): ReactNode {
  switch (mediaType) {
    case MediaType.TV_SHOW:
      return <TvIcon fontSize={props.fontSize} />;
    case MediaType.VIDEO_GAME:
      return <SportsEsportsIcon fontSize={props.fontSize} />;
    case MediaType.BOOK:
      return <MenuBookIcon fontSize={props.fontSize} />;
    case MediaType.BOARD_GAME:
      return <CasinoIcon fontSize={props.fontSize} />;
    case MediaType.MUSIC:
      return <MusicNoteIcon fontSize={props.fontSize} />;
    case MediaType.MUSICAL:
      return <TheaterComedyIcon fontSize={props.fontSize} />;
    case MediaType.MOVIE:
    default:
      return <MovieIcon fontSize={props.fontSize} />;
  }
}

/**
 * CSS gradient used as a poster fallback when a media item has no
 * artwork. Mirrors the same accent → dark vignette ramp used across
 * dashboard/watchlist/discover/insights/profile.
 */
export function posterFallback(mediaType: MediaType): string {
  const accent = mediaAccent(mediaType);
  return `linear-gradient(150deg, ${alpha(accent, 0.45)}, ${alpha(accent, 0.12)} 55%, rgba(8,8,11,0.85))`;
}
