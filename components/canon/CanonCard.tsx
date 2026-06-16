"use client";

import { useState, type MouseEvent } from "react";
import { Box, Chip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { CreditRole, MediaType } from "@prisma/client";
import { PosterImage } from "@/components/media/PosterCard";
import { creditLabel } from "@/lib/credits";

export type CanonCardData = {
  id: string;
  title: string;
  mediaType: MediaType;
  posterUrl: string | null;
  year: number | null;
  genres: string[];
  score: number;
  leadCredit: { role: CreditRole; name: string } | null;
  rank: number;
};

/**
 * A ranked poster card whose front shows rank + score; on hover (pointer) or
 * first tap (touch) a detail overlay reveals title, year, lead contributor,
 * and genres. The whole card links to the item's detail page — on touch the
 * first tap reveals and the next follows the link.
 */
export function CanonCard({
  accent,
  data,
}: {
  accent: string;
  data: CanonCardData;
}) {
  const [revealed, setRevealed] = useState(false);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      !revealed &&
      typeof window !== "undefined" &&
      window.matchMedia("(hover: none)").matches
    ) {
      event.preventDefault();
      setRevealed(true);
    }
  };

  const metaLine = [data.year?.toString(), data.genres.slice(0, 2).join(" · ")]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Box
      className={revealed ? "revealed" : undefined}
      component="a"
      href={`/media/${data.id}`}
      onClick={handleClick}
      sx={{
        borderRadius: 1.5,
        color: "inherit",
        display: "block",
        overflow: "hidden",
        position: "relative",
        textDecoration: "none",
        [`&:hover .canon-reveal, &.revealed .canon-reveal`]: {
          opacity: 1,
          transform: "translateY(0)",
        },
      }}
    >
      <PosterImage
        item={{
          mediaType: data.mediaType,
          posterUrl: data.posterUrl,
          title: data.title,
        }}
      />

      <Box
        className="canon-reveal"
        sx={{
          background:
            "linear-gradient(180deg, rgba(8,8,11,0.1) 0%, rgba(8,8,11,0.55) 45%, rgba(8,8,11,0.92) 100%)",
          display: "flex",
          flexDirection: "column",
          gap: 0.25,
          inset: 0,
          justifyContent: "flex-end",
          opacity: 0,
          p: 1,
          position: "absolute",
          transform: "translateY(10px)",
          transition: "opacity 160ms ease, transform 160ms ease",
        }}
      >
        <Typography
          sx={{ color: "#fff", fontWeight: 700, lineHeight: 1.2 }}
          variant="body2"
        >
          {data.title}
        </Typography>
        {metaLine ? (
          <Typography sx={{ color: alpha("#fff", 0.78) }} variant="caption">
            {metaLine}
          </Typography>
        ) : null}
        {data.leadCredit ? (
          <Typography sx={{ color: alpha("#fff", 0.78) }} variant="caption">
            {creditLabel(data.mediaType, data.leadCredit.role)}{" "}
            <Box component="span" sx={{ color: "#fff", fontWeight: 600 }}>
              {data.leadCredit.name}
            </Box>
          </Typography>
        ) : null}
      </Box>

      <Box
        sx={{
          alignItems: "center",
          backgroundColor: alpha("#000", 0.72),
          borderRadius: 1,
          color: "#fff",
          display: "flex",
          fontSize: "0.72rem",
          fontWeight: 700,
          height: 22,
          justifyContent: "center",
          left: 4,
          minWidth: 22,
          position: "absolute",
          px: 0.5,
          top: 4,
        }}
      >
        {data.rank}
      </Box>
      <Chip
        label={data.score.toFixed(1)}
        size="small"
        sx={{
          backgroundColor: alpha(accent, 0.92),
          color: "#fff",
          fontWeight: 700,
          height: 20,
          position: "absolute",
          right: 4,
          top: 4,
          "& .MuiChip-label": { px: 0.75 },
        }}
      />
    </Box>
  );
}
