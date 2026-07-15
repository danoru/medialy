"use client";
import { Box } from "@mui/material";

import { formatScore, matchTone } from "@/lib/score-display";

/**
 * Conic-gradient ring with the rounded score in the center. Used in
 * watchlist queue rows and recommendation cards.
 */
export function ScoreRing({ score, size = 38 }: { score: number; size?: number }) {
  const tone = matchTone(score);
  const inner = Math.max(size - 10, 0);
  return (
    <Box
      sx={{
        alignItems: "center",
        background: `conic-gradient(${tone} ${Math.round(score)}%, rgba(var(--mui-palette-text-primaryChannel) / 0.08) 0)`,
        borderRadius: "50%",
        display: "flex",
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          bgcolor: "background.paper",
          borderRadius: "50%",
          display: "flex",
          fontSize: "0.875rem",
          fontWeight: 650,
          height: inner,
          justifyContent: "center",
          width: inner,
        }}
      >
        {Math.round(score)}%
      </Box>
    </Box>
  );
}

/**
 * Ten-bar determinate indicator tinted by score band. Used as a
 * compact alternative to {@link ScoreRing} in narrow row layouts.
 */
export function ScoreBars({ value }: { value: number }) {
  const activeBars = Math.max(1, Math.round(value / 10));
  const tone = matchTone(value);
  return (
    <Box
      sx={{
        display: "grid",
        gap: 0.25,
        gridTemplateColumns: "repeat(10, 1fr)",
      }}
    >
      {Array.from({ length: 10 }).map((_, index) => (
        <Box
          key={index}
          sx={{
            bgcolor:
              index < activeBars
                ? tone
                : "rgba(var(--mui-palette-text-primaryChannel) / 0.08)",
            borderRadius: 0.5,
            height: 9,
          }}
        />
      ))}
    </Box>
  );
}

/**
 * Compact pill-style badge with a frosted dark background — designed
 * for overlay on poster artwork. Used in dashboard "tonight" tiles
 * and recommendation cards.
 */
export function ScoreBadge({ score }: { score: number }) {
  return (
    <Box
      sx={{
        backdropFilter: "blur(6px)",
        bgcolor: "rgba(8,8,11,0.6)",
        borderRadius: 1,
        color: "#FFFFFF",
        fontSize: "0.875rem",
        fontWeight: 700,
        px: 0.75,
        py: 0.35,
      }}
    >
      {formatScore(score)}
    </Box>
  );
}
