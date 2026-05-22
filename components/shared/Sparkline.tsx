import { Box } from "@mui/material";
import { ACCENTS } from "@/lib/media-ui-helpers";

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  /** Optional baseline value drawn as a dashed reference line (e.g. 1000). */
  baseline?: number;
  ariaLabel?: string;
};

/**
 * Dependency-free SVG sparkline. Renders a single polyline with an optional
 * baseline reference. Used for Elo score timelines on the media detail page
 * and for any small "value over time" callout.
 */
export function Sparkline({
  values,
  width = 160,
  height = 36,
  stroke = ACCENTS.lavender,
  fill,
  baseline,
  ariaLabel,
}: SparklineProps) {
  if (values.length === 0) return null;
  if (values.length === 1) {
    // Render a single point so the user sees *something*.
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel ?? "Sparkline (one data point)"}
      >
        <circle cx={width / 2} cy={height / 2} r={3} fill={stroke} />
      </svg>
    );
  }

  const min = Math.min(...values, baseline ?? Infinity);
  const max = Math.max(...values, baseline ?? -Infinity);
  const range = max - min || 1;

  const xStep = width / (values.length - 1);
  const points = values
    .map((value, index) => {
      const x = index * xStep;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const baselineY =
    baseline != null
      ? height - ((baseline - min) / range) * height
      : null;

  return (
    <Box
      component="svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? "Score sparkline"}
      sx={{ display: "block" }}
    >
      {baselineY != null && (
        <line
          x1={0}
          x2={width}
          y1={baselineY}
          y2={baselineY}
          stroke="rgba(255,255,255,0.25)"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
      )}
      {fill && (
        <polygon
          fill={fill}
          points={`0,${height} ${points} ${width},${height}`}
        />
      )}
      <polyline
        fill="none"
        points={points}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
      />
    </Box>
  );
}
