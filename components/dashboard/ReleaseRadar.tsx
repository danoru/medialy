"use client";

import { useMemo } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import Link from "next/link";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

import type { MediaType } from "@prisma/client";

import type { MediaItemDTO } from "@/lib/types";
import {
  layoutReleaseRadar,
  RADAR_HEIGHT,
  RADAR_ORIGIN,
  RADAR_RINGS,
  RADAR_WIDTH,
  type RadarPoint,
} from "@/lib/upcoming";
import { compactDateLabel } from "@/lib/date-labels";
import { formatMediaType } from "@/lib/format";
import { ACCENTS, mediaAccent, posterFallback } from "@/lib/media-ui-helpers";

/**
 * Releases orbit "tonight": distance from the glowing origin dot tracks how
 * soon they're out, angle comes from a stable hash with same-date releases
 * spread apart (see `layoutReleaseRadar` in lib/upcoming.ts).
 *
 * Each mark is the release's own poster, cropped to a circular blip, and the
 * blips shrink with distance — nearness is the plot's entire point, so the
 * releases worth acting on first are also the largest, most legible art. The
 * art identifies the release on its own, so nothing is captioned until it is
 * hovered or focused; every blip links to its detail page.
 *
 * Scoped to the dashboard's selected media type, like Tonight's pick and the
 * Top 10. Plotting all three types at once put ~27 marks in one quarter-disc,
 * which read as a smear rather than a calendar; the "Full calendar" link
 * covers the everything-at-once case.
 */

/** Rendered px between a blip's edge and its hover caption. */
const LABEL_GAP = 10;

/**
 * Caption geometry in design px. Captions are sized in *rendered* px but the
 * plot is laid out in design space, so converting needs the design-per-
 * rendered scale — which changes with the viewport. Assume the narrowest the
 * plot gets while the dashboard is still two-column (~420px, right at the
 * `lg` breakpoint): that's where captions are largest relative to the plot,
 * so it's the worst case.
 */
const LABEL_SCALE = RADAR_WIDTH / 420;
const LABEL_MAX_WIDTH = 160;
/** Rendered px per character at the caption's 13px/650 face. The date line
 * beneath sets the floor for short titles. */
const LABEL_CHAR_WIDTH = 6.6;
const LABEL_MIN_WIDTH = 70;
/** Two lines — title over date — at the faces used below. */
const LABEL_HEIGHT = 34 * LABEL_SCALE;
const LABEL_EDGE_PADDING = 8;

/** Design-px width the caption for `point` will take. Measuring the real
 * title rather than assuming every caption is full width — most are far
 * shorter, and a blanket 160px would reject sides that comfortably fit. */
function labelWidthFor(point: RadarPoint<MediaItemDTO>) {
  return (
    Math.min(
      LABEL_MAX_WIDTH,
      Math.max(LABEL_MIN_WIDTH, point.item.title.length * LABEL_CHAR_WIDTH),
    ) * LABEL_SCALE
  );
}

/**
 * Which side a blip's caption opens on: whichever covers less.
 *
 * A caption reaches three to five blip-widths sideways, far enough to lie
 * across a neighbour even on a well-spread plot. It can't be pointed at (it's
 * `pointer-events: none`) but it can still be *read* over one, so each blip
 * takes the side that obscures less of its neighbours.
 *
 * Scored by overlapped area rather than by counting neighbours hit: the two
 * sides are usually both "one blip", and what separates them is whether that
 * blip is clipped at a corner or sat on squarely. Ties break rightward, and a
 * side that would run off the plot is refused outright.
 */
function captionOpensLeft(
  point: RadarPoint<MediaItemDTO>,
  points: Array<RadarPoint<MediaItemDTO>>,
) {
  const width = labelWidthFor(point);
  const gap = point.size / 2 + LABEL_GAP * LABEL_SCALE;
  const top = point.y - LABEL_HEIGHT / 2;
  const bottom = point.y + LABEL_HEIGHT / 2;

  const covered = (x0: number, x1: number) =>
    points.reduce((area, other) => {
      if (other === point) return area;
      const half = other.size / 2;
      const w = Math.min(x1, other.x + half) - Math.max(x0, other.x - half);
      const h =
        Math.min(bottom, other.y + half) - Math.max(top, other.y - half);
      return area + Math.max(0, w) * Math.max(0, h);
    }, 0);

  const rightStart = point.x + gap;
  const leftEnd = point.x - gap;
  const offPlot = Infinity;

  const right =
    rightStart + width > RADAR_WIDTH - LABEL_EDGE_PADDING
      ? offPlot
      : covered(rightStart, rightStart + width);
  const left =
    leftEnd - width < LABEL_EDGE_PADDING
      ? offPlot
      : covered(leftEnd - width, leftEnd);

  return left < right;
}

// Ring stroke and day-label fade with distance, so the 30-day boundary reads
// as "current" and the 90-day edge recedes rather than competing for
// attention. Index-aligned with `RADAR_RINGS`.
const RING_STROKE_OPACITY = [0.22, 0.13, 0.07];
const RING_LABEL_OPACITY = [0.45, 0.32, 0.22];

/** Day labels sit just inside their ring's rightmost point, clamped so the
 * 90-day one — whose ring now runs past the plot's right edge — stays on the
 * plot instead of being clipped in half. */
const RING_LABEL_INSET = 14;
const RING_LABEL_MAX_X = RADAR_WIDTH - 40;

/** Radar geometry is authored in design-space px (see lib/upcoming.ts) and
 * rendered as percentages of the container, which stays proportional to that
 * design space as long as the container's aspect-ratio is pinned to match —
 * that's what keeps the rings circles instead of ellipses at any width. */
function pctX(px: number) {
  return `${(px / RADAR_WIDTH) * 100}%`;
}
function pctY(px: number) {
  return `${(px / RADAR_HEIGHT) * 100}%`;
}

export function ReleaseRadar({
  items,
  mediaType,
}: {
  items: MediaItemDTO[];
  mediaType: MediaType;
}) {
  const points = useMemo(() => layoutReleaseRadar(items), [items]);
  const accent = mediaAccent(mediaType);

  // Tally per ring band. Fills the empty upper-right — inherent to a
  // quarter-disc radar — with the density read the plot can't state outright.
  const bands = useMemo(
    () =>
      RADAR_RINGS.map((ring, i) => {
        // Exclusive lower bound: -1 for the first band so day 0 counts.
        const from = i === 0 ? -1 : RADAR_RINGS[i - 1].days;
        return {
          days: ring.days,
          label: `${Math.max(from, 0)}–${ring.days}D`,
          count: points.filter(
            (point) => point.days > from && point.days <= ring.days,
          ).length,
        };
      }),
    [points],
  );

  if (points.length === 0) {
    return (
      <Stack
        spacing={1}
        sx={{
          alignItems: "center",
          bgcolor: "surface.1",
          border: "1px dashed",
          borderColor: "border.default",
          borderRadius: 2,
          color: "text.secondary",
          flex: 1,
          justifyContent: "center",
          minHeight: 220,
          py: 3,
        }}
      >
        <CalendarMonthIcon />
        <Typography sx={{ fontSize: "0.875rem" }}>
          {`No upcoming ${formatMediaType(mediaType).toLowerCase()} releases in the next 90 days.`}
        </Typography>
      </Stack>
    );
  }

  return (
    // Deliberately not `flex: 1` here: this box's height must come from
    // `aspectRatio` alone (derived from its rendered width) so the rings
    // stay circles. Letting a flex parent stretch it too would fight the
    // ratio and squash the plot — see RADAR_WIDTH/RADAR_HEIGHT in
    // lib/upcoming.ts for how the ratio itself is tuned to land close to
    // the sibling panel's natural height without needing that stretch.
    <Box
      sx={{
        aspectRatio: `${RADAR_WIDTH} / ${RADAR_HEIGHT}`,
        mt: 0.5,
        position: "relative",
        width: "100%",
      }}
    >
      {/* Clipped background: card chrome, rings, and the tonight glow. Kept
          separate from the interactive layer below so a blip scaled up near
          an edge can spill past this box's rounded corners instead of being
          hard-clipped mid-poster. */}
      <Box
        aria-hidden
        sx={{
          bgcolor: "surface.1",
          border: "1px solid",
          borderColor: "border.subtle",
          borderRadius: 3,
          inset: 0,
          overflow: "hidden",
          position: "absolute",
        }}
      >
        <Box
          sx={{
            background: `radial-gradient(circle, ${alpha(ACCENTS.peach, 0.1)}, transparent 70%)`,
            borderRadius: "50%",
            height: pctY(RADAR_RINGS[0].radius * 2),
            left: pctX(RADAR_ORIGIN.x - RADAR_RINGS[0].radius),
            position: "absolute",
            top: pctY(RADAR_ORIGIN.y - RADAR_RINGS[0].radius),
            width: pctX(RADAR_RINGS[0].radius * 2),
          }}
        />
        {RADAR_RINGS.map((ring, i) => (
          <Box
            key={ring.days}
            sx={{
              border: "1px solid",
              borderColor: alpha(ACCENTS.peach, RING_STROKE_OPACITY[i]),
              borderRadius: "50%",
              height: pctY(ring.radius * 2),
              left: pctX(RADAR_ORIGIN.x - ring.radius),
              position: "absolute",
              top: pctY(RADAR_ORIGIN.y - ring.radius),
              width: pctX(ring.radius * 2),
            }}
          />
        ))}
        {RADAR_RINGS.map((ring, i) => (
          <Typography
            key={`label-${ring.days}`}
            sx={{
              color: alpha(ACCENTS.peach, RING_LABEL_OPACITY[i]),
              fontSize: "0.625rem",
              fontWeight: 600,
              left: pctX(
                Math.min(
                  RADAR_ORIGIN.x + ring.radius - RING_LABEL_INSET,
                  RING_LABEL_MAX_X,
                ),
              ),
              letterSpacing: "0.06em",
              position: "absolute",
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
              top: pctY(RADAR_ORIGIN.y - 18),
              zIndex: 20,
            }}
          >
            {ring.days}D
          </Typography>
        ))}
        <Box
          sx={{
            bgcolor: "primary.main",
            borderRadius: "50%",
            boxShadow: `0 0 16px ${alpha(ACCENTS.peach, 0.8)}`,
            height: 12,
            left: pctX(RADAR_ORIGIN.x),
            ml: "-6px",
            mt: "-6px",
            position: "absolute",
            top: pctY(RADAR_ORIGIN.y),
            width: 12,
          }}
        />
        <Typography
          sx={{
            color: "primary.main",
            fontSize: "0.625rem",
            fontWeight: 650,
            left: pctX(RADAR_ORIGIN.x + 14),
            letterSpacing: "0.1em",
            position: "absolute",
            top: pctY(RADAR_ORIGIN.y - 5),
          }}
        >
          TONIGHT
        </Typography>
      </Box>

      {/* Unclipped overlay: blips + legend. */}
      <Box sx={{ inset: 0, position: "absolute" }}>
        {points.map((point) => (
          <RadarBlip
            accent={accent}
            key={point.item.id}
            opensLeft={captionOpensLeft(point, points)}
            point={point}
          />
        ))}
        <Stack
          spacing={0.75}
          sx={{
            alignItems: "flex-end",
            position: "absolute",
            right: 14,
            top: 14,
            // Above the blips: the 90-day band now reaches the right edge, so
            // a far-out poster can pass under the legend.
            zIndex: 20,
          }}
        >
          {bands.map((band, i) => (
            <Stack
              direction="row"
              key={band.days}
              sx={{ alignItems: "center", gap: 0.75 }}
            >
              <Typography
                sx={{
                  color: "text.secondary",
                  fontSize: "0.75rem",
                  fontWeight: 550,
                  letterSpacing: "0.04em",
                  textShadow: "0 1px 6px rgba(0,0,0,0.75)",
                }}
              >
                {band.label}
              </Typography>
              <Typography
                sx={{
                  color: band.count > 0 ? "text.primary" : "text.disabled",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  minWidth: 14,
                  textAlign: "right",
                  textShadow: "0 1px 6px rgba(0,0,0,0.75)",
                }}
              >
                {band.count}
              </Typography>
              {/* Fades outward to match the ring it counts. */}
              <Box
                sx={{
                  bgcolor: alpha(accent, RING_LABEL_OPACITY[i]),
                  borderRadius: "50%",
                  height: 8,
                  width: 8,
                }}
              />
            </Stack>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

function RadarBlip({
  accent,
  opensLeft,
  point,
}: {
  accent: string;
  opensLeft: boolean;
  point: RadarPoint<MediaItemDTO>;
}) {
  const { days, item, size, x, y } = point;
  const dateLabel = compactDateLabel(item.releaseDate);

  return (
    <Box
      sx={{
        left: pctX(x),
        position: "absolute",
        top: pctY(y),
        transform: "translate(-50%, -50%)",
        width: pctX(size),
        // Nearer releases sit on top, so a far blip never buries a soon one.
        zIndex: 2 + Math.round((90 - days) / 10),
        "&:hover, &:focus-within": {
          zIndex: 21,
          "& .radar-blip": { transform: "scale(1.35)" },
          "& .radar-caption": { opacity: 1 },
        },
      }}
    >
      <Link
        aria-label={`${item.title} — ${dateLabel}`}
        href={`/media/${item.id}`}
        style={{ display: "block" }}
        title={`${item.title} · ${dateLabel}`}
      >
        <Box
          className="radar-blip"
          sx={{
            aspectRatio: "1",
            backgroundImage: item.posterUrl
              ? `url(${item.posterUrl})`
              : posterFallback(item.mediaType),
            backgroundPosition: "center",
            backgroundSize: "cover",
            border: `2px solid ${alpha(accent, 0.85)}`,
            borderRadius: "50%",
            boxShadow: `0 0 0 3px ${alpha(accent, 0.14)}, 0 0 18px ${alpha(accent, 0.45)}, 0 6px 16px rgba(0,0,0,0.6)`,
            overflow: "hidden",
            position: "relative",
            transition: "transform 160ms ease",
          }}
        >
          {/* Inner vignette: darkens the crop's rim so the art reads as a
              disc rather than a flat swatch, and keeps a light poster from
              washing out its own accent ring. */}
          <Box
            sx={{
              borderRadius: "50%",
              boxShadow: "inset 0 0 14px rgba(8,8,11,0.7)",
              inset: 0,
              position: "absolute",
            }}
          />
        </Box>
      </Link>
      <Box
        aria-hidden
        className="radar-caption"
        sx={{
          opacity: 0,
          // Never intercept the pointer: a caption reaches across its
          // neighbours, and one lying over another blip must not stop that
          // blip being hovered or clicked.
          pointerEvents: "none",
          position: "absolute",
          textAlign: opensLeft ? "right" : "left",
          top: "50%",
          transform: "translateY(-50%)",
          transition: "opacity 140ms ease",
          whiteSpace: "nowrap",
          ...(opensLeft
            ? { right: `calc(100% + ${LABEL_GAP}px)` }
            : { left: `calc(100% + ${LABEL_GAP}px)` }),
        }}
      >
        <Typography
          sx={{
            color: "#fff",
            fontSize: "0.8125rem",
            fontWeight: 650,
            lineHeight: 1.2,
            textShadow: "0 1px 6px rgba(0,0,0,0.75)",
          }}
        >
          {item.title}
        </Typography>
        <Typography
          sx={{
            color: "rgba(255,255,255,0.55)",
            fontSize: "0.6875rem",
            mt: "2px",
            textShadow: "0 1px 6px rgba(0,0,0,0.75)",
          }}
        >
          {dateLabel} · {days}d
        </Typography>
      </Box>
    </Box>
  );
}
