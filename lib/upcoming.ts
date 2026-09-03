export type UpcomingDatedItem = {
  title: string;
  releaseDate?: Date | string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** How far back the "Just Released" view looks. */
export const RECENTLY_RELEASED_WINDOW_DAYS = 90;

/**
 * Inclusive lower bound for the "Just Released" window: items whose release
 * date falls between this and today (exclusive) count as recently released.
 */
export function recentlyReleasedSince(
  now = new Date(),
  windowDays = RECENTLY_RELEASED_WINDOW_DAYS,
) {
  // Calendar-date math (not `DAY_MS`) so the result lands on local midnight
  // even when the window spans a daylight-saving transition.
  const today = startOfToday(now);
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - windowDays,
  );
}

export function daysFromToday(date: Date | string, now = new Date()) {
  const today = startOfToday(now);
  const target = startOfToday(new Date(date));

  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

export function formatUpcomingRelativeLabel(
  date: Date | string,
  now = new Date(),
) {
  const dayDelta = daysFromToday(date, now);
  const absDays = Math.abs(dayDelta);

  if (dayDelta === 0) {
    return "Today";
  }

  if (dayDelta === 1) {
    return "Tomorrow";
  }

  if (dayDelta === -1) {
    return "Yesterday";
  }

  if (dayDelta > 0) {
    return `In ${dayDelta} days`;
  }

  return `${absDays} days ago`;
}

/** How far ahead the dashboard's upcoming panel plots releases. */
export const UPCOMING_HORIZON_DAYS = 90;

/**
 * Design-space size (px) for the Release Radar plot. All ring/point math
 * below is expressed in this coordinate system; the component renders it
 * responsively by expressing every offset as a percentage of the container's
 * actual width/height, which stays proportional to this box as long as the
 * container's CSS `aspect-ratio` is pinned to `RADAR_WIDTH / RADAR_HEIGHT` —
 * that's what keeps the rings circular instead of squashed into ellipses.
 *
 * The ratio (1.4:1) is taller than the sonar-style mockup this is based on:
 * the mockup was a full-width standalone card, but this plot shares a row
 * with Featured Collections at roughly half width, so it needs the extra
 * height to land near that panel's natural size instead of rendering as a
 * short banner.
 */
export const RADAR_WIDTH = 700;
export const RADAR_HEIGHT = 500;

/** Where "tonight" sits. Releases radiate outward from here. */
export const RADAR_ORIGIN = { x: 30, y: 470 };

/** Minimum clearance (design px) kept between a plotted point and the top edge. */
export const RADAR_TOP_PADDING = 30;

/**
 * How close to the origin the soonest release sits. Also keeps releases clear
 * of the glowing "tonight" marker and its label.
 */
const RADAR_ORIGIN_CLEARANCE = 60;

/**
 * Outer edge — the 90-day ring.
 *
 * Deliberately larger than the plot's usable height (470 − 30 = 440), so the
 * outermost ring runs off the top of the box and meets the *right* edge
 * instead. That widening is what gives the far band the full plot width to
 * spread across rather than a cramped corner; the trade is a narrower angular
 * wedge out there, which {@link maxAngleForRadius} already enforces so points
 * still clear the top padding.
 */
const RADAR_OUTER_RADIUS = 660;

/**
 * Blip diameter (design px) by band, nearest first.
 *
 * Distance from the origin already encodes "how soon" — size doubles down on
 * it, so the releases worth looking at first are the largest marks and the
 * 90-day band recedes. Index-aligned with {@link RADAR_RINGS}.
 */
export const RADAR_BLIP_SIZES = [48, 40, 32];

/** Diameter (design px) of the blip for a release `days` out. */
export function radarBlipSize(days: number): number {
  const band = RADAR_RINGS.findIndex((ring) => days <= ring.days);
  return RADAR_BLIP_SIZES[band === -1 ? RADAR_BLIP_SIZES.length - 1 : band];
}

/**
 * Air (design px) the search tries to leave between two blips.
 *
 * Generous, because angle carries no meaning on this plot — only distance
 * does — so there is no cost to spreading marks out and a real cost to
 * packing them: a blip's caption is drawn beside it on hover, and neighbours
 * sitting a few px away end up under each other's captions, which makes them
 * awkward to point at. Spending the free axis on breathing room is the whole
 * reason it's free.
 */
export const RADAR_BLIP_PADDING = 26;

/**
 * How far a blip may drift outward past its band's ring when the arc is full,
 * and the step it drifts in. Kept small on purpose: a blip that wandered far
 * enough to cross the next ring would read as the wrong band.
 */
const RADAR_MAX_BUMP = 18;
const RADAR_BUMP_STEP = 6;

/** Keep a blip's box inside the plot. The bottom limit also clears the ring
 * day labels and the "TONIGHT" caption along the baseline. */
const RADAR_EDGE_PADDING = 6;
const RADAR_BOTTOM_LIMIT = RADAR_HEIGHT - 44;

/** Clearance score for a placement that falls outside the plot. Finite, not
 * `-Infinity`, so the search can still rank hopeless candidates against each
 * other and pick the least bad one. */
const RADAR_OFF_PLOT_CLEARANCE = -999;

/** Angular search when a seed angle collides: ±(steps × step size). */
const RADAR_PLACEMENT_STEP_DEG = 2;
const RADAR_PLACEMENT_STEPS = 45;

/**
 * Distance from {@link RADAR_ORIGIN} for a release `days` out.
 *
 * **Equal-area**, not linear in time: `r = √(r₀² + t·(r₁² − r₀²))`. A linear
 * mapping spreads days evenly along the *radius*, but the room available to
 * separate points grows with the radius — so near-term releases, which are
 * both the most numerous and the most worth reading, got squeezed into the
 * short arcs near the origin while the outer half of the plot sat empty.
 * Equal-area gives every stretch of time the same *area* to occupy, which
 * pushes the near-term band outward into usable space. The 30/60/90-day
 * rings still mark exact boundaries, so the time scale stays readable.
 */
export function radarRadiusForDays(
  days: number,
  horizonDays = UPCOMING_HORIZON_DAYS,
): number {
  const t = Math.min(1, Math.max(0, days / horizonDays));
  const inner = RADAR_ORIGIN_CLEARANCE ** 2;
  return Math.sqrt(inner + t * (RADAR_OUTER_RADIUS ** 2 - inner));
}

/** Ring radii (design px) for the 30/60/90-day markers. Equal-area, so the
 * rings bunch toward the outer edge — each band covers the same area. */
export const RADAR_RINGS = [30, 60, 90].map((days) => ({
  days,
  radius: radarRadiusForDays(days),
}));

/**
 * Where the nth date group is aimed, as a fraction of the usable arc.
 *
 * The golden ratio's fractional part, taken modulo 1 — the standard
 * low-discrepancy sequence. Its point here is that *consecutive* terms land
 * far apart, and consecutive date groups are exactly the pairs that need it:
 * their radii differ by only a few px, so angle is the only thing keeping
 * them off each other.
 *
 * This replaced hashing each date independently. A hash is stable but not
 * *spread* — nothing stops three neighbouring dates hashing into the same
 * corner, and with marks this size that read as one clump while most of the
 * arc sat empty. Indexing by position keeps the layout deterministic across
 * renders and across server/client hydration, without `Math.random`.
 */
const GOLDEN_RATIO_CONJUGATE = 0.618033988749895;

function seedFraction(groupIndex: number): number {
  return (groupIndex * GOLDEN_RATIO_CONJUGATE) % 1;
}

/** Floor is set so even an innermost point clears the "TONIGHT" label that
 * sits to the right of the origin; ceiling keeps points off the left edge. */
const RADAR_MIN_ANGLE_DEG = 12;
const RADAR_MAX_ANGLE_DEG = 82;

export type RadarDatedItem = UpcomingDatedItem & { id: string };

/** One release, placed. */
export type RadarPoint<T> = {
  item: T;
  /** Centre of the blip, in design-space px — see {@link RADAR_WIDTH}. */
  x: number;
  y: number;
  /** Days until release. Same-date releases share this exactly. */
  days: number;
  /** Blip diameter in design-space px — see {@link radarBlipSize}. */
  size: number;
};

/**
 * Largest angle (deg) a point at `radius` can take without crossing
 * {@link RADAR_TOP_PADDING}. The `asin` solves `origin.y - r·sin(θ) = padding`
 * for θ; the ceiling keeps points off the plot's left edge too.
 */
function maxAngleForRadius(radius: number): number {
  if (radius <= 0) return RADAR_MAX_ANGLE_DEG;
  const reach = (RADAR_ORIGIN.y - RADAR_TOP_PADDING) / radius;
  const geometricMax = (Math.asin(Math.min(1, reach)) * 180) / Math.PI;
  return Math.min(RADAR_MAX_ANGLE_DEG, geometricMax);
}

/**
 * Angular separation (deg) that puts two points at `radius` exactly
 * `separation` apart, from the chord formula `chord = 2·r·sin(Δ/2)`.
 */
function requiredGapDeg(radius: number, separation: number): number {
  if (radius <= 0) return 0;
  const halfChord = Math.min(1, separation / (2 * radius));
  return (2 * Math.asin(halfChord) * 180) / Math.PI;
}

/**
 * Centre-to-centre distance to reserve on the arc for two adjacent blips of
 * diameter `size`.
 *
 * The blips collide as *boxes* (below), so the worst case is corner-to-corner
 * — the box diagonal. Reserving the full diagonal over-books the arc though,
 * because the marks are drawn as circles and two circles side by side never
 * meet at their boxes' corners; 80% of it plus the padding is the amount that
 * actually keeps them apart without pushing half the band off the ring.
 */
function blipSeparation(size: number): number {
  return Math.hypot(size, size) * 0.8 + RADAR_BLIP_PADDING;
}

/**
 * Gap (design px) between two axis-aligned square blips — negative once they
 * overlap. Chebyshev rather than Euclidean: two boxes are clear as soon as
 * they are separated on *either* axis, which is exactly the condition that
 * matters for tiles laid out on an arc.
 */
function boxGap(
  a: { x: number; y: number; size: number },
  x: number,
  y: number,
  size: number,
): number {
  const half = (a.size + size) / 2;
  return Math.max(Math.abs(a.x - x) - half, Math.abs(a.y - y) - half);
}

/**
 * Lays releases out radially around "tonight": distance from the origin tracks
 * days-until-release (see {@link radarRadiusForDays}). Angle carries no
 * meaning at all — it is a free axis, spent entirely on keeping marks apart —
 * so dates are aimed around the arc by {@link seedFraction}, which spreads
 * them deterministically instead of leaving placement to chance.
 *
 * Aiming alone isn't enough. Releases sharing a date share a radius *exactly*,
 * so their only separation is angular. Left unchecked that draws marks on top
 * of one another (four movies sharing a date rendered as a single smudge).
 * Placing them one at a time and nudging on collision doesn't fix it either:
 * first-fit fragments the arc, so the last item of a group finds no gap even
 * when the ring has room for all of them.
 *
 * So same-date releases are placed as a group: the arc they need is measured up
 * front and laid out evenly, centred on the group's seed angle (shifted inward
 * if that would overflow the usable range, compressed if the ring is genuinely
 * saturated). Each point then walks outward from that seed until it clears
 * everything already placed, resolving the residual collisions between
 * *adjacent* dates, whose radii are only a pixel or two apart.
 *
 * Marks are poster blips, not dots, so they take real area: each is a
 * {@link radarBlipSize} square that must clear its neighbours *and* the plot's
 * edges. When no angle on the ring works, the blip drifts outward in
 * {@link RADAR_BUMP_STEP} steps and the whole angular sweep is retried from the
 * wider ring, which has more arc to spend. If nothing ever comes clear the
 * best-scoring candidate is accepted rather than dropping the release.
 *
 * Items without a release date, or outside the horizon, are dropped.
 */
export function layoutReleaseRadar<T extends RadarDatedItem>(
  items: T[],
  now = new Date(),
  horizonDays = UPCOMING_HORIZON_DAYS,
): Array<RadarPoint<T>> {
  // Seed angle first, then ±2°, ±4°, … out to the ends of the range.
  const offsetsDeg = [0];
  for (let step = 1; step <= RADAR_PLACEMENT_STEPS; step++) {
    offsetsDeg.push(step * RADAR_PLACEMENT_STEP_DEG);
    offsetsDeg.push(-step * RADAR_PLACEMENT_STEP_DEG);
  }

  // Date-sorted, so same-day releases are already adjacent.
  const dated = sortUpcomingItems(items).flatMap((item) => {
    if (!item.releaseDate) return [];
    const days = daysFromToday(item.releaseDate, now);
    if (!(days >= 0 && days <= horizonDays)) return [];
    return [{ days, item }];
  });

  const placed: Array<RadarPoint<T>> = [];
  /** Counts date groups, not items — a date is aimed as a unit. */
  let groupIndex = 0;

  /** How much air a blip centred here would have. Off-plot placements score
   * {@link RADAR_OFF_PLOT_CLEARANCE} so they lose to anything that fits. */
  function clearanceAt(x: number, y: number, size: number): number {
    let gap = Infinity;
    for (const other of placed) {
      gap = Math.min(gap, boxGap(other, x, y, size));
    }
    const half = size / 2;
    const inside =
      y + half <= RADAR_BOTTOM_LIMIT &&
      y - half >= RADAR_EDGE_PADDING &&
      x - half >= RADAR_EDGE_PADDING &&
      x + half <= RADAR_WIDTH - RADAR_EDGE_PADDING;
    return inside ? gap : Math.min(gap, RADAR_OFF_PLOT_CLEARANCE);
  }

  for (let start = 0; start < dated.length; ) {
    let end = start + 1;
    while (end < dated.length && dated[end].days === dated[start].days) end++;
    const group = dated.slice(start, end);
    start = end;

    const seedAt = seedFraction(groupIndex++);
    const { days } = group[0];
    const size = radarBlipSize(days);
    const separation = blipSeparation(size);
    const ringRadius = radarRadiusForDays(days, horizonDays);

    group.forEach(({ item }, index) => {
      let bestX = RADAR_ORIGIN.x;
      let bestY = RADAR_ORIGIN.y;
      let bestClearance = -Infinity;

      search: for (
        let bump = 0;
        bump <= RADAR_MAX_BUMP;
        bump += RADAR_BUMP_STEP
      ) {
        const radius = ringRadius + bump;
        const maxAngleDeg = maxAngleForRadius(radius);
        const minAngleDeg = Math.min(RADAR_MIN_ANGLE_DEG, maxAngleDeg);
        const spanDeg = maxAngleDeg - minAngleDeg;

        // Lay the group out evenly, centred on the group's seed angle. When the arc
        // can't hold them all at full separation, spread across the whole span
        // and accept the crowding — better than piling them on one spot.
        const idealGapDeg = requiredGapDeg(radius, separation);
        const fits = idealGapDeg * (group.length - 1) <= spanDeg;
        const gapDeg =
          fits || group.length < 2 ? idealGapDeg : spanDeg / (group.length - 1);
        const groupSpanDeg = gapDeg * (group.length - 1);
        const centreDeg = minAngleDeg + seedAt * spanDeg;
        const seedDeg =
          Math.min(
            maxAngleDeg - groupSpanDeg,
            Math.max(minAngleDeg, centreDeg - groupSpanDeg / 2),
          ) +
          index * gapDeg;

        for (const offsetDeg of offsetsDeg) {
          const angleDeg = Math.min(
            maxAngleDeg,
            Math.max(minAngleDeg, seedDeg + offsetDeg),
          );
          const angleRad = (angleDeg * Math.PI) / 180;
          const x = RADAR_ORIGIN.x + radius * Math.cos(angleRad);
          const y = RADAR_ORIGIN.y - radius * Math.sin(angleRad);

          const clearance = clearanceAt(x, y, size);
          if (clearance > bestClearance) {
            bestClearance = clearance;
            bestX = x;
            bestY = y;
          }
          if (clearance >= RADAR_BLIP_PADDING) break search;
        }
      }

      placed.push({ item, x: bestX, y: bestY, days, size });
    });
  }

  return placed;
}

export function sortUpcomingItems<T extends UpcomingDatedItem>(items: T[]) {
  return [...items].sort((a, b) => {
    const dateCompare =
      new Date(a.releaseDate ?? 0).getTime() -
      new Date(b.releaseDate ?? 0).getTime();

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return a.title.localeCompare(b.title);
  });
}
