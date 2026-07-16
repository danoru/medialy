import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ACCENTS, HEADING_FONT, posterFallback } from "@/lib/media-ui-helpers";
import type { CanonCardData } from "@/components/canon/CanonCard";

/**
 * The №1 poster in a genre shelf: larger than its siblings, with title/year
 * set over a bottom vignette. This is the one place a caption sits on the
 * artwork — reserved for the shelf lead so the rank reads instantly.
 */
export function CanonLeadCard({
  accent,
  item,
}: {
  accent: string;
  item: CanonCardData;
}) {
  return (
    <Box
      component="a"
      href={`/media/${item.id}`}
      sx={{
        aspectRatio: "2 / 3",
        backgroundImage: item.posterUrl
          ? `url(${item.posterUrl})`
          : posterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: "1px solid",
        borderColor: "border.strong",
        borderRadius: "10px",
        color: "inherit",
        display: "block",
        minWidth: 0,
        overflow: "hidden",
        position: "relative",
        textDecoration: "none",
        transition: "transform 200ms ease, border-color 200ms ease",
        "&:hover": { transform: "translateY(-4px)" },
      }}
    >
      <Box
        sx={{
          background:
            "linear-gradient(180deg, transparent 45%, rgba(8,8,11,0.55) 70%, rgba(8,8,11,0.95) 100%)",
          inset: 0,
          position: "absolute",
        }}
      />
      <Box sx={{ bottom: 10, left: 12, position: "absolute", right: 12 }}>
        <Typography
          sx={{
            color: accent,
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          № 1
        </Typography>
        <Typography
          sx={{
            color: "#fff",
            display: "-webkit-box",
            fontFamily: HEADING_FONT,
            fontSize: "1.0625rem",
            fontWeight: 700,
            letterSpacing: "-0.015em",
            lineHeight: 1.15,
            mt: 0.375,
            overflow: "hidden",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
          }}
        >
          {item.title}
        </Typography>
        <Typography
          sx={{ color: alpha("#fff", 0.65), fontSize: "0.75rem", mt: 0.375 }}
        >
          {item.year != null ? item.year : null}
          {item.year != null ? " · " : null}
          <Box component="span" sx={{ color: ACCENTS.teal, fontWeight: 600 }}>
            {item.score.toFixed(1)}
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}
