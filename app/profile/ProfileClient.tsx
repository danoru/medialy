"use client";

import { Avatar, Box, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import BookmarkIcon from "@mui/icons-material/BookmarkBorder";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import VerifiedIcon from "@mui/icons-material/VerifiedUser";
import Grid from "@mui/material/Grid";
import Link from "next/link";
import {
  CompactStatCard,
  DashboardSection,
} from "@/components/cinematic/CinematicPrimitives";
import { formatMediaType } from "@/lib/format";
import { ACCENTS, mediaAccent } from "@/lib/media-ui-helpers";
import type { ProfileData } from "@/lib/db/profile";

const PANEL_ACCENTS = [
  ACCENTS.pink,
  ACCENTS.lavender,
  ACCENTS.teal,
  ACCENTS.yellow,
  ACCENTS.mint,
];

const ACCENT = ACCENTS.pink;

function Donut({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: Array<{ value: number; color: string }>;
  centerValue: string;
  centerLabel: string;
}) {
  const theme = useTheme();
  const size = 132;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const arcs = segments.reduce<
    Array<{ color: string; length: number; offset: number }>
  >((acc, segment) => {
    const length = (segment.value / total) * circ;
    const offset = acc.reduce((sum, a) => sum + a.length, 0);
    return [...acc, { color: segment.color, length, offset }];
  }, []);
  return (
    <Box sx={{ position: "relative", height: size, width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme.palette.border.subtle}
          strokeWidth={stroke}
        />
        {arcs.map((arc, index) => (
          <circle
            key={index}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.length} ${circ - arc.length}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
      </svg>
      <Box
        sx={{
          inset: 0,
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography sx={{ fontSize: "1.5rem", fontWeight: 650, lineHeight: 1 }}>
          {centerValue}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ fontSize: "0.875rem", fontWeight: 600 }}
        >
          {centerLabel}
        </Typography>
      </Box>
    </Box>
  );
}

function Radar({
  axes,
}: {
  axes: Array<{ label: string; value: number }>;
}) {
  const theme = useTheme();
  const size = 200;
  const center = size / 2;
  const maxR = 76;
  const n = axes.length;
  const point = (i: number, r: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  };
  const rings = [0.25, 0.5, 0.75, 1];
  const valuePoints = axes
    .map((axis, i) => point(i, (Math.max(axis.value, 4) / 100) * maxR))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={axes
            .map((_, i) => point(i, ring * maxR))
            .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
            .join(" ")}
          fill="none"
          stroke={theme.palette.border.subtle}
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, maxR);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke={theme.palette.border.subtle}
            strokeWidth={1}
          />
        );
      })}
      <polygon
        points={valuePoints}
        fill={alpha(ACCENT, 0.22)}
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {axes.map((axis, i) => {
        const [x, y] = point(i, maxR + 14);
        return (
          <text
            key={axis.label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={theme.palette.text.secondary}
            fontSize={11}
            fontWeight={600}
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

function Gauge({
  value,
  label,
  color = ACCENT,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  const theme = useTheme();
  const size = 150;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // 270° sweep starting bottom-left
  const start = 135;
  const sweep = 270;
  const polar = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const arc = (fromDeg: number, toDeg: number) => {
    const [x1, y1] = polar(fromDeg);
    const [x2, y2] = polar(toDeg);
    const large = toDeg - fromDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  const valueDeg = start + (sweep * Math.min(Math.max(value, 0), 100)) / 100;
  return (
    <Box sx={{ position: "relative", height: size, width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path
          d={arc(start, start + sweep)}
          fill="none"
          stroke={theme.palette.border.subtle}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {value > 0 && (
          <path
            d={arc(start, valueDeg)}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
      </svg>
      <Box
        sx={{
          inset: 0,
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography sx={{ fontSize: "1.5rem", fontWeight: 650, lineHeight: 1 }}>
          {value}%
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ fontSize: "0.875rem", fontWeight: 600 }}
        >
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

function BarRow({
  label,
  value,
  max,
  suffix,
  color,
}: {
  label: string;
  value: number;
  max: number;
  suffix: string;
  color: string;
}) {
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.4 }}>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ fontSize: "0.875rem", fontWeight: 600 }}
        >
          {suffix}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={max > 0 ? Math.min((value / max) * 100, 100) : 0}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.08),
          "& .MuiLinearProgress-bar": {
            backgroundColor: color,
            borderRadius: 3,
          },
        }}
      />
    </Box>
  );
}

export function ProfileClient({ data }: { data: ProfileData }) {
  const { user, header, tasteRadar } = data;
  const strongestAxis = [...tasteRadar.axes]
    .filter((axis) => axis.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((axis) => axis.label);
  const topGenreMax = Math.max(1, ...data.topGenres.map((g) => g.share));

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="eyebrow" sx={{ display: "block", mb: 0.75 }}>
          Profile
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontFamily: (theme) => theme.typography.h3.fontFamily,
            fontSize: { xs: "1.5rem", md: "1.875rem" },
            fontWeight: 650,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
          }}
        >
          {user.displayName}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
          {user.displayName}&apos;s preferences and personal media context
        </Typography>
      </Box>

      {/* Header */}
      <DashboardSection accent={ACCENT} title="Overview">
        <Grid container spacing={1.25} sx={{ alignItems: "center" }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Avatar
                sx={{
                  bgcolor: (theme) =>
                    alpha(user.avatarColor ?? theme.palette.primary.main, 0.14),
                  border: (theme) =>
                    `1px solid ${alpha(user.avatarColor ?? theme.palette.primary.main, 0.32)}`,
                  color: user.avatarColor ?? "primary.main",
                  fontSize: "1.5rem",
                  fontWeight: 650,
                  height: 72,
                  width: 72,
                }}
              >
                {user.initial}
              </Avatar>
              <Box>
                <Typography sx={{ fontSize: "1.125rem", fontWeight: 600 }}>
                  {user.displayName}
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: "0.875rem" }}
                >
                  Tracking since {header.trackingSince}
                </Typography>
                <Stack
                  direction="row"
                  spacing={0.7}
                  sx={{ alignItems: "center", mt: 0.5 }}
                >
                  <Box
                    sx={{
                      bgcolor: header.libraryFresh
                        ? "success.main"
                        : "warning.main",
                      borderRadius: "50%",
                      height: 7,
                      width: 7,
                    }}
                  />
                  <Typography
                    color="text.secondary"
                    sx={{ fontSize: "0.875rem" }}
                  >
                    {header.libraryFresh
                      ? "Library is in good shape"
                      : "Some titles need more comparisons"}{" "}
                    · updated {header.lastUpdatedLabel}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Grid container spacing={1}>
              {[
                {
                  icon: <LibraryBooksIcon fontSize="small" />,
                  label: "Total items",
                  value: header.stats.totalItems.toLocaleString(),
                  accent: PANEL_ACCENTS[0],
                },
                {
                  icon: <BookmarkIcon fontSize="small" />,
                  label: "Watchlist",
                  value: header.stats.watchlistCount.toLocaleString(),
                  accent: PANEL_ACCENTS[1],
                },
                {
                  icon: <CompareArrowsIcon fontSize="small" />,
                  label: "Comparisons",
                  value: header.stats.comparisonCount.toLocaleString(),
                  accent: PANEL_ACCENTS[2],
                },
                {
                  icon: <VerifiedIcon fontSize="small" />,
                  label: "Confidence",
                  value: `${header.stats.confidence}%`,
                  accent: PANEL_ACCENTS[4],
                },
              ].map((stat) => (
                <Grid key={stat.label} size={{ xs: 6, sm: 3 }}>
                  <CompactStatCard
                    accent={stat.accent}
                    icon={stat.icon}
                    label={stat.label}
                    value={stat.value}
                  />
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </DashboardSection>

      {/* Taste / Mix / Genres / Calibration */}
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <DashboardSection accent={ACCENT} title="Taste Profile">
            {tasteRadar.hasData ? (
              <Stack sx={{ alignItems: "center" }}>
                <Radar axes={tasteRadar.axes} />
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: "0.875rem", mt: 0.5, textAlign: "center" }}
                >
                  {strongestAxis.length
                    ? `You compare most through ${strongestAxis.join(" & ")}.`
                    : "Based on the lenses you compare titles through."}
                </Typography>
              </Stack>
            ) : (
              <EmptyHint text="Compare titles with a context (Story, Visuals…) to map your taste." />
            )}
          </DashboardSection>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <DashboardSection accent={ACCENTS.teal} title="Media Mix">
            {data.mediaMix.length ? (
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <Donut
                  centerLabel="Items"
                  centerValue={header.stats.totalItems.toLocaleString()}
                  segments={data.mediaMix.map((entry) => ({
                    value: entry.count,
                    color: mediaAccent(entry.mediaType),
                  }))}
                />
                <Stack spacing={0.8} sx={{ flex: 1, minWidth: 0 }}>
                  {data.mediaMix.map((entry) => (
                    <Stack
                      key={entry.mediaType}
                      direction="row"
                      spacing={0.8}
                      sx={{ alignItems: "center" }}
                    >
                      <Box
                        sx={{
                          bgcolor: mediaAccent(entry.mediaType),
                          borderRadius: "3px",
                          height: 9,
                          width: 9,
                        }}
                      />
                      <Typography
                        sx={{ flex: 1, fontSize: "0.875rem", fontWeight: 600 }}
                        noWrap
                      >
                        {formatMediaType(entry.mediaType)}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        sx={{ fontSize: "0.875rem", fontWeight: 600 }}
                      >
                        {entry.share}%
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            ) : (
              <EmptyHint text="Add media to see your library mix." />
            )}
          </DashboardSection>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <DashboardSection accent={ACCENTS.yellow} title="Top Genres">
            {data.topGenres.length ? (
              <Stack spacing={1.1} sx={{ justifyContent: "center", flex: 1 }}>
                {data.topGenres.map((genre, index) => (
                  <BarRow
                    key={genre.name}
                    color={PANEL_ACCENTS[index % PANEL_ACCENTS.length]}
                    label={genre.name}
                    max={topGenreMax}
                    suffix={`${genre.share}%`}
                    value={genre.share}
                  />
                ))}
              </Stack>
            ) : (
              <EmptyHint text="Tag media with genres to see what leads your library." />
            )}
          </DashboardSection>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <DashboardSection accent={ACCENT} title="Taste Calibration">
            <Stack sx={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
              <Gauge label="Calibration" value={data.calibration.score} />
              <Typography
                color="text.secondary"
                sx={{
                  fontSize: "0.875rem",
                  mt: 1,
                  textAlign: "center",
                }}
              >
                {data.calibration.copy}
              </Typography>
            </Stack>
          </DashboardSection>
        </Grid>
      </Grid>

      {/* Friend / Coverage / Library status / Recent ratings */}
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <DashboardSection accent={ACCENTS.peach} title="Friend Compatibility">
            {data.topFollow ? (
              <Stack spacing={1} sx={{ flex: 1, justifyContent: "center" }}>
                <Stack direction="row" spacing={1.2} sx={{ alignItems: "center" }}>
                  <Avatar
                    src={data.topFollow.image ?? undefined}
                    sx={{
                      bgcolor: (theme) =>
                        data.topFollow?.avatarColor ??
                        alpha(theme.palette.primary.main, 0.14),
                      color: "primary.main",
                      fontWeight: 600,
                      height: 44,
                      width: 44,
                    }}
                  >
                    {data.topFollow.displayName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                      {data.topFollow.displayName}
                    </Typography>
                    <Typography
                      sx={{
                        color: "success.main",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                      }}
                    >
                      {data.topFollow.compatibilityScore}% match
                    </Typography>
                  </Box>
                </Stack>
                <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                  {data.topFollow.explanation}
                </Typography>
                <Chip
                  component={Link}
                  href={`/u/${data.topFollow.userId}`}
                  clickable
                  label="View profile"
                  size="small"
                  sx={{ alignSelf: "flex-start" }}
                  variant="outlined"
                />
              </Stack>
            ) : (
              <EmptyHint text="Follow other Medialy users to see taste overlap." />
            )}
          </DashboardSection>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <DashboardSection accent={ACCENTS.teal} title="Comparison Coverage">
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center", flex: 1 }}
            >
              <Gauge
                color={ACCENTS.teal}
                label="Covered"
                value={data.comparisonCoverage.percent}
              />
              <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                {data.comparisonCoverage.wellCompared} of{" "}
                {data.comparisonCoverage.eligible} completed titles have enough
                comparisons. More comparisons unlock stronger recommendations.
              </Typography>
            </Stack>
          </DashboardSection>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <DashboardSection accent={ACCENTS.mint} title="Library Status">
            {data.libraryStatus.length ? (
              <Stack spacing={1} sx={{ flex: 1, justifyContent: "center" }}>
                {data.libraryStatus.map((entry, index) => (
                  <BarRow
                    key={entry.label}
                    color={PANEL_ACCENTS[index % PANEL_ACCENTS.length]}
                    label={entry.label}
                    max={Math.max(
                      1,
                      ...data.libraryStatus.map((s) => s.count),
                    )}
                    suffix={`${entry.count} · ${entry.share}%`}
                    value={entry.count}
                  />
                ))}
              </Stack>
            ) : (
              <EmptyHint text="Set statuses on your media to see the breakdown." />
            )}
          </DashboardSection>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <DashboardSection accent={ACCENTS.yellow} title="Recent Ratings">
            {data.recentRatings.length ? (
              <Stack
                direction="row"
                sx={{ flexWrap: "wrap", gap: 1, justifyContent: "center" }}
              >
                {data.recentRatings.map((item) => (
                  <Box
                    key={item.id}
                    component={Link}
                    href={`/media/${item.id}`}
                    sx={{ textDecoration: "none", width: 64 }}
                  >
                    <Box
                      sx={{
                        alignItems: "flex-end",
                        bgcolor: "surface.2",
                        backgroundImage: item.posterUrl
                          ? `url(${item.posterUrl})`
                          : undefined,
                        backgroundPosition: "center",
                        backgroundSize: "cover",
                        border: "1px solid",
                        borderColor: "border.subtle",
                        borderRadius: 1.5,
                        display: "flex",
                        height: 90,
                        overflow: "hidden",
                        width: 64,
                      }}
                    >
                      <Box
                        sx={{
                          alignItems: "center",
                          bgcolor: (theme) =>
                            alpha(theme.palette.common.black, 0.6),
                          color: "#FFFFFF",
                          display: "flex",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          gap: 0.25,
                          px: 0.5,
                          py: 0.25,
                          width: "100%",
                        }}
                      >
                        ★ {item.rating.toFixed(1)}
                      </Box>
                    </Box>
                    <Typography
                      noWrap
                      color="text.secondary"
                      sx={{ fontSize: "0.875rem", mt: 0.25 }}
                    >
                      {item.title}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <EmptyHint text="Rate titles to see your latest scores here." />
            )}
          </DashboardSection>
        </Grid>
      </Grid>

      {/* Signals / Data health */}
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <DashboardSection accent={ACCENT} title="Discovery Signals">
            <Grid container spacing={1}>
              {data.signals.map((signal, index) => (
                <Grid key={signal.key} size={{ xs: 6, sm: 4 }}>
                  <Box
                    sx={{
                      bgcolor: "surface.1",
                      border: "1px solid",
                      borderColor: "border.subtle",
                      borderRadius: 2,
                      height: "100%",
                      p: 1.1,
                    }}
                  >
                    <Typography
                      sx={{
                        color: PANEL_ACCENTS[index % PANEL_ACCENTS.length],
                        fontSize: "1.5rem",
                        fontWeight: 650,
                        lineHeight: 1,
                      }}
                    >
                      {signal.count}
                    </Typography>
                    <Typography
                      sx={{ fontSize: "0.875rem", fontWeight: 600, mt: 0.4 }}
                    >
                      {signal.label}
                    </Typography>
                    <Typography
                      color="text.secondary"
                      sx={{ fontSize: "0.875rem", mt: 0.25 }}
                    >
                      {signal.description}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
            {data.topSignal ? (
              <Typography
                color="text.secondary"
                sx={{ fontSize: "0.875rem", mt: 1 }}
              >
                Your strongest signal right now is{" "}
                <Box
                  component="span"
                  sx={{ color: "primary.main", fontWeight: 600 }}
                >
                  {data.topSignal.label}
                </Box>
                .
              </Typography>
            ) : null}
          </DashboardSection>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <DashboardSection accent={ACCENTS.mint} title="Data Health">
            <Stack
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", flex: 1 }}
            >
              <Gauge
                color={ACCENTS.mint}
                label="Health"
                value={data.dataHealth.score}
              />
              <Stack spacing={0.8} sx={{ flex: 1 }}>
                {data.dataHealth.checklist.map((entry) => (
                  <Stack
                    key={entry.label}
                    direction="row"
                    sx={{ justifyContent: "space-between" }}
                  >
                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
                      {entry.label}
                    </Typography>
                    <Typography
                      sx={{
                        color:
                          entry.coverage >= 70
                            ? "success.main"
                            : entry.coverage >= 45
                              ? "warning.main"
                              : "error.main",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                      }}
                    >
                      {entry.state}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </DashboardSection>
        </Grid>
      </Grid>
    </Stack>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <Box
      sx={{
        alignItems: "center",
        color: "text.secondary",
        display: "flex",
        flex: 1,
        fontSize: "0.875rem",
        justifyContent: "center",
        minHeight: 120,
        px: 2,
        textAlign: "center",
      }}
    >
      {text}
    </Box>
  );
}
