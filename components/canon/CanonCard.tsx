"use client";

import { useState, type MouseEvent } from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { CreditRole, MediaType } from "@prisma/client";
import { creditLabel } from "@/lib/credits";
import { ACCENTS, HEADING_FONT, posterFallback } from "@/lib/media-ui-helpers";

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

/** How the rank reads on the poster: a big outlined numeral overlapping the
 * corner (the top-overall runners) or a small solid badge (dense genre rows). */
export type CanonRankStyle = "stroke" | "badge";

/**
 * A ranked poster card. The rank is the only mark on the artwork; the title and
 * year+genres sit below the poster (never overlaid on it). Score is a supporting
 * signal, so it — with the lead contributor — is revealed on hover, or on first
 * tap for touch, before the card links through to the item.
 */
export function CanonCard({
  data,
  rankStyle = "badge",
}: {
  data: CanonCardData;
  rankStyle?: CanonRankStyle;
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
        color: "inherit",
        display: "block",
        minWidth: 0,
        textDecoration: "none",
        "&:hover .canon-poster, &.revealed .canon-poster": {
          borderColor: "border.strong",
          transform: "translateY(-4px)",
        },
        "&:hover .canon-reveal, &.revealed .canon-reveal": { opacity: 1 },
      }}
    >
      <Box sx={{ position: "relative", pt: rankStyle === "stroke" ? "18px" : 0 }}>
        {rankStyle === "stroke" ? (
          <Box
            aria-hidden
            sx={{
              color: "transparent",
              fontFamily: HEADING_FONT,
              fontSize: 58,
              fontWeight: 700,
              left: -4,
              lineHeight: 1,
              pointerEvents: "none",
              position: "absolute",
              top: -8,
              WebkitTextStroke: "1px rgba(244,238,250,0.35)",
              zIndex: 2,
            }}
          >
            {data.rank}
          </Box>
        ) : null}

        <Box
          className="canon-poster"
          sx={{
            aspectRatio: "2 / 3",
            backgroundImage: data.posterUrl
              ? `url(${data.posterUrl})`
              : posterFallback(data.mediaType),
            backgroundPosition: "center",
            backgroundSize: "cover",
            border: "1px solid",
            borderColor: "border.default",
            borderRadius: "8px",
            overflow: "hidden",
            position: "relative",
            transition: "transform 200ms ease, border-color 200ms ease",
          }}
        >
          {rankStyle === "badge" ? (
            <Box
              sx={{
                alignItems: "center",
                backgroundColor: alpha("#000", 0.72),
                borderRadius: "5px",
                color: "#fff",
                display: "flex",
                fontSize: "0.72rem",
                fontWeight: 700,
                height: 20,
                justifyContent: "center",
                left: 5,
                minWidth: 20,
                position: "absolute",
                px: 0.5,
                top: 5,
                zIndex: 2,
              }}
            >
              {data.rank}
            </Box>
          ) : null}

          <Box
            className="canon-reveal"
            sx={{
              alignItems: "flex-start",
              background:
                "linear-gradient(180deg, rgba(8,8,11,0.05) 0%, rgba(8,8,11,0.5) 55%, rgba(8,8,11,0.92) 100%)",
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              inset: 0,
              justifyContent: "flex-end",
              opacity: 0,
              p: 1,
              position: "absolute",
              transition: "opacity 160ms ease",
              zIndex: 1,
            }}
          >
            <Typography
              component="div"
              sx={{
                color: ACCENTS.teal,
                fontFamily: HEADING_FONT,
                fontWeight: 700,
                lineHeight: 1,
              }}
              variant="subtitle2"
            >
              {data.score.toFixed(1)}
            </Typography>
            {data.leadCredit ? (
              <Typography
                sx={{ color: alpha("#fff", 0.82), lineHeight: 1.25 }}
                variant="caption"
              >
                {creditLabel(data.mediaType, data.leadCredit.role)}{" "}
                <Box component="span" sx={{ color: "#fff", fontWeight: 600 }}>
                  {data.leadCredit.name}
                </Box>
              </Typography>
            ) : null}
          </Box>
        </Box>
      </Box>

      <Typography
        sx={{
          display: "-webkit-box",
          fontSize: "0.8rem",
          fontWeight: 600,
          lineHeight: 1.25,
          minHeight: 33,
          mt: 1,
          overflow: "hidden",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
        title={data.title}
      >
        {data.title}
      </Typography>
      {metaLine ? (
        <Typography
          sx={{ color: "text.secondary", fontSize: "0.72rem", mt: 0.25 }}
        >
          {metaLine}
        </Typography>
      ) : null}
    </Box>
  );
}
