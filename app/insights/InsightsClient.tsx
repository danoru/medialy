"use client";

import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import BarChartIcon from "@mui/icons-material/BarChart";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import StarIcon from "@mui/icons-material/Star";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import {
  Box,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { MediaType } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import type {
  GenreInsight,
  InsightScoreBand,
  InsightStandoutTitle,
  MediaTypeGenreInsights,
} from "@/lib/types";
import {
  ACCENTS,
  mediaAccent,
  mediaTypeIcon,
  posterFallback,
  shortMediaTypeLabel,
} from "@/lib/media-ui-helpers";

type InsightsClientProps = {
  insightsByType: MediaTypeGenreInsights[];
};

const bandColors = [
  ACCENTS.pink,
  ACCENTS.lavender,
  ACCENTS.teal,
  ACCENTS.yellow,
  ACCENTS.mint,
];

export function InsightsClient({ insightsByType }: InsightsClientProps) {
  const [mediaType, setMediaType] =
    useStateWithAvailableMediaType(insightsByType);
  const selected =
    insightsByType.find((entry) => entry.mediaType === mediaType) ??
    insightsByType[0];
  const accent = selected ? mediaAccent(selected.mediaType) : ACCENTS.pink;
  const topGenres =
    selected?.genres.filter((genre) => genre.ratedCount > 0).slice(0, 10) ?? [];
  const lowDataGenres =
    selected?.genres
      .filter((genre) => genre.needsData)
      .sort((first, second) => second.count - first.count)
      .slice(0, 7) ?? [];
  const fingerprintGenres = topGenres.slice(0, 8);

  if (!selected) {
    return (
      <InsightsShell>
        <EmptyPanel
          label="No tracked media yet. Add items to your library and rate them to unlock insights."
          sx={{ minHeight: 260 }}
        />
      </InsightsShell>
    );
  }

  return (
    <InsightsShell>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        sx={{ alignItems: { lg: "flex-end" }, gap: 2 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="eyebrow" sx={{ display: "block", mb: 0.75 }}>
            Insights
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
            Insights
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
            Analyze your media taste across movies, TV, and games.
          </Typography>
        </Box>
        <MediaTypeSelector
          insightsByType={insightsByType}
          onChange={setMediaType}
          value={selected.mediaType}
        />
      </Stack>

      <KpiStrip accent={accent} selected={selected} />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateAreas: {
            xs: `
              "performance"
              "fingerprint"
              "distribution"
              "rising"
              "low"
              "titles"
            `,
            lg: `
              "performance performance fingerprint distribution"
              "rising low titles titles"
            `,
          },
          gridTemplateColumns: {
            xs: "1fr",
            lg: "1fr 1fr minmax(260px, 0.86fr) minmax(260px, 0.86fr)",
          },
        }}
      >
        <InsightsPanel
          accent={accent}
          icon={<BarChartIcon fontSize="small" />}
          sx={{ gridArea: "performance" }}
          title="Genre Performance"
        >
          <GenrePerformance genres={topGenres} accent={accent} />
        </InsightsPanel>

        <InsightsPanel
          accent={ACCENTS.teal}
          icon={<AutoGraphIcon fontSize="small" />}
          sx={{ gridArea: "fingerprint" }}
          title="Taste Fingerprint"
        >
          <TasteFingerprint
            averageScore={selected.averageScore}
            genres={fingerprintGenres}
          />
        </InsightsPanel>

        <InsightsPanel
          accent={ACCENTS.yellow}
          icon={<DonutLargeIcon fontSize="small" />}
          sx={{ gridArea: "distribution" }}
          title="Score Distribution"
        >
          <ScoreDistribution
            averageScore={selected.averageScore}
            bands={selected.scoreBands}
            ratedCount={selected.ratedCount}
          />
        </InsightsPanel>

        <InsightsPanel
          accent={ACCENTS.mint}
          icon={<TrendingUpIcon fontSize="small" />}
          sx={{ gridArea: "rising" }}
          title="Recent Momentum"
        >
          <RisingGenres
            genres={selected.risingGenres}
            fallbackGenres={topGenres.slice(0, 5)}
          />
        </InsightsPanel>

        <InsightsPanel
          accent={ACCENTS.peach}
          icon={<ReportProblemIcon fontSize="small" />}
          sx={{ gridArea: "low" }}
          title="Low Data"
        >
          <LowDataGenres genres={lowDataGenres} />
        </InsightsPanel>

        <InsightsPanel
          accent={ACCENTS.navy}
          icon={<StarIcon fontSize="small" />}
          sx={{ gridArea: "titles" }}
          title="Standout Titles"
        >
          <StandoutTitles titles={selected.standoutTitles} />
        </InsightsPanel>
      </Box>
    </InsightsShell>
  );
}

function useStateWithAvailableMediaType(
  insightsByType: MediaTypeGenreInsights[],
) {
  return useState<MediaType>(insightsByType[0]?.mediaType ?? MediaType.MOVIE);
}

function InsightsShell({ children }: { children: ReactNode }) {
  return (
    <Stack spacing={2.5} sx={{ pb: 1.5 }}>
      {children}
    </Stack>
  );
}

function MediaTypeSelector({
  insightsByType,
  onChange,
  value,
}: {
  insightsByType: MediaTypeGenreInsights[];
  onChange: (value: MediaType) => void;
  value: MediaType;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      onChange={(_, nextValue: MediaType | null) => {
        if (nextValue) onChange(nextValue);
      }}
      size="small"
      sx={{
        bgcolor: "surface.1",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 2,
        display: "grid",
        gap: 0.25,
        gridTemplateColumns: {
          xs: "repeat(3, minmax(0, 1fr))",
          sm: "repeat(3, 148px)",
        },
        p: 0.35,
        width: { xs: "100%", sm: "auto" },
        "& .MuiToggleButton-root": {
          border: 0,
          borderRadius: 1.5,
          color: "text.secondary",
          gap: 0.75,
          minHeight: 36,
          px: 1,
          textTransform: "none",
          "&.Mui-selected": {
            bgcolor: "background.paper",
            boxShadow: (theme) => theme.shadows[1],
            color: "text.primary",
            "&:hover": { bgcolor: "background.paper" },
          },
        },
      }}
      value={value}
    >
      {insightsByType.map((entry) => (
        <ToggleButton key={entry.mediaType} value={entry.mediaType}>
          {mediaTypeIcon(entry.mediaType)}
          {shortMediaTypeLabel(entry.mediaType)}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function KpiStrip({
  accent,
  selected,
}: {
  accent: string;
  selected: MediaTypeGenreInsights;
}) {
  const stats = [
    {
      label: "Rated",
      value: selected.ratedCount.toLocaleString(),
      detail: `${selected.totalCount.toLocaleString()} total`,
    },
    {
      label: "Average",
      value: selected.averageScore > 0 ? selected.averageScore.toFixed(1) : "-",
      detail: "/ 10",
    },
    {
      label: "Coverage",
      value: `${selected.coverage}%`,
      detail: "rated library",
    },
    {
      label: "Completed",
      value: `${selected.completedRatio}%`,
      detail: `${selected.completedCount.toLocaleString()} completed`,
    },
  ];

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 3,
        boxShadow: (theme) => theme.shadows[1],
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
        },
        overflow: "hidden",
      }}
    >
      {stats.map((stat, index) => (
        <Box
          key={stat.label}
          sx={{
            borderLeft: {
              lg:
                index === 0
                  ? 0
                  : (theme) => `1px solid ${theme.palette.border.subtle}`,
            },
            borderTop: {
              xs:
                index > 1
                  ? (theme) => `1px solid ${theme.palette.border.subtle}`
                  : 0,
              lg: 0,
            },
            p: { xs: 1.4, md: 1.7 },
          }}
        >
          <Typography variant="eyebrow" sx={{ display: "block" }}>
            {stat.label}
          </Typography>
          <Typography
            sx={{
              color: "text.primary",
              fontSize: { xs: "1.5rem", md: "1.875rem" },
              fontWeight: 650,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
              mt: 0.55,
            }}
          >
            {stat.value}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ fontSize: "0.875rem", mt: 0.4 }}
          >
            <Box component="span" sx={{ color: accent, fontWeight: 600 }}>
              {stat.detail}
            </Box>
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function InsightsPanel({
  accent,
  children,
  icon,
  sx,
  title,
}: {
  accent: string;
  children: ReactNode;
  icon: ReactNode;
  sx?: SxProps<Theme>;
  title: string;
}) {
  return (
    <Box
      sx={mergeSx(
        {
          bgcolor: "background.paper",
          border: "1px solid",
        borderColor: "border.subtle",
          borderRadius: 3,
          boxShadow: (theme) => theme.shadows[1],
          minHeight: 0,
          overflow: "hidden",
          p: { xs: 1.25, md: 1.5 },
        },
        sx,
      )}
    >
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 1.25 }}>
        <Box sx={{ color: accent, display: "flex" }}>{icon}</Box>
        <Typography sx={{ fontSize: "1rem", fontWeight: 600 }}>
          {title}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}

function GenrePerformance({
  accent,
  genres,
}: {
  accent: string;
  genres: GenreInsight[];
}) {
  if (genres.length === 0) {
    return <EmptyPanel label="No rated genres yet for this media type." />;
  }

  return (
    <Stack spacing={0.65}>
      <Box
        sx={{
          color: "text.secondary",
          display: { xs: "none", sm: "grid" },
          fontSize: "0.875rem",
          fontWeight: 600,
          gridTemplateColumns: "30px minmax(170px, 1fr) 76px 56px",
          px: 0.25,
        }}
      >
        <span />
        <span>Highest Rated Genres</span>
        <span>Confidence</span>
        <span>Sample</span>
      </Box>
      {genres.map((genre, index) => {
        const confidence = confidenceForGenre(genre);
        const barWidth = Math.max(8, Math.min(100, genre.averageScore * 10));

        return (
          <Box
            key={genre.name}
            sx={{
              alignItems: "center",
              display: "grid",
              gap: 0.8,
              gridTemplateColumns: {
                xs: "22px minmax(0, 1fr) 42px",
                sm: "30px minmax(170px, 1fr) 76px 56px",
              },
              minHeight: 31,
            }}
          >
            <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
              {index + 1}.
            </Typography>
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                sx={{ alignItems: "center", gap: 0.8, minWidth: 0 }}
              >
                <Typography
                  noWrap
                  sx={{ fontSize: "0.875rem", fontWeight: 600 }}
                >
                  {genre.name}
                </Typography>
                <Typography
                  sx={{
                    flexShrink: 0,
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  {genre.averageScore.toFixed(1)}
                </Typography>
              </Stack>
              <Box
                sx={{
                  bgcolor: "surface.1",
                  border: "1px solid",
        borderColor: "border.subtle",
                  borderRadius: "999px",
                  height: 9,
                  mt: 0.45,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    bgcolor: accent,
                    borderRadius: "inherit",
                    height: "100%",
                    width: `${barWidth}%`,
                  }}
                />
              </Box>
            </Box>
            <Chip
              label={confidence.label}
              size="small"
              sx={{
                color: confidence.color,
                display: { xs: "none", sm: "inline-flex" },
                justifySelf: "start",
                minWidth: 66,
              }}
              variant="outlined"
            />
            <Typography
              color="text.secondary"
              sx={{ fontSize: "0.875rem", justifySelf: "end" }}
            >
              {genre.ratedCount}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

function TasteFingerprint({
  averageScore,
  genres,
}: {
  averageScore: number;
  genres: GenreInsight[];
}) {
  if (genres.length < 3) {
    return (
      <EmptyPanel label="Rate at least three genres to build a taste fingerprint." />
    );
  }

  const viewBoxSize = 260;
  const center = viewBoxSize / 2;
  const radius = 82;
  const userPoints = radarPoints(
    genres.map((genre) => genre.averageScore * 10),
    center,
    radius,
  );
  const benchmarkPoints = radarPoints(
    genres.map(() => averageScore * 10),
    center,
    radius,
  );

  return (
    <Box sx={{ display: "grid", placeItems: "center" }}>
      <Box
        component="svg"
        role="img"
        sx={{
          color: "text.disabled",
          height: 286,
          maxWidth: "100%",
          width: 286,
        }}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      >
        <title>Taste fingerprint radar chart</title>
        {[0.25, 0.5, 0.75, 1].map((step) => (
          <polygon
            fill="none"
            key={step}
            points={radarPoints(
              genres.map(() => step * 100),
              center,
              radius,
            )}
            stroke="currentColor"
            strokeOpacity={0.16}
            strokeWidth="1"
          />
        ))}
        {genres.map((genre, index) => {
          const [x, y] = radarPoint(index, genres.length, 100, center, radius);
          const [labelX, labelY] = radarPoint(
            index,
            genres.length,
            125,
            center,
            radius,
          );

          return (
            <g key={genre.name}>
              <line
                stroke="currentColor"
                strokeOpacity={0.24}
                strokeWidth="1"
                x1={center}
                x2={x}
                y1={center}
                y2={y}
              />
              <text
                fill="currentColor"
                fontSize="10"
                fontWeight="600"
                textAnchor={
                  labelX < center - 6
                    ? "end"
                    : labelX > center + 6
                      ? "start"
                      : "middle"
                }
                x={labelX}
                y={labelY}
              >
                {genre.name.slice(0, 12)}
              </text>
            </g>
          );
        })}
        <polygon
          fill="currentColor"
          fillOpacity={0.08}
          points={benchmarkPoints}
          stroke="currentColor"
          strokeDasharray="4 4"
          strokeOpacity={0.7}
          strokeWidth="1.5"
        />
        <polygon
          fill={ACCENTS.pink}
          fillOpacity={0.18}
          points={userPoints}
          stroke={ACCENTS.pink}
          strokeWidth="2.5"
        />
      </Box>
      <Stack direction="row" sx={{ gap: 1.4, justifyContent: "center" }}>
        <LegendDot color={ACCENTS.pink} label="You" />
        <LegendDot color="text.disabled" label="Type avg" />
      </Stack>
    </Box>
  );
}

function ScoreDistribution({
  averageScore,
  bands,
  ratedCount,
}: {
  averageScore: number;
  bands: InsightScoreBand[];
  ratedCount: number;
}) {
  const gradient = donutGradient(bands);

  return (
    <Stack spacing={1.5} sx={{ alignItems: "center" }}>
      <Box
        sx={{
          alignItems: "center",
          background: gradient,
          borderRadius: "50%",
          display: "flex",
          height: 172,
          justifyContent: "center",
          width: 172,
        }}
      >
        <Box
          sx={{
            alignItems: "center",
            bgcolor: "background.paper",
            border: "1px solid",
        borderColor: "border.subtle",
            borderRadius: "50%",
            display: "flex",
            flexDirection: "column",
            height: 92,
            justifyContent: "center",
            width: 92,
          }}
        >
          <Typography
            sx={{ fontSize: "1.5rem", fontWeight: 650, lineHeight: 1 }}
          >
            {ratedCount}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
            Rated
          </Typography>
        </Box>
      </Box>
      <Stack spacing={0.65} sx={{ width: "100%" }}>
        {bands.map((band, index) => (
          <Stack
            direction="row"
            key={band.label}
            sx={{ alignItems: "center", gap: 1 }}
          >
            <Box
              sx={{
                bgcolor: bandColors[index],
                borderRadius: "50%",
                height: 9,
                width: 9,
              }}
            />
            <Typography sx={{ flex: 1, fontSize: "0.875rem" }}>
              {band.label}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
              {band.share}%
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Box
        sx={{
          borderTop: "1px solid",
          borderTopColor: "border.subtle",
          display: "flex",
          justifyContent: "space-between",
          pt: 1,
          width: "100%",
        }}
      >
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          Average Score
        </Typography>
        <Typography sx={{ fontWeight: 600 }}>
          {averageScore > 0 ? averageScore.toFixed(1) : "-"} / 10
        </Typography>
      </Box>
    </Stack>
  );
}

function RisingGenres({
  fallbackGenres,
  genres,
}: {
  fallbackGenres: GenreInsight[];
  genres: MediaTypeGenreInsights["risingGenres"];
}) {
  if (genres.length === 0) {
    return (
      <Stack spacing={0.9}>
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          No recent rated movement yet. Current strongest genres:
        </Typography>
        {fallbackGenres.map((genre, index) => (
          <CompactRankRow
            key={genre.name}
            label={genre.name}
            rank={index + 1}
            value={genre.averageScore.toFixed(1)}
          />
        ))}
      </Stack>
    );
  }

  return (
    <Stack spacing={0.9}>
      {genres.map((genre, index) => (
        <CompactRankRow
          delta={genre.momentum}
          key={genre.name}
          label={genre.name}
          rank={index + 1}
          value={`${genre.recentAverageScore.toFixed(1)}`}
        />
      ))}
    </Stack>
  );
}

function LowDataGenres({ genres }: { genres: GenreInsight[] }) {
  if (genres.length === 0) {
    return (
      <EmptyPanel label="Every active genre has enough scoring coverage." />
    );
  }

  return (
    <Stack spacing={0.9}>
      <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
        High-potential genres to rate or complete next.
      </Typography>
      {genres.map((genre, index) => (
        <CompactRankRow
          key={genre.name}
          label={genre.name}
          rank={index + 1}
          value={`${genre.ratedCount}/${genre.count}`}
        />
      ))}
    </Stack>
  );
}

function StandoutTitles({ titles }: { titles: InsightStandoutTitle[] }) {
  if (titles.length === 0) {
    return <EmptyPanel label="No standout titles yet for this media type." />;
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          sm: "repeat(3, minmax(0, 1fr))",
          xl: "repeat(6, minmax(0, 1fr))",
        },
      }}
    >
      {titles.map((title) => (
        <Link
          href={`/media/${title.id}`}
          key={title.id}
          style={{ color: "inherit", textDecoration: "none" }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box
              sx={{
                aspectRatio: "2 / 3",
                backgroundImage: title.posterUrl
                  ? `url(${title.posterUrl})`
                  : posterFallback(title.mediaType),
                backgroundPosition: "center",
                backgroundSize: "cover",
                bgcolor: "surface.2",
                border: "1px solid",
        borderColor: "border.subtle",
                borderRadius: 2,
                mb: 0.65,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <Box
                sx={{
                  background:
                    "linear-gradient(180deg, transparent 46%, rgba(8,8,11,0.92) 100%)",
                  inset: 0,
                  position: "absolute",
                }}
              />
              <Box
                sx={{
                  alignItems: "center",
                  bgcolor: "rgba(8,8,11,0.6)",
                  borderRadius: 1,
                  bottom: 7,
                  color: "#FFFFFF",
                  display: "flex",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  gap: 0.25,
                  left: 7,
                  px: 0.55,
                  py: 0.25,
                  position: "absolute",
                }}
              >
                <StarIcon sx={{ fontSize: 14 }} />
                {title.score.toFixed(1)}
              </Box>
            </Box>
            <Typography noWrap sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
              {title.title}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
              {title.releaseYear ?? "Unknown"}
            </Typography>
          </Box>
        </Link>
      ))}
    </Box>
  );
}

function CompactRankRow({
  delta,
  label,
  rank,
  value,
}: {
  delta?: number;
  label: string;
  rank: number;
  value: string;
}) {
  return (
    <Box
      sx={{
        alignItems: "center",
        borderBottom: "1px solid",
        borderBottomColor: "border.subtle",
        display: "grid",
        gap: 0.8,
        gridTemplateColumns: "24px minmax(0, 1fr) auto",
        minHeight: 32,
        pb: 0.65,
      }}
    >
      <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
        {rank}.
      </Typography>
      <Typography noWrap sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
        {label}
      </Typography>
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.7 }}>
        {typeof delta === "number" ? (
          <Typography
            sx={{
              color: delta >= 0 ? "success.main" : "error.main",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}
          </Typography>
        ) : null}
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          {value}
        </Typography>
      </Stack>
    </Box>
  );
}

function EmptyPanel({ label, sx }: { label: string; sx?: SxProps<Theme> }) {
  return (
    <Box
      sx={mergeSx(
        {
          alignItems: "center",
          bgcolor: "surface.1",
          border: "1px dashed",
          borderColor: "border.default",
          borderRadius: 2,
          color: "text.secondary",
          display: "flex",
          justifyContent: "center",
          minHeight: 140,
          p: 1.5,
          textAlign: "center",
        },
        sx,
      )}
    >
      <Typography sx={{ fontSize: "0.875rem" }}>{label}</Typography>
    </Box>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 0.55 }}>
      <Box sx={{ bgcolor: color, height: 2, width: 16 }} />
      <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
        {label}
      </Typography>
    </Stack>
  );
}

function confidenceForGenre(genre: GenreInsight) {
  if (genre.ratedCount >= 8) {
    return { label: "High", color: "success.main" };
  }
  if (genre.ratedCount >= 3) {
    return { label: "Medium", color: "warning.main" };
  }
  return { label: "Low", color: "error.main" };
}

function donutGradient(bands: InsightScoreBand[]) {
  if (bands.every((band) => band.share === 0)) {
    return "conic-gradient(rgba(127,127,127,0.18) 0% 100%)";
  }

  let cursor = 0;
  const stops = bands.map((band, index) => {
    const start = cursor;
    cursor += band.share;
    return `${bandColors[index]} ${start}% ${cursor}%`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

function radarPoints(values: number[], center: number, radius: number) {
  return values
    .map((value, index) =>
      radarPoint(index, values.length, value, center, radius).join(","),
    )
    .join(" ");
}

function radarPoint(
  index: number,
  total: number,
  value: number,
  center: number,
  radius: number,
) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / total;
  const scaledRadius = (radius * Math.max(0, Math.min(100, value))) / 100;
  return [
    center + Math.cos(angle) * scaledRadius,
    center + Math.sin(angle) * scaledRadius,
  ];
}

function mergeSx(base: SxProps<Theme>, override?: SxProps<Theme>) {
  if (!override) return base;
  return Array.isArray(override) ? [base, ...override] : [base, override];
}
