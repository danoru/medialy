"use client";

import { useMemo } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

import type { MediaType } from "@prisma/client";

import type { MediaItemDTO } from "@/lib/types";
import {
  formatUpcomingRelativeLabel,
  layoutReleaseRadar,
  RADAR_HEIGHT,
  RADAR_ORIGIN,
  RADAR_RINGS,
  RADAR_WIDTH,
  type RadarPoint,
} from "@/lib/upcoming";
import { compactDateLabel } from "@/lib/date-labels";
import { formatMediaType } from "@/lib/format";
import { ACCENTS, mediaAccent } from "@/lib/media-ui-helpers";
import { PosterTile } from "@/components/media/PosterCard";

/**
 * Releases orbit "tonight": distance from the glowing origin dot tracks how
 * soon they're out, angle comes from a stable hash with same-date releases
 * spread apart (see `layoutReleaseRadar` in lib/upcoming.ts). Hovering a dot
 * reveals its poster with the title written over the art, matching the Top 10.
 *
 * Scoped to the dashboard's selected media type, like Tonight's pick and the
 * Top 10. Plotting all three types at once put ~27 marks in one quarter-disc,
 * which read as a smear rather than a calendar; the "Full calendar" link
 * covers the everything-at-once case.
 */

/** Ceiling on persistent captions; the rest are bare dots that reveal their
 * poster on hover or focus. Fewer than this may be drawn — see
 * `pickLabeledIds`, which drops captions that would collide. */
const RADAR_LABEL_COUNT = 4;

/**
 * Caption geometry in design px. Captions are sized in *rendered* px but
 * placed in design space, so converting needs the design-per-rendered scale —
 * which changes with the viewport. Assume the narrowest the plot gets while
 * the dashboard is still two-column (~420px, right at the `lg` breakpoint):
 * that's where captions are largest relative to the plot, so it's the worst
 * case for collisions. Guessing too narrow only drops a caption that would
 * have fit; guessing too wide draws one straight through a dot.
 */
const LABEL_SCALE = RADAR_WIDTH / 420;
const LABEL_MAX_WIDTH = 160;
/** Rendered px per character at the caption's 13px/600 face. The date line
 * beneath sets the floor for short titles. */
const LABEL_CHAR_WIDTH = 6.6;
const LABEL_MIN_WIDTH = 70;
const LABEL_HEIGHT = 34 * LABEL_SCALE;
const LABEL_OFFSET_X = 17 * LABEL_SCALE;
const LABEL_OFFSET_Y = -5 * LABEL_SCALE;
/** Keep captions off *other* releases' dots, not just off other captions. */
const LABEL_DOT_CLEARANCE = 7 * LABEL_SCALE;

type LabelBox = { x0: number; y0: number; x1: number; y1: number };

function labelBoxFor(point: RadarPoint<MediaItemDTO>): LabelBox {
  // Measuring the real title rather than assuming every caption is full width
  // — most are far shorter, and a blanket 160px would reject captions that
  // comfortably fit.
  const width =
    Math.min(
      LABEL_MAX_WIDTH,
      Math.max(LABEL_MIN_WIDTH, point.item.title.length * LABEL_CHAR_WIDTH),
    ) * LABEL_SCALE;
  const x0 = point.x + LABEL_OFFSET_X;
  const y0 = point.y + LABEL_OFFSET_Y;
  return { x0, y0, x1: x0 + width, y1: y0 + LABEL_HEIGHT };
}

function boxesOverlap(a: LabelBox, b: LabelBox) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

function boxHitsDot(box: LabelBox, point: RadarPoint<MediaItemDTO>) {
  return (
    point.x > box.x0 - LABEL_DOT_CLEARANCE &&
    point.x < box.x1 + LABEL_DOT_CLEARANCE &&
    point.y > box.y0 - LABEL_DOT_CLEARANCE &&
    point.y < box.y1 + LABEL_DOT_CLEARANCE
  );
}

/**
 * Captions are the densest thing on the plot — a dot is ~11px, its caption is
 * ~200×53 design px — so separating the dots isn't enough on its own.
 *
 * Decided **per date, all-or-nothing**: a date is captioned only if *every*
 * release on it can be, otherwise none of them are. Releases sharing a date
 * are interchangeable here — nothing distinguishes them — so captioning
 * whichever happened to fit would be an arbitrary pick. In practice solo dates
 * get their title and crowded dates stay bare; those still read on hover.
 */
function pickLabeledIds(points: Array<RadarPoint<MediaItemDTO>>): Set<string> {
  const kept: LabelBox[] = [];
  const ids = new Set<string>();

  // Date-sorted by `layoutReleaseRadar`, so same-date runs are contiguous and
  // nearer dates get first claim on the caption budget.
  for (let start = 0; start < points.length; ) {
    let end = start + 1;
    while (end < points.length && points[end].days === points[start].days)
      end++;
    const sameDate = points.slice(start, end);
    start = end;

    if (ids.size + sameDate.length > RADAR_LABEL_COUNT) continue;

    const boxes = sameDate.map(labelBoxFor);
    const allFit = boxes.every((box, i) => {
      if (box.x1 > RADAR_WIDTH || box.y0 < 0 || box.y1 > RADAR_HEIGHT) {
        return false;
      }
      if (kept.some((other) => boxesOverlap(other, box))) return false;
      if (boxes.some((other, j) => j !== i && boxesOverlap(other, box))) {
        return false;
      }
      // Every dot except the one this caption belongs to.
      return !points.some(
        (other) =>
          other.item.id !== sameDate[i].item.id && boxHitsDot(box, other),
      );
    });
    if (!allFit) continue;

    kept.push(...boxes);
    for (const point of sameDate) ids.add(point.item.id);
  }

  return ids;
}

// Ring stroke and day-label fade with distance, so the 30-day boundary reads
// as "current" and the 90-day edge recedes rather than competing for
// attention. Index-aligned with `RADAR_RINGS`.
const RING_STROKE_OPACITY = [0.22, 0.13, 0.07];
const RING_LABEL_OPACITY = [0.45, 0.32, 0.22];

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

  const labeledIds = pickLabeledIds(points);

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
        // Makes `cqw` inside resolve against this plot's width, so the hover
        // posters scale with the plot instead of being a fixed pixel size.
        containerType: "inline-size",
        mt: 0.5,
        position: "relative",
        width: "100%",
      }}
    >
      {/* Clipped background: card chrome, rings, and the tonight glow. Kept
          separate from the interactive layer below so hover cards near an
          edge can spill past this box's rounded corners instead of being
          hard-clipped mid-card. */}
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
              left: pctX(RADAR_ORIGIN.x + ring.radius - 8),
              letterSpacing: "0.06em",
              position: "absolute",
              top: pctY(RADAR_ORIGIN.y - 18),
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

      {/* Unclipped overlay: points + legend. */}
      <Box sx={{ inset: 0, position: "absolute" }}>
        {points.map((point) => (
          <RadarPointMarker
            accent={accent}
            isLabeled={labeledIds.has(point.item.id)}
            key={point.item.id}
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

/**
 * Hover poster width, in container-query units so it scales with the plot
 * rather than being a fixed pixel size. That keeps it a constant fraction of
 * the plot at every viewport, which is what lets the anchor maths below be
 * stated once: at 18cqw the poster is ~38% of the plot's height, so there is
 * always a side of any dot with room for it. A fixed px width can't promise
 * that — it overflowed the top by 45px on a narrow column.
 */
const HOVER_POSTER_WIDTH = "18cqw";

/**
 * Above this fraction of the plot height, a dot opens its poster upward;
 * below it, downward. Safe in both directions given the width above.
 */
const HOVER_FLIP_AT = 0.5;

function RadarPointMarker({
  accent,
  isLabeled,
  point,
}: {
  accent: string;
  isLabeled: boolean;
  point: RadarPoint<MediaItemDTO>;
}) {
  const { days, item, x, y } = point;
  const size = isLabeled ? 11 : 8;
  // Flip the hover poster toward the open side of the plot so it doesn't run
  // past the panel edge — left third opens rightward, top third opens down.
  const anchorLeft = x < RADAR_WIDTH * 0.3;
  const anchorBelow = y < RADAR_HEIGHT * HOVER_FLIP_AT;
  const dateLabel = compactDateLabel(item.releaseDate);
  const relativeLabel = item.releaseDate
    ? formatUpcomingRelativeLabel(item.releaseDate)
    : null;

  return (
    <Box
      sx={{
        left: pctX(x),
        ml: `${-size / 2}px`,
        mt: `${-size / 2}px`,
        position: "absolute",
        top: pctY(y),
        zIndex: 2,
        // `focus-within` covers keyboard users: tabbing to the poster link
        // inside the (visually hidden) tile reveals it.
        "&:hover, &:focus-within": { zIndex: 6 },
        "&:hover .radar-dot, &:focus-within .radar-dot": {
          transform: "scale(1.3)",
        },
        "&:hover .radar-card, &:focus-within .radar-card": {
          opacity: 1,
          pointerEvents: "auto",
        },
      }}
    >
      <Box
        className="radar-dot"
        sx={{
          bgcolor: accent,
          borderRadius: "50%",
          boxShadow: `0 0 ${isLabeled ? 10 : 6}px ${alpha(accent, 0.65)}`,
          height: size,
          transition: "transform 160ms ease",
          width: size,
        }}
      />
      {isLabeled ? (
        <Box
          aria-hidden
          sx={{
            left: size + 6,
            position: "absolute",
            top: -3,
            whiteSpace: "nowrap",
          }}
        >
          <Typography
            noWrap
            sx={{
              color: "#fff",
              fontSize: "0.8125rem",
              fontWeight: 650,
              lineHeight: 1.2,
              maxWidth: 160,
              textShadow: "0 1px 6px rgba(0,0,0,0.75)",
            }}
          >
            {item.title}
          </Typography>
          <Typography
            sx={{
              color: "rgba(255,255,255,0.55)",
              fontSize: "0.6875rem",
              letterSpacing: "0.02em",
              mt: "1px",
              textShadow: "0 1px 6px rgba(0,0,0,0.75)",
            }}
          >
            {dateLabel} · {days}d
          </Typography>
        </Box>
      ) : null}
      {/* Bare poster — no card chrome around it. Same `PosterTile` the Top 10
          uses, so the artwork carries the title and meta itself; the only
          addition is a drop shadow to lift it off the plot. */}
      <Box
        className="radar-card"
        sx={{
          filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.7))",
          opacity: 0,
          pointerEvents: "none",
          position: "absolute",
          transition: "opacity 140ms ease",
          width: HOVER_POSTER_WIDTH,
          zIndex: 7,
          ...(anchorLeft ? { left: -4 } : { right: -4 }),
          ...(anchorBelow
            ? { top: size + (isLabeled ? 32 : 10) }
            : { bottom: size + (isLabeled ? 32 : 10) }),
        }}
      >
        <PosterTile
          item={item}
          meta={[dateLabel, relativeLabel].filter((v): v is string =>
            Boolean(v),
          )}
        />
      </Box>
    </Box>
  );
}
