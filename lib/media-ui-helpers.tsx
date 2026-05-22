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
 * Vaporwave Noir palette. Single source of truth for accent colors used
 * outside the MUI theme tokens (which cover semantic roles — primary, success,
 * warning, error). Import these by name; do not duplicate hex values at
 * call sites.
 */
export const ACCENTS = {
  pink: "#FF6FB5",
  lavender: "#B58CFF",
  teal: "#38E1D6",
  mint: "#7DFFC4",
  yellow: "#FFD56B",
  peach: "#FF9E7D",
  coral: "#FF6B6B",
  navy: "#4D7CFF",
  /** Brand chrome accent — used for nav, primary buttons, the Medialy logo,
   * links, and the user avatar. Reusing peach (the most iconic vaporwave hue)
   * for the brand identity; the MUSIC media-type uses `coral` instead so the
   * 1:1 media-type → color mapping still holds. */
  brand: "#FF9E7D",
} as const;

/**
 * Canonical media-type accent map. One color per `MediaType`. Used for icon
 * tints, poster fallback gradients, chip borders, and left-border accents
 * across dashboard, watchlist, discover, insights, media detail, and profile.
 */
export const MEDIA_ACCENT: Record<MediaType, string> = {
  MOVIE: ACCENTS.pink,
  TV_SHOW: ACCENTS.lavender,
  VIDEO_GAME: ACCENTS.teal,
  BOARD_GAME: ACCENTS.mint,
  BOOK: ACCENTS.yellow,
  MUSIC: ACCENTS.coral,
  MUSICAL: ACCENTS.navy,
};

export function mediaAccent(mediaType: MediaType): string {
  return MEDIA_ACCENT[mediaType] ?? ACCENTS.pink;
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

/**
 * Per-tab sx for an MUI `<Tab>` representing a media type. Tints the tab's
 * text/icon by the media accent — selected uses the full color, unselected
 * shows a faded version so the palette still reads at a glance.
 */
export function mediaTypeTabSx(mediaType: MediaType) {
  const accent = mediaAccent(mediaType);
  return {
    color: `${alpha(accent, 0.55)} !important`,
    "&:hover": { color: `${accent} !important` },
    "&.Mui-selected": { color: `${accent} !important` },
  };
}

/**
 * Indicator color for an MUI `<Tabs>` group when a media type is selected.
 * Falls back to the brand accent for "All" / no-selection states.
 */
export function mediaTypeTabIndicatorColor(mediaType: MediaType | null) {
  return mediaType ? mediaAccent(mediaType) : ACCENTS.brand;
}
