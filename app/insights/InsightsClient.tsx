"use client";

import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import BarChartIcon from "@mui/icons-material/BarChart";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import MovieIcon from "@mui/icons-material/Movie";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import StarIcon from "@mui/icons-material/Star";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TvIcon from "@mui/icons-material/Tv";
import {
  Box,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
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
import { formatMediaType } from "@/lib/format";

type InsightsClientProps = {
  insightsByType: MediaTypeGenreInsights[];
};

const mediaAccent: Record<MediaType, string> = {
  [MediaType.MOVIE]: "#22D3EE",
  [MediaType.TV_SHOW]: "#A78BFA",
  [MediaType.VIDEO_GAME]: "#2EFFC3",
  [MediaType.BOOK]: "#FBBF24",
  [MediaType.BOARD_GAME]: "#FB923C",
  [MediaType.MUSIC]: "#FF77C8",
  [MediaType.MUSICAL]: "#FF91A6",
};

const bandColors = ["#22D3EE", "#7DD56F", "#FBBF24", "#FB923C", "#FF5C7A"];

export function InsightsClient({ insightsByType }: InsightsClientProps) {
  const [mediaType, setMediaType] =
    useStateWithAvailableMediaType(insightsByType);
  const selected =
    insightsByType.find((entry) => entry.mediaType === mediaType) ??
    insightsByType[0];
  const accent = selected ? mediaAccent[selected.mediaType] : "#22D3EE";
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
          label="No visible media exists yet. Add media and scores to unlock insights."
          sx={{ minHeight: 260 }}
        />
      </InsightsShell>
    );
  }

  return (
    <InsightsShell>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        sx={{ alignItems: { lg: "end" }, gap: 1.5 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 27, md: 34 },
              fontWeight: 950,
              letterSpacing: 0,
              lineHeight: 1,
            }}
          >
            Insights
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6 }} variant="body2">
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
          gap: 1,
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
          accent={mediaAccent[MediaType.TV_SHOW]}
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
          accent="#FBBF24"
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
          accent="#2EFFC3"
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
          accent="#FBBF24"
          icon={<ReportProblemIcon fontSize="small" />}
          sx={{ gridArea: "low" }}
          title="Low Data"
        >
          <LowDataGenres genres={lowDataGenres} />
        </InsightsPanel>

        <InsightsPanel
          accent="#FF77C8"
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
    <Stack
      spacing={1.3}
      sx={{
        isolation: "isolate",
        pb: 1.5,
        position: "relative",
        "&::before": {
          background:
            "radial-gradient(circle at 14% 0%, rgba(34, 211, 238, 0.11), transparent 30rem), radial-gradient(circle at 86% 4%, rgba(167, 139, 250, 0.14), transparent 31rem)",
          content: '""',
          inset: { xs: "-20px -12px auto", md: "-34px -28px auto" },
          minHeight: 520,
          pointerEvents: "none",
          position: "absolute",
          zIndex: -2,
        },
        "&::after": {
          background:
            "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
          content: '""',
          inset: { xs: "-18px -12px", md: "-28px" },
          maskImage:
            "radial-gradient(circle at 50% 0%, black, transparent 76%)",
          opacity: 0.24,
          pointerEvents: "none",
          position: "absolute",
          zIndex: -1,
        },
      }}
    >
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
      sx={{
        background:
          "linear-gradient(145deg, rgba(5, 8, 18, 0.74), rgba(8, 17, 31, 0.82))",
        border: `1px solid ${alpha("#BFDBFE", 0.12)}`,
        borderRadius: "8px",
        boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.04)}`,
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(3, minmax(0, 1fr))",
          sm: "repeat(3, 148px)",
        },
        overflow: "hidden",
        width: { xs: "100%", sm: "auto" },
        "& .MuiToggleButton-root": {
          border: 0,
          borderRadius: 0,
          color: "text.secondary",
          gap: 0.75,
          minHeight: 44,
          px: 1,
          "&.Mui-selected": {
            bgcolor: alpha(mediaAccent[value], 0.14),
            boxShadow: `inset 0 0 0 1px ${alpha(mediaAccent[value], 0.34)}`,
            color: mediaAccent[value],
          },
          "&:hover": {
            bgcolor: alpha("#FFFFFF", 0.055),
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
        background:
          "linear-gradient(145deg, rgba(8, 17, 31, 0.72), rgba(5, 8, 18, 0.82))",
        border: `1px solid ${alpha("#BFDBFE", 0.12)}`,
        borderRadius: "8px",
        boxShadow: `0 20px 70px ${alpha("#000000", 0.26)}, inset 0 1px 0 ${alpha("#FFFFFF", 0.04)}`,
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
              lg: index === 0 ? 0 : `1px solid ${alpha("#BFDBFE", 0.11)}`,
            },
            borderTop: {
              xs: index > 1 ? `1px solid ${alpha("#BFDBFE", 0.11)}` : 0,
              lg: 0,
            },
            p: { xs: 1.4, md: 1.7 },
          }}
        >
          <Typography
            sx={{
              color: "text.secondary",
              fontSize: 11,
              fontWeight: 850,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            {stat.label}
          </Typography>
          <Typography
            sx={{
              color: "text.primary",
              fontSize: { xs: 26, md: 31 },
              fontWeight: 950,
              letterSpacing: 0,
              lineHeight: 1.05,
              mt: 0.55,
            }}
          >
            {stat.value}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.4 }}>
            <Box component="span" sx={{ color: accent, fontWeight: 850 }}>
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
          background: `radial-gradient(circle at 16% 0%, ${alpha(accent, 0.1)}, transparent 22rem), linear-gradient(145deg, rgba(8, 17, 31, 0.82), rgba(5, 8, 18, 0.9))`,
          border: `1px solid ${alpha("#BFDBFE", 0.12)}`,
          borderRadius: "8px",
          boxShadow: `0 20px 64px ${alpha("#000000", 0.26)}, inset 0 1px 0 ${alpha("#FFFFFF", 0.04)}`,
          minHeight: 0,
          overflow: "hidden",
          p: { xs: 1.15, md: 1.25 },
          position: "relative",
          "&::before": {
            background: `linear-gradient(90deg, transparent, ${alpha(accent, 0.32)}, transparent)`,
            content: '""',
            height: 1,
            left: 16,
            position: "absolute",
            right: 16,
            top: 0,
          },
        },
        sx,
      )}
    >
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 1.1 }}>
        <Box sx={{ color: accent, display: "flex" }}>{icon}</Box>
        <Typography sx={{ fontSize: 16, fontWeight: 900 }}>{title}</Typography>
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
          fontSize: 11,
          fontWeight: 850,
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
            <Typography color="text.secondary" sx={{ fontSize: 12 }}>
              {index + 1}.
            </Typography>
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                sx={{ alignItems: "center", gap: 0.8, minWidth: 0 }}
              >
                <Typography noWrap sx={{ fontSize: 13, fontWeight: 800 }}>
                  {genre.name}
                </Typography>
                <Typography
                  sx={{ flexShrink: 0, fontSize: 12, fontWeight: 850 }}
                >
                  {genre.averageScore.toFixed(1)}
                </Typography>
              </Stack>
              <Box
                sx={{
                  bgcolor: alpha("#FFFFFF", 0.055),
                  borderRadius: "999px",
                  height: 9,
                  mt: 0.45,
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    background: `linear-gradient(90deg, ${alpha(accent, 0.22)}, ${accent})`,
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
                bgcolor: alpha(confidence.color, 0.14),
                border: `1px solid ${alpha(confidence.color, 0.32)}`,
                color: confidence.color,
                display: { xs: "none", sm: "inline-flex" },
                justifySelf: "start",
                minWidth: 66,
              }}
            />
            <Typography
              color="text.secondary"
              sx={{ fontSize: 12, justifySelf: "end" }}
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
        sx={{ height: 286, maxWidth: "100%", width: 286 }}
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
            stroke={alpha("#BFDBFE", 0.12)}
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
                stroke={alpha("#BFDBFE", 0.16)}
                strokeWidth="1"
                x1={center}
                x2={x}
                y1={center}
                y2={y}
              />
              <text
                fill={alpha("#E2E8F0", 0.74)}
                fontSize="10"
                fontWeight="700"
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
          fill={alpha("#FFFFFF", 0.05)}
          points={benchmarkPoints}
          stroke={alpha("#E2E8F0", 0.58)}
          strokeDasharray="4 4"
          strokeWidth="1.5"
        />
        <polygon
          fill={alpha("#22D3EE", 0.16)}
          points={userPoints}
          stroke="#22D3EE"
          strokeWidth="2.5"
        />
      </Box>
      <Stack direction="row" sx={{ gap: 1.4, justifyContent: "center" }}>
        <LegendDot color="#22D3EE" label="You" />
        <LegendDot color={alpha("#E2E8F0", 0.68)} label="Type avg" />
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
            bgcolor: "#07101D",
            border: `1px solid ${alpha("#BFDBFE", 0.09)}`,
            borderRadius: "50%",
            display: "flex",
            flexDirection: "column",
            height: 92,
            justifyContent: "center",
            width: 92,
          }}
        >
          <Typography sx={{ fontSize: 27, fontWeight: 950, lineHeight: 1 }}>
            {ratedCount}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>
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
            <Typography sx={{ flex: 1, fontSize: 12 }}>{band.label}</Typography>
            <Typography color="text.secondary" sx={{ fontSize: 12 }}>
              {band.share}%
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Box
        sx={{
          borderTop: `1px solid ${alpha("#BFDBFE", 0.1)}`,
          display: "flex",
          justifyContent: "space-between",
          pt: 1,
          width: "100%",
        }}
      >
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
          Average Score
        </Typography>
        <Typography sx={{ fontWeight: 900 }}>
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
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
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
      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
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
                  : designedPosterFallback(title.mediaType),
                backgroundPosition: "center",
                backgroundSize: "cover",
                border: `1px solid ${alpha("#BFDBFE", 0.13)}`,
                borderRadius: "8px",
                boxShadow: `0 14px 34px ${alpha("#000000", 0.28)}`,
                mb: 0.65,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <Box
                sx={{
                  background:
                    "linear-gradient(180deg, transparent 46%, rgba(5, 8, 18, 0.94) 100%)",
                  inset: 0,
                  position: "absolute",
                }}
              />
              <Box
                sx={{
                  alignItems: "center",
                  bgcolor: alpha("#050812", 0.82),
                  border: `1px solid ${alpha("#FFFFFF", 0.12)}`,
                  borderRadius: "6px",
                  bottom: 7,
                  color: "#FBBF24",
                  display: "flex",
                  fontSize: 11,
                  fontWeight: 900,
                  gap: 0.25,
                  left: 7,
                  px: 0.55,
                  py: 0.25,
                  position: "absolute",
                }}
              >
                <StarIcon sx={{ fontSize: 13 }} />
                {title.score.toFixed(1)}
              </Box>
            </Box>
            <Typography noWrap sx={{ fontSize: 12, fontWeight: 850 }}>
              {title.title}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 11 }}>
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
        borderBottom: `1px solid ${alpha("#BFDBFE", 0.08)}`,
        display: "grid",
        gap: 0.8,
        gridTemplateColumns: "24px minmax(0, 1fr) auto",
        minHeight: 32,
        pb: 0.65,
      }}
    >
      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
        {rank}.
      </Typography>
      <Typography noWrap sx={{ fontSize: 13, fontWeight: 800 }}>
        {label}
      </Typography>
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.7 }}>
        {typeof delta === "number" ? (
          <Typography
            sx={{
              color: delta >= 0 ? "#7DFFD9" : "#FF91A6",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}
          </Typography>
        ) : null}
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
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
          border: `1px solid ${alpha("#BFDBFE", 0.09)}`,
          borderRadius: "8px",
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
      <Typography sx={{ fontSize: 13 }}>{label}</Typography>
    </Box>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 0.55 }}>
      <Box sx={{ bgcolor: color, height: 2, width: 16 }} />
      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
        {label}
      </Typography>
    </Stack>
  );
}

function confidenceForGenre(genre: GenreInsight) {
  if (genre.ratedCount >= 8) return { label: "High", color: "#7DFFD9" };
  if (genre.ratedCount >= 3) return { label: "Medium", color: "#FBBF24" };
  return { label: "Low", color: "#FF91A6" };
}

function donutGradient(bands: InsightScoreBand[]) {
  if (bands.every((band) => band.share === 0)) {
    return `conic-gradient(${alpha("#BFDBFE", 0.12)} 0% 100%)`;
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

function mediaTypeIcon(mediaType: MediaType) {
  if (mediaType === MediaType.TV_SHOW) return <TvIcon fontSize="small" />;
  if (mediaType === MediaType.VIDEO_GAME) {
    return <SportsEsportsIcon fontSize="small" />;
  }
  return <MovieIcon fontSize="small" />;
}

function shortMediaTypeLabel(mediaType: MediaType) {
  if (mediaType === MediaType.TV_SHOW) return "TV";
  if (mediaType === MediaType.VIDEO_GAME) return "Games";
  return formatMediaType(mediaType);
}

function designedPosterFallback(mediaType: MediaType) {
  const accent = mediaAccent[mediaType] ?? "#22D3EE";
  return [
    `radial-gradient(circle at 26% 18%, ${alpha(accent, 0.42)}, transparent 34%)`,
    `linear-gradient(145deg, ${alpha(accent, 0.22)}, rgba(5, 8, 18, 0.94) 58%)`,
  ].join(", ");
}

function mergeSx(base: SxProps<Theme>, override?: SxProps<Theme>) {
  if (!override) return base;
  return Array.isArray(override) ? [base, ...override] : [base, override];
}
