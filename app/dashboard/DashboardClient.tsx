"use client";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import MovieIcon from "@mui/icons-material/Movie";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import TvIcon from "@mui/icons-material/Tv";
import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { MediaType } from "@prisma/client";
import Link from "next/link";
import {
  CompactStatCard,
  DashboardSection,
  noirTokens,
} from "@/components/cinematic/CinematicPrimitives";
import { formatMediaType, formatStatus } from "@/lib/format";
import type { FriendCompatibility, MediaItemDTO } from "@/lib/types";
import { formatUpcomingRelativeLabel } from "@/lib/upcoming";

type DashboardData = {
  totalItems: number;
  watchlistCount: number;
  comparisonCount: number;
  missingMetadataCount: number;
  duplicateCount: number;
  topItems: MediaItemDTO[];
  recommendations: Array<{
    media: MediaItemDTO;
    score: number;
    confidence: number;
  }>;
  genreInsights: Array<{
    name: string;
    count: number;
    completedCount: number;
    averageScore: number;
    share: number;
    needsData: boolean;
  }>;
  mediaTypeCounts: Array<{ mediaType: MediaType; count: number }>;
  topItemsByMediaType: Array<{ mediaType: MediaType; items: MediaItemDTO[] }>;
  upcomingItems: MediaItemDTO[];
  upcomingItemsByMediaType: Array<{
    mediaType: MediaType;
    items: MediaItemDTO[];
  }>;
  watchlistItems: MediaItemDTO[];
  recentItems: MediaItemDTO[];
  friendCompatibility: FriendCompatibility[];
  friendCount: number;
  health: {
    missingGenres: number;
    missingReleaseDates: number;
    lowComparisonItems: number;
  };
};

const dashboardMediaTypes: MediaType[] = ["MOVIE", "TV_SHOW", "VIDEO_GAME"];

export function DashboardClient({ data }: { data: DashboardData }) {
  const [topMediaType, setTopMediaType] = useState<MediaType>("MOVIE");
  const [upcomingMediaType, setUpcomingMediaType] =
    useState<MediaType>("MOVIE");

  const topItemsForType = useMemo(
    () =>
      data.topItemsByMediaType.find((entry) => entry.mediaType === topMediaType)
        ?.items ?? [],
    [data.topItemsByMediaType, topMediaType],
  );

  const upcomingItemsForType = useMemo(
    () =>
      data.upcomingItemsByMediaType.find(
        (entry) => entry.mediaType === upcomingMediaType,
      )?.items ?? [],
    [data.upcomingItemsByMediaType, upcomingMediaType],
  );

  const heroRecommendation = data.recommendations[0];

  return (
    <Stack spacing={1.25}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        sx={{ alignItems: { lg: "end" }, gap: 1.25 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 22, md: 27 },
              fontWeight: 950,
              lineHeight: 1,
            }}
          >
            Welcome back, Daniel.
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
            Your media universe awaits.
          </Typography>
        </Box>
        <Stack
          direction="row"
          sx={{
            flexWrap: "wrap",
            gap: 1,
            justifyContent: { xs: "flex-start", lg: "flex-end" },
          }}
        >
          <CompactStatCard
            accent={noirTokens.accent.blue}
            icon={<LibraryBooksIcon fontSize="small" />}
            label="Total items"
            value={data.totalItems.toLocaleString()}
          />
          <CompactStatCard
            accent={noirTokens.accent.emerald}
            icon={<PlaylistAddCheckIcon fontSize="small" />}
            label="Watchlist"
            value={data.watchlistCount.toLocaleString()}
          />
          <CompactStatCard
            accent={noirTokens.accent.purple}
            icon={<CompareArrowsIcon fontSize="small" />}
            label="Comparisons"
            value={data.comparisonCount.toLocaleString()}
          />
          <CompactStatCard
            accent={noirTokens.accent.amber}
            icon={<ReportProblemIcon fontSize="small" />}
            label="Metadata gaps"
            value={data.missingMetadataCount.toLocaleString()}
          />
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridTemplateAreas: {
            xs: `
              "pick"
              "recs"
              "top"
              "genre"
              "watch"
              "side"
              "health"
            `,
            lg: `
              "pick pick pick pick recs recs recs recs recs recs recs recs"
              "top top top top top top top top genre genre genre genre"
              "watch watch watch watch watch watch side side side side side side"
              "health health health health health health health health health health health health"
            `,
          },
          gridTemplateColumns: { xs: "1fr", lg: "repeat(12, minmax(0, 1fr))" },
        }}
      >
        <Box sx={{ gridArea: "pick", minWidth: 0 }}>
          {heroRecommendation ? (
            <TonightPickCard
              confidence={heroRecommendation.confidence}
              item={heroRecommendation.media}
              score={heroRecommendation.score}
            />
          ) : (
            <DashboardCard title="Tonight's Pick">
              <EmptyPanel
                icon={<AutoAwesomeIcon />}
                label="Add ratings to unlock a featured recommendation."
              />
            </DashboardCard>
          )}
        </Box>

        <Box sx={{ gridArea: "recs", minWidth: 0 }}>
          <DashboardCard
            action={
              <Button href="/recommendations" size="small">
                View all
              </Button>
            }
            title="Top Recommendations For You"
          >
            <MediaRail>
              {data.recommendations.slice(0, 5).map((recommendation) => (
                <PosterCard
                  href={`/media/${recommendation.media.id}`}
                  item={recommendation.media}
                  key={recommendation.media.id}
                  score={recommendation.score}
                />
              ))}
            </MediaRail>
          </DashboardCard>
        </Box>

        <Box sx={{ gridArea: "top", minWidth: 0 }}>
          <DashboardCard
            action={
              <Button href="/top-lists" size="small">
                Open lists
              </Button>
            }
            title="Top 10 By Media Type"
          >
            <MediaTypeTabs
              counts={data.mediaTypeCounts}
              onChange={setTopMediaType}
              value={topMediaType}
            />
            {topItemsForType.length > 0 ? (
              <Box
                sx={{
                  display: "grid",
                  gap: 0.55,
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    sm: "repeat(5, minmax(0, 1fr))",
                    lg: "repeat(10, minmax(0, 1fr))",
                  },
                  mt: 1,
                }}
              >
                {topItemsForType.slice(0, 10).map((item, index) => (
                  <TopPosterTile index={index} item={item} key={item.id} />
                ))}
              </Box>
            ) : (
              <EmptyPanel
                icon={<PlaylistAddCheckIcon />}
                label={`No completed ${formatMediaType(topMediaType).toLowerCase()} ranked yet.`}
              />
            )}
          </DashboardCard>
        </Box>

        <Box sx={{ gridArea: "genre", minWidth: 0 }}>
          <DashboardCard
            action={
              <Button href="/insights" size="small">
                View insights
              </Button>
            }
            title="Genre Breakdown"
          >
            <GenreBarChart genres={data.genreInsights.slice(0, 7)} />
          </DashboardCard>
        </Box>

        <Box sx={{ gridArea: "watch", minWidth: 0 }}>
          <DashboardCard
            action={
              <Button href="/watchlist" size="small">
                Open watchlist
              </Button>
            }
            title="Watchlist Signals"
          >
            <Box
              sx={{
                display: "grid",
                flex: 1,
                gap: 0.65,
                gridTemplateColumns: "1fr",
                gridTemplateRows: "repeat(5, minmax(0, 1fr))",
              }}
            >
              {data.watchlistItems.slice(0, 5).map((item) => (
                <MediaSignalRow
                  href={`/media/${item.id}`}
                  item={item}
                  key={item.id}
                  score={item.computedPersonalScore ?? item.pairwiseScore / 100}
                  compact
                />
              ))}
            </Box>
          </DashboardCard>
        </Box>

        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridArea: "side",
            minWidth: 0,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <DashboardCard
              action={
                <Button href="/upcoming" size="small">
                  Open upcoming
                </Button>
              }
              title="Upcoming Releases"
            >
              <MediaTypeTabs
                counts={data.upcomingItemsByMediaType.map((entry) => ({
                  mediaType: entry.mediaType,
                  count: entry.items.length,
                }))}
                onChange={setUpcomingMediaType}
                value={upcomingMediaType}
              />
              {upcomingItemsForType.length > 0 ? (
                <Stack spacing={0.75} sx={{ mt: 1 }}>
                  {upcomingItemsForType.slice(0, 6).map((item) => (
                    <UpcomingRow item={item} key={item.id} />
                  ))}
                </Stack>
              ) : (
                <EmptyPanel
                  icon={<CalendarMonthIcon />}
                  label={`No upcoming ${formatMediaType(upcomingMediaType).toLowerCase()} dates yet.`}
                />
              )}
            </DashboardCard>
          </Box>
        </Box>

        <Box sx={{ gridArea: "health", minWidth: 0 }}>
          <DataHealthStrip
            duplicateCount={data.duplicateCount}
            health={data.health}
          />
        </Box>
      </Box>
    </Stack>
  );
}

function TonightPickCard({
  confidence,
  item,
  score,
}: {
  confidence: number;
  item: MediaItemDTO;
  score: number;
}) {
  return (
    <DashboardSection accent={noirTokens.accent.amber} title="Tonight's Pick">
      <Link
        href={`/media/${item.id}`}
        style={{
          color: "inherit",
          display: "block",
          height: "100%",
          textDecoration: "none",
        }}
      >
        <Box
          sx={{
            background: alpha("#080B12", 0.42),
            border: `1px solid ${alpha(noirTokens.accent.amber, 0.18)}`,
            borderRadius: 1,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
            transition: "border-color 180ms ease, transform 180ms ease",
            "&:hover": {
              borderColor: alpha(noirTokens.accent.amber, 0.42),
              transform: "translateY(-2px)",
              "& .tonight-art": {
                transform: "scale(1.035)",
              },
            },
          }}
        >
          <Box
            className="tonight-art"
            sx={{
              aspectRatio: { xs: "16 / 8.7", md: "16 / 8.2" },
              backgroundImage: item.posterUrl
                ? `linear-gradient(180deg, transparent 32%, rgba(8, 11, 18, 0.92)), url(${item.posterUrl})`
                : `radial-gradient(circle at 50% 20%, ${alpha(mediaTypeColor(item.mediaType), 0.44)}, transparent 16rem), linear-gradient(135deg, rgba(17, 24, 39, 0.96), rgba(8, 11, 18, 0.96))`,
              backgroundPosition: "center",
              backgroundSize: "cover",
              flex: 1,
              minHeight: { md: 272 },
              position: "relative",
              transition: "transform 220ms ease",
            }}
          >
            <Typography
              sx={{
                bottom: 12,
                fontSize: { xs: 24, sm: 30 },
                fontWeight: 950,
                left: 12,
                letterSpacing: 2.4,
                lineHeight: 0.9,
                maxWidth: "82%",
                position: "absolute",
                textShadow: `0 6px 24px ${alpha("#000000", 0.7)}`,
                textTransform: "uppercase",
              }}
            >
              {item.title}
            </Typography>
          </Box>
          <Box sx={{ p: 1 }}>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.45 }}>
              <ScoreBadge label="Match" value={`${Math.round(score)}%`} />
              <ScoreBadge
                label="Confidence"
                value={`${Math.round(confidence)}%`}
              />
              {item.genres.slice(0, 2).map((genre) => (
                <Chip
                  key={genre}
                  label={genre}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
            <Typography
              color="text.secondary"
              sx={{ mt: 0.7 }}
              variant="caption"
            >
              You rated similar releases highly.
            </Typography>
          </Box>
        </Box>
      </Link>
    </DashboardSection>
  );
}

function ScoreBadge({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        alignItems: "baseline",
        background: alpha(noirTokens.accent.emerald, 0.08),
        border: `1px solid ${alpha(noirTokens.accent.emerald, 0.22)}`,
        borderRadius: 0.75,
        color: noirTokens.accent.emerald,
        display: "inline-flex",
        gap: 0.45,
        px: 0.65,
        py: 0.25,
      }}
    >
      <Typography sx={{ fontSize: 10, fontWeight: 950, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 9, fontWeight: 800, opacity: 0.82 }}>
        {label}
      </Typography>
    </Box>
  );
}

function TopPosterTile({ index, item }: { index: number; item: MediaItemDTO }) {
  return (
    <Link
      href={`/media/${item.id}`}
      style={{ color: "inherit", display: "block", textDecoration: "none" }}
    >
      <Box
        sx={{
          position: "relative",
          "&:hover .tile-poster": {
            borderColor: alpha(noirTokens.accent.purple, 0.46),
            transform: "translateY(-2px)",
          },
        }}
      >
        <Typography
          sx={{
            color: "text.secondary",
            fontSize: 11,
            fontWeight: 900,
            mb: 0.55,
            textAlign: "center",
          }}
        >
          {index + 1}
        </Typography>
        <Box
          className="tile-poster"
          sx={{
            aspectRatio: "2 / 3",
            backgroundImage: item.posterUrl
              ? `linear-gradient(180deg, transparent 42%, rgba(8, 11, 18, 0.84)), url(${item.posterUrl})`
              : `linear-gradient(135deg, ${alpha(mediaTypeColor(item.mediaType), 0.34)}, ${alpha("#080B12", 0.94)})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
            border: `1px solid ${alpha("#BFDBFE", 0.13)}`,
            borderRadius: 0.75,
            minHeight: 92,
            transition: "border-color 180ms ease, transform 180ms ease",
          }}
        />
        <Typography
          noWrap
          sx={{ fontSize: 10.5, fontWeight: 800, mt: 0.45 }}
          title={item.title}
        >
          {item.title}
        </Typography>
      </Box>
    </Link>
  );
}

function GenreBarChart({
  genres,
}: {
  genres: Array<{
    averageScore: number;
    count: number;
    name: string;
    share: number;
  }>;
}) {
  const maxScore = Math.max(
    100,
    ...genres.map((genre) => Math.round(genre.averageScore * 10)),
  );

  return (
    <Box
      sx={{
        alignItems: "end",
        borderBottom: `1px solid ${alpha("#BFDBFE", 0.1)}`,
        borderLeft: `1px solid ${alpha("#BFDBFE", 0.1)}`,
        display: "grid",
        flex: 1,
        gap: 0.65,
        gridTemplateColumns: `repeat(${Math.max(genres.length, 1)}, minmax(0, 1fr))`,
        minHeight: 176,
        px: 0.75,
        pt: 0.75,
      }}
    >
      {genres.map((genre) => {
        const score = Math.round(genre.averageScore * 10);
        const height = Math.max(18, Math.round((score / maxScore) * 132));

        return (
          <Stack
            key={genre.name}
            spacing={0.45}
            sx={{ alignItems: "center", justifyContent: "end", minWidth: 0 }}
          >
            <Typography sx={{ fontSize: 10, fontWeight: 800 }}>
              {score}
            </Typography>
            <Box
              sx={{
                background: `linear-gradient(180deg, ${noirTokens.accent.purple}, ${alpha(noirTokens.accent.purple, 0.34)})`,
                border: `1px solid ${alpha("#FFFFFF", 0.12)}`,
                borderRadius: "3px 3px 0 0",
                boxShadow: `0 0 18px ${alpha(noirTokens.accent.purple, 0.16)}`,
                height,
                width: "60%",
              }}
            />
            <Typography
              noWrap
              sx={{
                color: "text.secondary",
                fontSize: 10,
                maxWidth: "100%",
              }}
              title={genre.name}
            >
              {genre.name}
            </Typography>
          </Stack>
        );
      })}
    </Box>
  );
}

function MediaTypeTabs({
  counts,
  onChange,
  value,
}: {
  counts: Array<{ mediaType: MediaType; count: number }>;
  onChange: (value: MediaType) => void;
  value: MediaType;
}) {
  const countByType = new Map(
    counts.map((entry) => [entry.mediaType, entry.count]),
  );

  return (
    <ToggleButtonGroup
      exclusive
      fullWidth
      onChange={(_, nextValue: MediaType | null) => {
        if (nextValue) onChange(nextValue);
      }}
      size="small"
      sx={{
        bgcolor: alpha("#07111d", 0.28),
        border: `1px solid ${alpha("#9fb4d0", 0.1)}`,
        borderRadius: 1,
        p: 0.25,
        "& .MuiToggleButton-root": {
          border: 0,
          borderRadius: 0.75,
          color: "text.secondary",
          gap: 0.6,
          minHeight: 28,
          px: 0.75,
          py: 0.4,
          textTransform: "none",
          whiteSpace: "nowrap",
          "&.Mui-selected": {
            bgcolor: alpha("#7c5cff", 0.22),
            color: "text.primary",
          },
        },
      }}
      value={value}
    >
      {dashboardMediaTypes.map((mediaType) => (
        <ToggleButton key={mediaType} value={mediaType}>
          {mediaTypeIcon(mediaType)}
          <Typography component="span" sx={{ fontSize: 11, fontWeight: 800 }}>
            {shortMediaTypeLabel(mediaType)}
          </Typography>
          <Typography
            color="text.secondary"
            component="span"
            sx={{ fontSize: 10 }}
          >
            {countByType.get(mediaType) ?? 0}
          </Typography>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function MediaRail({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        flex: 1,
        gap: 0.7,
        gridAutoColumns: {
          xs: "minmax(136px, 54vw)",
          sm: "minmax(128px, 1fr)",
        },
        gridAutoFlow: "column",
        overflowX: "auto",
        pb: 0.2,
        scrollSnapType: "x proximity",
      }}
    >
      {children}
    </Box>
  );
}

function PosterCard({
  href,
  item,
  score,
}: {
  href: string;
  item: MediaItemDTO;
  score: number;
}) {
  return (
    <Link
      href={href}
      style={{
        color: "inherit",
        display: "block",
        height: "100%",
        textDecoration: "none",
      }}
    >
      <Box
        sx={{
          background: alpha("#BFDBFE", 0.035),
          border: `1px solid ${alpha("#BFDBFE", 0.1)}`,
          borderRadius: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          scrollSnapAlign: "start",
          transition:
            "border-color 180ms ease, background-color 180ms ease, transform 180ms ease",
          "&:hover": {
            bgcolor: alpha("#BFDBFE", 0.075),
            borderColor: alpha(noirTokens.accent.purple, 0.46),
            transform: "translateY(-2px)",
            "& .poster-art": {
              transform: "scale(1.045)",
            },
          },
        }}
      >
        <Box
          className="poster-art"
          sx={{
            aspectRatio: "2 / 3",
            bgcolor: alpha(mediaTypeColor(item.mediaType), 0.16),
            backgroundImage: item.posterUrl
              ? `linear-gradient(180deg, transparent 38%, rgba(8, 11, 18, 0.92)), url(${item.posterUrl})`
              : `linear-gradient(135deg, ${alpha(mediaTypeColor(item.mediaType), 0.34)}, ${alpha(noirTokens.background.default, 0.92)})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
            borderBottom: `1px solid ${alpha("#BFDBFE", 0.08)}`,
            flex: 1,
            minHeight: 0,
            position: "relative",
            transformOrigin: "center",
            transition: "transform 220ms ease",
          }}
        >
          <Box
            sx={{
              alignItems: "center",
              backdropFilter: "blur(12px)",
              bgcolor: alpha(noirTokens.background.default, 0.76),
              border: `1px solid ${alpha(noirTokens.accent.emerald, 0.34)}`,
              borderRadius: 0.75,
              bottom: 8,
              boxShadow: `0 0 24px ${alpha(noirTokens.accent.emerald, 0.2)}`,
              color: noirTokens.accent.emerald,
              display: "flex",
              fontSize: 11,
              fontWeight: 900,
              height: 24,
              justifyContent: "center",
              left: 8,
              px: 0.7,
            }}
          >
            {Math.round(score)}%
          </Box>
          {!item.posterUrl ? (
            <Box
              sx={{
                alignItems: "center",
                color: mediaTypeColor(item.mediaType),
                display: "flex",
                height: "100%",
                justifyContent: "center",
              }}
            >
              {mediaTypeIcon(item.mediaType)}
            </Box>
          ) : null}
        </Box>
        <Box sx={{ p: 0.8 }}>
          <Typography noWrap sx={{ fontSize: 12, fontWeight: 900 }}>
            {item.title}
          </Typography>
          <Typography color="text.secondary" noWrap sx={{ fontSize: 10.5 }}>
            {formatMediaType(item.mediaType)} / {formatStatus(item.status)}
          </Typography>
        </Box>
      </Box>
    </Link>
  );
}

function UpcomingRow({ item }: { item: MediaItemDTO }) {
  return (
    <Stack
      direction="row"
      spacing={0.8}
      sx={{
        alignItems: "center",
        borderBottom: `1px solid ${alpha("#9fb4d0", 0.08)}`,
        minHeight: 42,
        pb: 0.65,
      }}
    >
      <CalendarMonthIcon color="primary" sx={{ fontSize: 17 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Link href={`/media/${item.id}`} style={{ textDecoration: "none" }}>
          <Typography
            noWrap
            sx={{ color: "primary.main", fontSize: 12, fontWeight: 800 }}
          >
            {item.title}
          </Typography>
        </Link>
      </Box>
      <Box sx={{ minWidth: 86, textAlign: "right" }}>
        <Typography color="text.secondary" sx={{ fontSize: 11.5 }}>
          {item.releaseDate ? new Date(item.releaseDate).toLocaleDateString() : "-"}
        </Typography>
        {item.releaseDate ? (
          <Typography color="text.secondary" sx={{ fontSize: 10.5 }}>
            {formatUpcomingRelativeLabel(item.releaseDate)}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

function DashboardCard({
  action,
  children,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <DashboardSection action={action} title={title}>
      {children}
    </DashboardSection>
  );
}

function DataHealthStrip({
  duplicateCount,
  health,
}: {
  duplicateCount: number;
  health: DashboardData["health"];
}) {
  return (
    <DashboardSection
      action={
        <Button href="/data-health" size="small">
          Review
        </Button>
      }
      accent={noirTokens.accent.amber}
      title="Data Health"
    >
      <Box
        sx={{
          display: "grid",
          gap: 0.65,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <HealthPill label="Missing genres" value={health.missingGenres} />
        <HealthPill
          label="Missing release dates"
          value={health.missingReleaseDates}
        />
        <HealthPill label="Low comparisons" value={health.lowComparisonItems} />
        <HealthPill label="Possible duplicates" value={duplicateCount} />
      </Box>
    </DashboardSection>
  );
}

function HealthPill({ label, value }: { label: string; value: number }) {
  const accent =
    value > 0 ? noirTokens.accent.amber : noirTokens.accent.emerald;

  return (
    <Box
      sx={{
        alignItems: "center",
        background: alpha(accent, 0.055),
        border: `1px solid ${alpha(accent, 0.16)}`,
        borderRadius: 0.75,
        display: "flex",
        gap: 0.65,
        minHeight: 32,
        px: 0.8,
      }}
    >
      <CheckCircleIcon sx={{ color: accent, fontSize: 15 }} />
      <Typography noWrap sx={{ flex: 1, fontSize: 11.5, minWidth: 0 }}>
        {label}
      </Typography>
      <Typography sx={{ color: accent, fontSize: 12, fontWeight: 950 }}>
        {value.toLocaleString()}
      </Typography>
    </Box>
  );
}

function EmptyPanel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Stack
      spacing={0.6}
      sx={{
        alignItems: "center",
        border: `1px dashed ${alpha("#9fb4d0", 0.14)}`,
        borderRadius: 1,
        color: "text.secondary",
        flex: 1,
        justifyContent: "center",
        mt: 0.75,
        py: 1.4,
      }}
    >
      {icon}
      <Typography sx={{ fontSize: 12 }}>{label}</Typography>
    </Stack>
  );
}

function MediaSignalRow({
  compact = false,
  href,
  item,
  score,
}: {
  compact?: boolean;
  href: string;
  item: MediaItemDTO;
  score: number;
}) {
  const normalized = Math.min(100, Math.max(0, Math.round(score * 10)));

  return (
    <Link
      href={href}
      style={{
        color: "inherit",
        display: "block",
        height: "100%",
        textDecoration: "none",
      }}
    >
      <Box
        sx={{
          background: alpha("#BFDBFE", 0.028),
          border: `1px solid ${alpha("#9fb4d0", 0.09)}`,
          borderRadius: 1,
          height: "100%",
          p: 0.75,
          "&:hover": {
            bgcolor: alpha("#9fb4d0", 0.045),
            borderColor: alpha("#8c6bff", 0.28),
          },
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={0.85}
          sx={{ alignItems: { sm: "center" } }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 850 }}>
              {item.title}
            </Typography>
            <Stack
              direction="row"
              sx={{ flexWrap: "wrap", gap: 0.4, mt: 0.45 }}
            >
              <Typography color="text.secondary" sx={{ fontSize: 10.5 }}>
                {formatMediaType(item.mediaType)} / {formatStatus(item.status)}
              </Typography>
              {!compact &&
                item.genres
                  .slice(0, 2)
                  .map((genre) => (
                    <Chip
                      key={genre}
                      label={genre}
                      size="small"
                      variant="outlined"
                    />
                  ))}
            </Stack>
          </Box>
          <Box sx={{ minWidth: { sm: 104 } }}>
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                mb: 0.4,
              }}
            >
              <Typography color="text.secondary" sx={{ fontSize: 10 }}>
                Score
              </Typography>
              <Typography sx={{ fontSize: 10, fontWeight: 800 }}>
                {formatDashboardScore(score)}
              </Typography>
            </Stack>
            <LinearProgress value={normalized} variant="determinate" />
          </Box>
        </Stack>
      </Box>
    </Link>
  );
}

function formatDashboardScore(value: number) {
  return value.toFixed(1);
}

function mediaTypeIcon(mediaType: MediaType) {
  if (mediaType === "TV_SHOW") return <TvIcon fontSize="small" />;
  if (mediaType === "VIDEO_GAME") return <SportsEsportsIcon fontSize="small" />;
  return <MovieIcon fontSize="small" />;
}

function mediaTypeColor(mediaType: MediaType) {
  if (mediaType === "TV_SHOW") return "#25d0b2";
  if (mediaType === "VIDEO_GAME") return "#ffb13d";
  return "#7c5cff";
}

function shortMediaTypeLabel(mediaType: MediaType) {
  if (mediaType === "TV_SHOW") return "TV";
  if (mediaType === "VIDEO_GAME") return "Games";
  return "Movies";
}
