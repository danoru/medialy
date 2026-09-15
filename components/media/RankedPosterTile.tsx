"use client";

import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { MediaType } from "@prisma/client";
import { PosterTile } from "@/components/media/PosterCard";
import { ScoreBadge as PosterScoreBadge } from "@/components/media/ScoreDisplay";
import { releaseYearLabel } from "@/lib/date-labels";

type RankedPosterItem = {
  id: string;
  title: string;
  mediaType: MediaType;
  posterUrl?: string | null;
  releaseDate?: Date | string | null;
};

/**
 * A top-10 poster with its rank set in display type above the artwork —
 * №1 in the brand accent, the chasing pack in muted neutral so the shape of
 * the ranking reads before any title does.
 */
export function RankedPosterTile({
  item,
  rank,
  score,
}: {
  item: RankedPosterItem;
  rank: number;
  score?: number | null;
}) {
  // The page is already filtered to one media type, so the year alone carries
  // the caption — repeating "Movie" ten times says nothing.
  const releaseYear = releaseYearLabel(item.releaseDate);
  return (
    <Box sx={{ minWidth: 0, position: "relative", pt: 2.75 }}>
      <Typography
        component="span"
        sx={{
          color: (theme) =>
            rank === 1
              ? theme.palette.primary.main
              : alpha(theme.palette.text.primary, 0.32),
          fontFamily: (theme) => theme.typography.displayHero.fontFamily,
          fontSize: "2.125rem",
          fontWeight: 700,
          left: 2,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          position: "absolute",
          top: 0,
          zIndex: 2,
        }}
      >
        {rank}
      </Typography>
      <PosterTile
        item={item}
        meta={releaseYear ? [releaseYear] : undefined}
        scoreBadge={
          typeof score === "number" ? (
            <PosterScoreBadge score={score} />
          ) : undefined
        }
      />
    </Box>
  );
}
