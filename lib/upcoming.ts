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

/** Outer edge — lands exactly {@link RADAR_TOP_PADDING} from the plot's top. */
const RADAR_OUTER_RADIUS = 440;

/**
 * Minimum gap (design px) enforced between any two plotted marks — comfortably
 * more than the largest dot, so neighbours read as separate marks with clear
 * space between them rather than a blob.
 */
export const RADAR_MIN_SEPARATION = 34;

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
 * Deterministic pseudo-random unit value from a string (FNV-1a 32-bit) —
 * stable across renders, and across server/client hydration, so a release
 * always lands in the same spot without needing `Math.random`.
 */
function hashUnit(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
}

/** Floor is set so even an innermost point clears the "TONIGHT" label that
 * sits to the right of the origin; ceiling keeps points off the left edge. */
const RADAR_MIN_ANGLE_DEG = 12;
const RADAR_MAX_ANGLE_DEG = 82;

export type RadarDatedItem = UpcomingDatedItem & { id: string };

/** One release, placed. */
export type RadarPoint<T> = {
  item: T;
  /** Design-space px — see {@link RADAR_WIDTH}. */
  x: number;
  y: number;
  /** Days until release. Same-date releases share this exactly. */
  days: number;
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
 * {@link RADAR_MIN_SEPARATION} apart, from the chord formula
 * `chord = 2·r·sin(Δ/2)`.
 */
function requiredGapDeg(radius: number): number {
  if (radius <= 0) return 0;
  const halfChord = Math.min(1, RADAR_MIN_SEPARATION / (2 * radius));
  return (2 * Math.asin(halfChord) * 180) / Math.PI;
}

/**
 * Lays releases out radially around "tonight": distance from the origin tracks
 * days-until-release (see {@link radarRadiusForDays}), and angle comes from a
 * stable hash of the release date, so the layout never jitters between renders.
 *
 * Hashing alone isn't enough. Releases sharing a date share a radius *exactly*,
 * so their only separation is angular — and nothing stops two hashing next to
 * each other. Left unchecked that draws dots on top of one another (four movies
 * sharing a date rendered as a single 3px-wide smudge). Placing them one at a
 * time and nudging on collision doesn't fix it either: first-fit fragments the
 * arc, so the last item of a group finds no gap even when the ring has room for
 * all of them.
 *
 * So same-date releases are placed as a group: the arc they need is measured up
 * front and laid out evenly, centred on the date's hashed angle (shifted inward
 * if that would overflow the usable range, compressed if the ring is genuinely
 * saturated). Each point then walks outward from that seed until it clears
 * everything already placed, resolving the residual collisions between
 * *adjacent* dates, whose radii are only a pixel or two apart.
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

  for (let start = 0; start < dated.length; ) {
    let end = start + 1;
    while (end < dated.length && dated[end].days === dated[start].days) end++;
    const group = dated.slice(start, end);
    start = end;

    const { days } = group[0];
    const radius = radarRadiusForDays(days, horizonDays);
    const maxAngleDeg = maxAngleForRadius(radius);
    const minAngleDeg = Math.min(RADAR_MIN_ANGLE_DEG, maxAngleDeg);
    const spanDeg = maxAngleDeg - minAngleDeg;

    // Lay the group out evenly, centred on its hashed angle. When the arc
    // can't hold them all at full separation, spread across the whole span
    // and accept the crowding — better than piling them on one spot.
    const idealGapDeg = requiredGapDeg(radius);
    const fits = idealGapDeg * (group.length - 1) <= spanDeg;
    const gapDeg =
      fits || group.length < 2 ? idealGapDeg : spanDeg / (group.length - 1);
    const groupSpanDeg = gapDeg * (group.length - 1);
    const centreDeg = minAngleDeg + hashUnit(`${days}`) * spanDeg;
    const seedStartDeg = Math.min(
      maxAngleDeg - groupSpanDeg,
      Math.max(minAngleDeg, centreDeg - groupSpanDeg / 2),
    );

    group.forEach(({ item }, index) => {
      const seedDeg = seedStartDeg + index * gapDeg;

      let bestX = RADAR_ORIGIN.x;
      let bestY = RADAR_ORIGIN.y;
      let bestClearance = -Infinity;

      for (const offsetDeg of offsetsDeg) {
        const angleDeg = Math.min(
          maxAngleDeg,
          Math.max(minAngleDeg, seedDeg + offsetDeg),
        );
        const angleRad = (angleDeg * Math.PI) / 180;
        const x = RADAR_ORIGIN.x + radius * Math.cos(angleRad);
        const y = RADAR_ORIGIN.y - radius * Math.sin(angleRad);

        let clearance = Infinity;
        for (const other of placed) {
          clearance = Math.min(clearance, Math.hypot(other.x - x, other.y - y));
        }

        if (clearance > bestClearance) {
          bestClearance = clearance;
          bestX = x;
          bestY = y;
        }
        if (clearance >= RADAR_MIN_SEPARATION) break;
      }

      placed.push({ item, x: bestX, y: bestY, days });
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
