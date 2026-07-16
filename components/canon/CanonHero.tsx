import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { creditLabel } from "@/lib/credits";
import { ACCENTS, HEADING_FONT, posterFallback } from "@/lib/media-ui-helpers";
import type { CanonCardData } from "@/components/canon/CanonCard";

/**
 * The one featured element on the Canon overview: the №1 item as a large,
 * glowing poster with an oversized outlined "1" bleeding off its corner, paired
 * with the page eyebrow/title/dek and the winner's name, year, and score. This
 * is the single glow the page is allowed — every other card stays neutral.
 */
export function CanonHero({
  accent,
  dek,
  eyebrow,
  item,
  title,
}: {
  accent: string;
  dek: string;
  eyebrow: string;
  item: CanonCardData;
  title: string;
}) {
  const winnerMeta = [
    item.year?.toString(),
    item.leadCredit?.name,
    item.score.toFixed(1),
  ].filter(Boolean);

  return (
    <Box
      sx={{
        alignItems: { md: "end" },
        display: "grid",
        gap: { xs: 3, md: 6 },
        gridTemplateColumns: { xs: "1fr", md: "260px 1fr" },
      }}
    >
      <Box sx={{ position: "relative", maxWidth: { xs: 200, md: "none" } }}>
        <Box
          aria-hidden
          sx={{
            bottom: { xs: -20, md: -36 },
            color: "transparent",
            fontFamily: HEADING_FONT,
            fontSize: { xs: 120, md: 190 },
            fontWeight: 700,
            left: { xs: -14, md: -28 },
            lineHeight: 1,
            pointerEvents: "none",
            position: "absolute",
            WebkitTextStroke: `1.5px ${alpha(accent, 0.45)}`,
            zIndex: 2,
          }}
        >
          1
        </Box>
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
            border: `1px solid ${alpha(accent, 0.35)}`,
            borderRadius: "12px",
            boxShadow: `0 24px 60px rgba(0,0,0,0.45), 0 0 48px ${alpha(accent, 0.18)}`,
            display: "block",
            overflow: "hidden",
            width: "100%",
          }}
        />
      </Box>

      <Box sx={{ pb: { md: 1 } }}>
        <Typography
          sx={{
            color: accent,
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </Typography>
        <Typography
          sx={{
            fontFamily: HEADING_FONT,
            fontSize: { xs: "2.5rem", md: "3.5rem" },
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 0.98,
            mt: 0.5,
          }}
        >
          {title}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ maxWidth: 480, mt: 1.5 }}
          variant="body2"
        >
          {dek}
        </Typography>

        <Box sx={{ mt: 3.5 }}>
          <Typography
            component="a"
            href={`/media/${item.id}`}
            sx={{
              color: "text.primary",
              display: "block",
              fontFamily: HEADING_FONT,
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              textDecoration: "none",
              width: "fit-content",
              "&:hover": { color: accent },
            }}
          >
            {item.title}
          </Typography>
          {winnerMeta.length > 0 ? (
            <Typography
              color="text.secondary"
              sx={{ mt: 0.5 }}
              variant="body2"
            >
              {item.year != null ? item.year : null}
              {item.leadCredit ? (
                <>
                  {item.year != null ? " · " : null}
                  {creditLabel(item.mediaType, item.leadCredit.role)}{" "}
                  {item.leadCredit.name}
                </>
              ) : null}
              {" · "}
              <Box
                component="span"
                sx={{ color: ACCENTS.teal, fontWeight: 600 }}
              >
                {item.score.toFixed(1)}
              </Box>
            </Typography>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
