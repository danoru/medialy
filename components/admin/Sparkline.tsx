import { Box } from "@mui/material";

type SparklinePoint = { date: string; count: number };

export function Sparkline({
  data,
  color = "primary.main",
  height = 48,
  width = 240,
}: {
  data: SparklinePoint[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data
    .map((d, i) => {
      const x = i * stepX;
      const y = height - (d.count / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPath = `M0,${height} L${points
    .split(" ")
    .join(" L")} L${(width).toFixed(1)},${height} Z`;

  return (
    <Box
      aria-hidden
      sx={{
        color,
        display: "block",
        height,
        width: "100%",
      }}
    >
      <svg
        height={height}
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
      >
        <path d={areaPath} fill="currentColor" opacity={0.12} />
        <polyline
          fill="none"
          points={points}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
        />
      </svg>
    </Box>
  );
}
