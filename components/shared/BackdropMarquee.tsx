"use client";

import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { MediaType } from "@prisma/client";
import { PosterTile } from "@/components/media/PosterCard";
import { ScoreBadge } from "@/components/media/ScoreDisplay";
import { posterFallback } from "@/lib/media-ui-helpers";

/** Secondary text on the marquee's darkened art. */
export const MARQUEE_MUTED = alpha("#F4EEFA", 0.72);

/**
 * The backdrop marquee shared by the profile and people pages. A poster is
 * painted twice: zoomed and blurred behind everything as a colour wash, and
 * sharp at its real 2:3 shape in the `aside` — so a portrait poster never gets
 * stretched into a banner. This is the page's one featured glow.
 */
export function BackdropMarquee({
  accent,
  aside,
  children,
  mediaType,
  posterUrl,
}: {
  accent: string;
  aside?: ReactNode;
  children: ReactNode;
  /** Picks the gradient fallback when there is no poster to paint. */
  mediaType: MediaType;
  posterUrl: string | null | undefined;
}) {
  const wash = posterUrl ? `url(${posterUrl})` : posterFallback(mediaType);
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "border.default",
        borderRadius: `${12}px`,
        boxShadow: `0 24px 60px rgba(0, 0, 0, 0.45), 0 0 48px -12px ${alpha(accent, 0.45)}, 0 1px 0 ${alpha("#FFFFFF", 0.04)} inset`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/*
        The poster painted twice: soft and zoomed here as the backdrop, sharp
        at its real 2:3 shape on the right. The blur is light enough that the
        art still reads as art, and the overlay only darkens where text sits.
      */}
      <Box
        aria-hidden
        sx={{
          backgroundImage: wash,
          backgroundPosition: "center 25%",
          backgroundSize: "cover",
          filter: "blur(18px) saturate(1.25)",
          inset: -40,
          position: "absolute",
          transform: "scale(1.12)",
        }}
      />
      <Box
        aria-hidden
        sx={{
          background:
            "linear-gradient(90deg, rgba(10,8,16,0.9) 0%, rgba(10,8,16,0.72) 40%, rgba(10,8,16,0.28) 72%, rgba(10,8,16,0.12) 100%), linear-gradient(180deg, rgba(10,8,16,0.05) 0%, rgba(10,8,16,0.45) 100%)",
          inset: 0,
          position: "absolute",
        }}
      />
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{
          alignItems: { md: "flex-end" },
          gap: 3,
          justifyContent: "space-between",
          minHeight: { md: 320 },
          p: { xs: 2, md: 3.5 },
          position: "relative",
        }}
      >
        {children}
        {aside}
      </Stack>
    </Box>
  );
}

/** The marquee's display-size name. */
export function MarqueeTitle({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="h1"
      sx={{
        fontFamily: (theme) => theme.typography.h2.fontFamily,
        fontSize: { xs: "2rem", md: "2.75rem" },
        fontWeight: 700,
        letterSpacing: "-0.035em",
        lineHeight: 1.02,
      }}
    >
      {children}
    </Typography>
  );
}

/**
 * The featured poster on the marquee's right: an eyebrow in the media colour,
 * the title, and the sharp poster with its score.
 */
export function MarqueeFeature({
  accent,
  eyebrow,
  item,
  meta,
  score,
}: {
  accent: string;
  eyebrow: string;
  item: { id: string; title: string; mediaType: MediaType; posterUrl: string | null };
  meta?: string[];
  score: number | null;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "flex-end", flexShrink: 0, gap: 2 }}>
      <Box sx={{ pb: 0.75, textAlign: "right" }}>
        <Typography variant="eyebrow" sx={{ color: accent, display: "block" }}>
          {eyebrow}
        </Typography>
        <Typography
          sx={{
            fontFamily: (theme) => theme.typography.h5.fontFamily,
            fontSize: "1.125rem",
            fontWeight: 650,
            letterSpacing: "-0.02em",
            mt: 0.5,
          }}
        >
          {item.title}
        </Typography>
      </Box>
      <Box sx={{ boxShadow: "0 16px 40px rgba(0, 0, 0, 0.55)", width: 148 }}>
        <PosterTile
          item={item}
          meta={meta}
          scoreBadge={score != null ? <ScoreBadge score={score} /> : undefined}
        />
      </Box>
    </Stack>
  );
}
