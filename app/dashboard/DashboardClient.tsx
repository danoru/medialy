"use client";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
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
import type { SxProps, Theme } from "@mui/material/styles";
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
  tonightPicksByMediaType: Array<{
    mediaType: MediaType;
    recommendation: {
      media: MediaItemDTO;
      score: number;
      confidence: number;
    } | null;
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
    missingPosters: number;
    missingReleaseDates: number;
    lowComparisonItems: number;
  };
};

const dashboardMediaTypes: MediaType[] = ["MOVIE", "TV_SHOW", "VIDEO_GAME"];

type DashboardRecommendation = DashboardData["recommendations"][number];

const premiumPanelActionSx = {
  borderColor: alpha("#FFFFFF", 0.08),
  borderRadius: 999,
  color: "text.secondary",
  fontSize: 11,
  fontWeight: 800,
  minHeight: 28,
  px: 1.2,
  textTransform: "none",
  "&:hover": {
    bgcolor: alpha("#FFFFFF", 0.065),
    borderColor: alpha("#FFFFFF", 0.16),
    color: "text.primary",
  },
} as const;

export function DashboardClient({ data }: { data: DashboardData }) {
  const initialTonightPickType =
    dashboardMediaTypes.find((mediaType) =>
      data.tonightPicksByMediaType.some(
        (entry) => entry.mediaType === mediaType && entry.recommendation,
      ),
    ) ?? "MOVIE";
  const [topMediaType, setTopMediaType] = useState<MediaType>("MOVIE");
  const [tonightPickType, setTonightPickType] = useState<MediaType>(
    initialTonightPickType,
  );
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

  const tonightPicksByType = useMemo(() => {
    const picks = new Map<MediaType, DashboardRecommendation>();

    for (const entry of data.tonightPicksByMediaType) {
      if (
        !entry.recommendation ||
        !dashboardMediaTypes.includes(entry.mediaType)
      ) {
        continue;
      }

      picks.set(entry.mediaType, entry.recommendation);
    }

    return picks;
  }, [data.tonightPicksByMediaType]);

  const heroRecommendation = tonightPicksByType.get(tonightPickType);
  const recommendationRailItems = data.recommendations
    .filter(
      (recommendation) =>
        recommendation.media.id !== heroRecommendation?.media.id,
    )
    .slice(0, 5);
  const tonightPickCounts = dashboardMediaTypes.map((mediaType) => ({
    mediaType,
    count: tonightPicksByType.has(mediaType) ? 1 : 0,
  }));

  return (
    <Stack
      spacing={1.5}
      sx={{
        isolation: "isolate",
        position: "relative",
        "&::before": {
          background:
            "radial-gradient(circle at 12% 4%, rgba(85, 216, 255, 0.14), transparent 28rem), radial-gradient(circle at 72% 0%, rgba(155, 124, 255, 0.16), transparent 34rem), radial-gradient(circle at 90% 48%, rgba(248, 184, 78, 0.08), transparent 28rem)",
          content: '""',
          inset: { xs: "-24px -12px auto", md: "-42px -28px auto" },
          minHeight: 620,
          pointerEvents: "none",
          position: "absolute",
          zIndex: -2,
        },
        "&::after": {
          background:
            "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          content: '""',
          inset: { xs: "-18px -12px", md: "-28px" },
          maskImage:
            "radial-gradient(circle at 50% 0%, black, transparent 78%)",
          opacity: 0.28,
          pointerEvents: "none",
          position: "absolute",
          zIndex: -1,
        },
      }}
    >
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
              letterSpacing: 0,
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
              "pick pick pick pick pick recs recs recs recs recs recs recs"
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
              counts={tonightPickCounts}
              confidence={heroRecommendation.confidence}
              item={heroRecommendation.media}
              likedItems={data.topItems.slice(0, 5)}
              onTypeChange={setTonightPickType}
              score={heroRecommendation.score}
              value={tonightPickType}
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
              <Button
                href="/recommendations"
                size="small"
                sx={premiumPanelActionSx}
              >
                View all
              </Button>
            }
            title="Top Recommendations For You"
          >
            <MediaRail>
              {recommendationRailItems.map((recommendation) => (
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
              <Button href="/top-lists" size="small" sx={premiumPanelActionSx}>
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
              <Button href="/insights" size="small" sx={premiumPanelActionSx}>
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
              <Button href="/watchlist" size="small" sx={premiumPanelActionSx}>
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
                <Button href="/upcoming" size="small" sx={premiumPanelActionSx}>
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
  counts,
  confidence,
  item,
  likedItems,
  onTypeChange,
  score,
  value,
}: {
  counts: Array<{ mediaType: MediaType; count: number }>;
  confidence: number;
  item: MediaItemDTO;
  likedItems: MediaItemDTO[];
  onTypeChange: (value: MediaType) => void;
  score: number;
  value: MediaType;
}) {
  const releaseYear = releaseYearLabel(item.releaseDate);
  const heroMeta = [
    formatMediaType(item.mediaType),
    releaseYear,
    ...item.genres.slice(0, 1),
  ].filter(Boolean);

  return (
    <Box
      component="section"
      sx={{
        background: "#05070E",
        borderRadius: { xs: "24px", md: "28px" },
        boxShadow: [
          `0 30px 90px ${alpha("#000000", 0.52)}`,
          `0 0 70px ${alpha(mediaTypeColor(item.mediaType), 0.1)}`,
          `inset 0 1px 0 ${alpha("#FFFFFF", 0.07)}`,
        ].join(", "),
        height: { xs: 430, md: 476 },
        isolation: "isolate",
        overflow: "hidden",
        position: "relative",
        transform: "translateZ(0)",
        "&:hover .tonight-backdrop": {
          transform: "scale(1.035)",
        },
      }}
    >
      <Box
        className="tonight-backdrop"
        sx={{
          backgroundImage: item.posterUrl
            ? `url(${item.posterUrl})`
            : designedHeroFallback(item.mediaType),
          backgroundPosition: "center",
          backgroundSize: "cover",
          filter: item.posterUrl ? "saturate(0.92) contrast(1.05)" : "none",
          inset: 0,
          position: "absolute",
          transition: "transform 700ms cubic-bezier(.2,.8,.2,1)",
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          background:
            "linear-gradient(90deg, rgba(3,5,12,0.96) 0%, rgba(3,5,12,0.82) 36%, rgba(3,5,12,0.3) 68%, rgba(3,5,12,0.58) 100%), linear-gradient(0deg, rgba(3,5,12,0.98) 0%, rgba(3,5,12,0.58) 38%, rgba(3,5,12,0.18) 100%)",
          inset: 0,
          position: "absolute",
          zIndex: 1,
        }}
      />
      <Box
        sx={{
          backgroundImage:
            "radial-gradient(circle at 28% 22%, rgba(255,255,255,0.12) 0 1px, transparent 1px), radial-gradient(circle at 78% 32%, rgba(255,255,255,0.08) 0 1px, transparent 1px)",
          backgroundSize: "18px 18px, 23px 23px",
          inset: 0,
          opacity: item.posterUrl ? 0.1 : 0.18,
          pointerEvents: "none",
          position: "absolute",
          zIndex: 2,
        }}
      />
      <Box
        sx={{
          left: { xs: 14, sm: 18 },
          maxWidth: { xs: "calc(100% - 108px)", sm: 430 },
          position: "absolute",
          top: { xs: 14, sm: 16 },
          width: "100%",
          zIndex: 5,
        }}
      >
        <MediaTypeTabs
          counts={counts}
          disabledMediaTypes={counts
            .filter((entry) => entry.count === 0)
            .map((entry) => entry.mediaType)}
          onChange={onTypeChange}
          showCounts={false}
          sx={{
            backdropFilter: "blur(20px) saturate(1.25)",
            bgcolor: alpha("#060A14", 0.42),
            border: 0,
            boxShadow: `0 12px 36px ${alpha("#000000", 0.24)}, inset 0 1px 0 ${alpha("#FFFFFF", 0.08)}`,
            p: 0.25,
            "& .MuiToggleButton-root": {
              color: alpha("#F8FAFC", 0.64),
              minHeight: 28,
              px: { xs: 0.65, sm: 0.9 },
              py: 0.35,
              "&.Mui-selected": {
                bgcolor: alpha("#FFFFFF", 0.14),
                boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.1)}`,
              },
            },
          }}
          value={value}
        />
      </Box>
      <ScoreBadge
        label="Match"
        sx={{
          position: "absolute",
          right: { xs: 14, sm: 18 },
          top: { xs: 14, sm: 16 },
          zIndex: 5,
        }}
        value={`${Math.round(score)}%`}
      />
      <Stack
        spacing={1.05}
        sx={{
          bottom: { xs: 18, md: 22 },
          left: { xs: 18, md: 24 },
          maxWidth: { xs: "calc(100% - 36px)", sm: 610 },
          position: "absolute",
          right: { xs: 18, sm: "auto" },
          zIndex: 4,
        }}
      >
        <Typography
          sx={{
            color: alpha("#F8FAFC", 0.7),
            fontSize: 10,
            fontWeight: 850,
            letterSpacing: 1.2,
            lineHeight: 1,
            textShadow: `0 8px 24px ${alpha("#000000", 0.8)}`,
            textTransform: "uppercase",
          }}
        >
          Curated for tonight / Tonight&apos;s Pick
        </Typography>
        <Typography
          component="h2"
          sx={{
            color: "#FFFFFF",
            fontSize: { xs: 36, sm: 48, md: 58 },
            fontWeight: 920,
            letterSpacing: 0,
            lineHeight: 0.92,
            maxWidth: 660,
            textShadow: `0 20px 60px ${alpha("#000000", 0.82)}`,
          }}
        >
          {item.title}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.55, pt: 0.2 }}>
          {heroMeta.map((entry) => (
            <TonightMetaChip key={entry}>{entry}</TonightMetaChip>
          ))}
          <TonightMetaChip>{`${Math.round(confidence * 100)}% confidence`}</TonightMetaChip>
        </Stack>
        <Typography
          sx={{
            color: alpha("#E5EEF9", 0.78),
            fontSize: { xs: 12.5, md: 13 },
            lineHeight: 1.45,
            maxWidth: 500,
            textShadow: `0 10px 28px ${alpha("#000000", 0.72)}`,
          }}
        >
          {pickReason(item)}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, pt: 0.35 }}>
          <Button
            component={Link}
            endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
            href={`/media/${item.id}`}
            size="small"
            sx={{
              bgcolor: alpha("#F8FAFC", 0.92),
              borderRadius: 999,
              boxShadow: `0 12px 34px ${alpha("#000000", 0.28)}`,
              color: "#070A12",
              fontSize: 12,
              fontWeight: 820,
              minHeight: 32,
              px: 1.2,
              textTransform: "none",
              "&:hover": {
                bgcolor: "#FFFFFF",
                boxShadow: `0 14px 38px ${alpha("#000000", 0.34)}`,
              },
            }}
            variant="contained"
          >
            View details
          </Button>
          <Button
            component={Link}
            href="/recommendations"
            size="small"
            startIcon={<InfoOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{
              backdropFilter: "blur(16px)",
              bgcolor: alpha("#FFFFFF", 0.075),
              border: `1px solid ${alpha("#FFFFFF", 0.08)}`,
              borderRadius: 999,
              color: alpha("#F8FAFC", 0.92),
              fontSize: 12,
              fontWeight: 760,
              minHeight: 32,
              px: 1.1,
              textTransform: "none",
              "&:hover": {
                bgcolor: alpha("#FFFFFF", 0.12),
                borderColor: alpha("#FFFFFF", 0.12),
              },
            }}
          >
            Why this pick?
          </Button>
        </Stack>
        {likedItems.length > 0 ? (
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              gap: 0.65,
              maxWidth: "100%",
              minWidth: 0,
              pt: 0.3,
            }}
          >
            <Typography
              sx={{
                color: alpha("#F8FAFC", 0.58),
                flexShrink: 0,
                fontSize: 10,
                fontWeight: 720,
              }}
            >
              Because you liked
            </Typography>
            <Box
              sx={{
                display: "flex",
                gap: 0.45,
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              {likedItems.map((liked) => (
                <Box
                  key={liked.id}
                  sx={{
                    backgroundImage: liked.posterUrl
                      ? `linear-gradient(180deg, transparent, ${alpha("#05070E", 0.45)}), url(${liked.posterUrl})`
                      : designedPosterFallback(liked.mediaType),
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                    borderRadius: 1,
                    boxShadow: `inset 0 0 0 1px ${alpha("#FFFFFF", 0.06)}`,
                    flex: "0 0 54px",
                    height: 30,
                    opacity: 0.86,
                  }}
                  title={liked.title}
                />
              ))}
            </Box>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}

function ScoreBadge({
  label,
  sx,
  value,
}: {
  label: string;
  sx?: SxProps<Theme>;
  value: string;
}) {
  return (
    <Box
      sx={{
        alignItems: "center",
        backdropFilter: "blur(18px) saturate(1.25)",
        background: alpha("#06140F", 0.46),
        borderRadius: 999,
        boxShadow: [
          `0 16px 42px ${alpha("#000000", 0.34)}`,
          `0 0 24px ${alpha(noirTokens.accent.emerald, 0.16)}`,
          `inset 0 0 0 1px ${alpha("#FFFFFF", 0.11)}`,
        ].join(", "),
        color: noirTokens.accent.emerald,
        display: "flex",
        flexDirection: "column",
        height: { xs: 58, sm: 64 },
        justifyContent: "center",
        width: { xs: 58, sm: 64 },
        ...sx,
      }}
    >
      <Typography
        sx={{ fontSize: { xs: 17, sm: 19 }, fontWeight: 880, lineHeight: 1 }}
      >
        {value}
      </Typography>
      <Typography
        sx={{
          color: alpha("#F8FAFC", 0.72),
          fontSize: 8.5,
          fontWeight: 780,
          lineHeight: 1,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function TonightMetaChip({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        backdropFilter: "blur(14px) saturate(1.2)",
        bgcolor: alpha("#FFFFFF", 0.075),
        borderRadius: 999,
        boxShadow: `inset 0 0 0 1px ${alpha("#FFFFFF", 0.075)}`,
        color: alpha("#F8FAFC", 0.82),
        fontSize: 10.5,
        fontWeight: 720,
        lineHeight: 1,
        px: 0.75,
        py: 0.45,
      }}
    >
      {children}
    </Box>
  );
}

function GlassPill({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        backdropFilter: "blur(14px)",
        bgcolor: alpha("#FFFFFF", 0.075),
        border: `1px solid ${alpha("#FFFFFF", 0.09)}`,
        borderRadius: 999,
        color: alpha("#F8FAFC", 0.86),
        fontSize: 10.5,
        fontWeight: 850,
        px: 0.85,
        py: 0.38,
      }}
    >
      {children}
    </Box>
  );
}

function TopPosterTile({ index, item }: { index: number; item: MediaItemDTO }) {
  const releaseYear = releaseYearLabel(item.releaseDate);
  const meta = [shortMediaTypeLabel(item.mediaType), releaseYear].filter(
    Boolean,
  );

  return (
    <Link
      href={`/media/${item.id}`}
      style={{ color: "inherit", display: "block", textDecoration: "none" }}
    >
      <Box
        sx={{
          aspectRatio: "2 / 3",
          borderRadius: "20px",
          minWidth: 0,
          overflow: "hidden",
          position: "relative",
          transform: "translateZ(0)",
          transition: "box-shadow 260ms ease, transform 260ms ease",
          "&:hover": {
            boxShadow: `0 24px 56px ${alpha("#000000", 0.48)}, 0 0 36px ${alpha(noirTokens.accent.purple, 0.2)}, 0 0 44px ${alpha(noirTokens.accent.blue, 0.12)}`,
            transform: "translateY(-6px)",
            "& .tile-poster": {
              transform: "scale(1.07)",
            },
            "& .tile-title": {
              opacity: 1,
              transform: "translateY(0)",
            },
          },
        }}
      >
        <Box
          className="tile-poster"
          sx={{
            backgroundImage: item.posterUrl
              ? `url(${item.posterUrl})`
              : designedPosterFallback(item.mediaType),
            backgroundPosition: "center",
            backgroundSize: "cover",
            inset: 0,
            position: "absolute",
            transformOrigin: "center",
            transition: "transform 620ms cubic-bezier(.2,.8,.2,1)",
          }}
        />
        <Box
          sx={{
            background:
              "linear-gradient(180deg, rgba(5,7,14,0.02) 20%, rgba(5,7,14,0.22) 48%, rgba(5,7,14,0.92) 100%)",
            inset: 0,
            position: "absolute",
          }}
        />
        <Box
          sx={{
            border: `1px solid ${alpha("#FFFFFF", 0.045)}`,
            borderRadius: "20px",
            boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.08)}, inset 0 -60px 80px ${alpha("#000000", 0.18)}`,
            inset: 0,
            pointerEvents: "none",
            position: "absolute",
            zIndex: 3,
          }}
        />
        <Box
          sx={{
            alignItems: "center",
            backdropFilter: "blur(16px) saturate(1.25)",
            bgcolor: alpha("#05070E", 0.48),
            border: `1px solid ${alpha("#FFFFFF", 0.12)}`,
            borderRadius: 999,
            boxShadow: `0 10px 30px ${alpha("#000000", 0.3)}`,
            color: "text.primary",
            display: "flex",
            fontSize: 10,
            fontWeight: 950,
            height: 24,
            justifyContent: "center",
            minWidth: 24,
            px: 0.65,
            position: "absolute",
            right: 8,
            top: 8,
            zIndex: 4,
          }}
        >
          {index + 1}
        </Box>
        {!item.posterUrl ? (
          <Box
            sx={{
              alignItems: "center",
              color: alpha(mediaTypeColor(item.mediaType), 0.82),
              display: "flex",
              inset: 0,
              justifyContent: "center",
              position: "absolute",
              zIndex: 1,
              "& svg": { fontSize: 30 },
            }}
          >
            {mediaTypeIcon(item.mediaType)}
          </Box>
        ) : null}
        <Box
          sx={{
            bottom: 0,
            left: 0,
            p: 0.9,
            position: "absolute",
            right: 0,
            zIndex: 4,
          }}
        >
          <Typography
            className="tile-title"
            sx={{
              color: "text.primary",
              display: "-webkit-box",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 0,
              lineHeight: 1.08,
              opacity: { xs: 1, md: 0.92 },
              overflow: "hidden",
              textShadow: `0 8px 22px ${alpha("#000000", 0.8)}`,
              transform: { xs: "none", md: "translateY(2px)" },
              transition: "opacity 180ms ease, transform 180ms ease",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
            title={item.title}
          >
            {item.title}
          </Typography>
          {meta.length > 0 ? (
            <Typography
              sx={{
                color: alpha("#DCE9F7", 0.72),
                fontSize: 9.5,
                fontWeight: 800,
                letterSpacing: 0,
                lineHeight: 1,
                mt: 0.45,
                textShadow: `0 8px 18px ${alpha("#000000", 0.75)}`,
              }}
            >
              {meta.join(" / ")}
            </Typography>
          ) : null}
        </Box>
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
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))",
        borderRadius: 3,
        display: "grid",
        flex: 1,
        gap: 0.65,
        gridTemplateColumns: `repeat(${Math.max(genres.length, 1)}, minmax(0, 1fr))`,
        minHeight: 188,
        overflow: "hidden",
        px: 1,
        pt: 1.2,
        position: "relative",
        "&::before": {
          background: `radial-gradient(circle at 50% 105%, ${alpha(noirTokens.accent.purple, 0.2)}, transparent 58%)`,
          content: '""',
          inset: 0,
          pointerEvents: "none",
          position: "absolute",
        },
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
                border: `1px solid ${alpha("#FFFFFF", 0.1)}`,
                borderRadius: "999px 999px 0 0",
                boxShadow: `0 0 24px ${alpha(noirTokens.accent.purple, 0.22)}`,
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
  disabledMediaTypes = [],
  onChange,
  showCounts = true,
  sx,
  value,
}: {
  counts: Array<{ mediaType: MediaType; count: number }>;
  disabledMediaTypes?: MediaType[];
  onChange: (value: MediaType) => void;
  showCounts?: boolean;
  sx?: SxProps<Theme>;
  value: MediaType;
}) {
  const countByType = new Map(
    counts.map((entry) => [entry.mediaType, entry.count]),
  );
  const disabledTypes = new Set(disabledMediaTypes);
  const rootSx: SxProps<Theme> = {
    backdropFilter: "blur(18px)",
    bgcolor: alpha("#05070E", 0.42),
    border: `1px solid ${alpha("#FFFFFF", 0.07)}`,
    borderRadius: 999,
    boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.045)}`,
    gap: 0.25,
    p: 0.35,
    "& .MuiToggleButton-root": {
      border: 0,
      borderRadius: 999,
      color: alpha("#E5EEF9", 0.58),
      gap: 0.6,
      minHeight: 30,
      px: 0.95,
      py: 0.45,
      textTransform: "none",
      transition:
        "background-color 180ms ease, color 180ms ease, box-shadow 180ms ease",
      whiteSpace: "nowrap",
      "&.Mui-disabled": {
        color: alpha("#E5EEF9", 0.24),
      },
      "&.Mui-selected": {
        bgcolor: alpha("#FFFFFF", 0.11),
        boxShadow: `0 10px 28px ${alpha("#000000", 0.22)}, inset 0 1px 0 ${alpha("#FFFFFF", 0.08)}`,
        color: "text.primary",
      },
      "&:hover": {
        bgcolor: alpha("#FFFFFF", 0.075),
      },
    },
  };

  return (
    <ToggleButtonGroup
      exclusive
      fullWidth
      onChange={(_, nextValue: MediaType | null) => {
        if (nextValue) onChange(nextValue);
      }}
      size="small"
      sx={mergeSx(rootSx, sx)}
      value={value}
    >
      {dashboardMediaTypes.map((mediaType) => (
        <ToggleButton
          disabled={disabledTypes.has(mediaType)}
          key={mediaType}
          value={mediaType}
        >
          {mediaTypeIcon(mediaType)}
          <Typography component="span" sx={{ fontSize: 11, fontWeight: 800 }}>
            {shortMediaTypeLabel(mediaType)}
          </Typography>
          {showCounts ? (
            <Typography
              color="text.secondary"
              component="span"
              sx={{ fontSize: 10 }}
            >
              {countByType.get(mediaType) ?? 0}
            </Typography>
          ) : null}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function MediaRail({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        alignItems: "stretch",
        display: "grid",
        flex: 1,
        gap: "10px",
        gridAutoColumns: { xs: "min(62vw, 170px)", sm: "auto" },
        gridAutoFlow: { xs: "column", sm: "row" },
        gridTemplateColumns: { xs: "none", sm: "repeat(5, minmax(0, 1fr))" },
        height: "100%",
        maskImage: {
          xs: "linear-gradient(90deg, black calc(100% - 28px), transparent)",
          sm: "none",
        },
        minHeight: { xs: 258, sm: 318, xl: 346 },
        overflowX: { xs: "auto", sm: "hidden" },
        pb: 0.35,
        pt: 0.15,
        scrollSnapType: "x proximity",
        scrollbarWidth: "thin",
        "& > *": {
          height: "100%",
          minWidth: 0,
        },
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
  const releaseYear = releaseYearLabel(item.releaseDate);
  const meta = [
    formatMediaType(item.mediaType),
    releaseYear,
    item.genres[0],
  ].filter(Boolean);

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
          background: "#05070E",
          borderRadius: "20px",
          boxShadow: `0 14px 34px ${alpha("#000000", 0.36)}`,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
          position: "relative",
          scrollSnapAlign: "start",
          transform: "translateZ(0)",
          transition:
            "box-shadow 240ms ease, filter 240ms ease, transform 240ms ease",
          width: "100%",
          "&:hover": {
            boxShadow: `0 24px 56px ${alpha("#000000", 0.5)}, 0 0 34px ${alpha(noirTokens.accent.blue, 0.12)}, 0 0 28px ${alpha(noirTokens.accent.purple, 0.09)}`,
            filter: "saturate(1.04)",
            transform: "translateY(-5px)",
            "& .poster-art": {
              transform: "scale(1.055)",
            },
            "& .poster-sheen": {
              opacity: 0.46,
            },
          },
        }}
      >
        <Box
          className="poster-art"
          sx={{
            bgcolor: alpha(mediaTypeColor(item.mediaType), 0.16),
            backgroundImage: item.posterUrl
              ? `url(${item.posterUrl})`
              : designedPosterFallback(item.mediaType),
            backgroundPosition: "center",
            backgroundSize: "cover",
            inset: 0,
            position: "absolute",
            transformOrigin: "center",
            transition: "transform 520ms cubic-bezier(.2,.8,.2,1)",
          }}
        />
        <Box
          sx={{
            background:
              "linear-gradient(180deg, rgba(5,7,14,0.00) 26%, rgba(5,7,14,0.2) 55%, rgba(5,7,14,0.92) 100%)",
            inset: 0,
            position: "absolute",
          }}
        />
        <Box
          className="poster-sheen"
          sx={{
            background: `linear-gradient(135deg, ${alpha("#FFFFFF", 0.12)} 0%, transparent 30%, transparent 68%, ${alpha(mediaTypeColor(item.mediaType), 0.14)} 100%)`,
            inset: 0,
            opacity: 0.2,
            pointerEvents: "none",
            position: "absolute",
            transition: "opacity 260ms ease",
          }}
        />
        <Box
          sx={{
            border: `1px solid ${alpha("#FFFFFF", 0.035)}`,
            borderRadius: "20px",
            boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.055)}`,
            inset: 0,
            pointerEvents: "none",
            position: "absolute",
            zIndex: 4,
          }}
        />
        <Box
          sx={{
            alignItems: "center",
            backdropFilter: "blur(14px) saturate(1.2)",
            bgcolor: alpha("#06140F", 0.42),
            border: `1px solid ${alpha("#FFFFFF", 0.1)}`,
            borderRadius: 999,
            boxShadow: `0 10px 24px ${alpha("#000000", 0.28)}, 0 0 18px ${alpha(noirTokens.accent.emerald, 0.12)}`,
            color: noirTokens.accent.emerald,
            display: "flex",
            fontSize: 10,
            fontWeight: 820,
            height: 23,
            justifyContent: "center",
            px: 0.65,
            position: "absolute",
            right: 8,
            top: 8,
            zIndex: 2,
          }}
        >
          {Math.round(score)}%
        </Box>
        {!item.posterUrl ? (
          <Box
            sx={{
              alignItems: "center",
              color: alpha(mediaTypeColor(item.mediaType), 0.82),
              display: "flex",
              height: "100%",
              justifyContent: "center",
              position: "relative",
              zIndex: 1,
              "& svg": { fontSize: 30 },
            }}
          >
            {mediaTypeIcon(item.mediaType)}
          </Box>
        ) : null}
        <Box
          sx={{
            bottom: 0,
            left: 0,
            px: 1,
            py: 0.9,
            position: "absolute",
            right: 0,
            zIndex: 2,
          }}
        >
          <Typography
            sx={{
              display: "-webkit-box",
              fontSize: 13,
              fontWeight: 840,
              letterSpacing: 0,
              lineHeight: 1.12,
              overflow: "hidden",
              textShadow: `0 7px 20px ${alpha("#000000", 0.78)}`,
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {item.title}
          </Typography>
          {meta.length > 0 ? (
            <Typography
              sx={{
                color: alpha("#DCE9F7", 0.74),
                fontSize: 10,
                fontWeight: 650,
                letterSpacing: 0,
                lineHeight: 1.15,
                mt: 0.45,
                overflow: "hidden",
                textOverflow: "ellipsis",
                textShadow: `0 6px 14px ${alpha("#000000", 0.72)}`,
                whiteSpace: "nowrap",
              }}
            >
              {meta.join(" / ")}
            </Typography>
          ) : null}
        </Box>
      </Box>
    </Link>
  );
}

function UpcomingRow({ item }: { item: MediaItemDTO }) {
  return (
    <Stack
      direction="row"
      spacing={0.85}
      sx={{
        alignItems: "center",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.018))",
        border: `1px solid ${alpha("#FFFFFF", 0.055)}`,
        borderRadius: 2.5,
        minHeight: 48,
        px: 0.75,
        py: 0.65,
        transition: "background-color 180ms ease, transform 180ms ease",
        "&:hover": {
          bgcolor: alpha("#FFFFFF", 0.055),
          transform: "translateX(3px)",
        },
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          bgcolor: alpha(noirTokens.accent.blue, 0.11),
          border: `1px solid ${alpha(noirTokens.accent.blue, 0.18)}`,
          borderRadius: 2,
          color: noirTokens.accent.blue,
          display: "flex",
          flexShrink: 0,
          height: 30,
          justifyContent: "center",
          width: 30,
        }}
      >
        <CalendarMonthIcon sx={{ fontSize: 16 }} />
      </Box>
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
      <Box sx={{ minWidth: 92, textAlign: "right" }}>
        <Typography
          sx={{ color: "text.primary", fontSize: 11.5, fontWeight: 850 }}
        >
          {item.releaseDate
            ? new Date(item.releaseDate).toLocaleDateString()
            : "-"}
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
        <Button href="/data-health" size="small" sx={premiumPanelActionSx}>
          Review
        </Button>
      }
      accent={noirTokens.accent.amber}
      kicker="System integrity"
      title="Data Health"
    >
      <Box
        sx={{
          display: "grid",
          gap: 0.75,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(5, minmax(0, 1fr))",
          },
        }}
      >
        <HealthPill label="Missing genres" value={health.missingGenres} />
        <HealthPill
          label="Missing release dates"
          value={health.missingReleaseDates}
        />
        <HealthPill label="Missing posters" value={health.missingPosters} />
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
        background: `linear-gradient(135deg, ${alpha(accent, value > 0 ? 0.12 : 0.08)}, ${alpha("#FFFFFF", 0.018)})`,
        border: `1px solid ${alpha(accent, value > 0 ? 0.2 : 0.12)}`,
        borderRadius: 999,
        boxShadow: value > 0 ? `0 0 28px ${alpha(accent, 0.1)}` : "none",
        display: "flex",
        gap: 0.65,
        minHeight: 36,
        px: 1,
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
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))",
          border: `1px solid ${alpha("#FFFFFF", 0.06)}`,
          borderRadius: 3,
          boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.04)}`,
          height: "100%",
          p: 0.8,
          transition: "background-color 180ms ease, transform 180ms ease",
          "&:hover": {
            bgcolor: alpha("#FFFFFF", 0.065),
            transform: "translateX(3px)",
          },
          "& .MuiLinearProgress-root": {
            bgcolor: alpha("#FFFFFF", 0.08),
            borderRadius: 999,
            height: 5,
          },
          "& .MuiLinearProgress-bar": {
            background: `linear-gradient(90deg, ${noirTokens.accent.emerald}, ${noirTokens.accent.blue})`,
            borderRadius: 999,
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
              <GlassPill>{formatMediaType(item.mediaType)}</GlassPill>
              <Typography color="text.secondary" sx={{ fontSize: 10.5 }}>
                {formatStatus(item.status)}
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

function mergeSx(
  base: SxProps<Theme>,
  override?: SxProps<Theme>,
): SxProps<Theme> {
  if (!override) return base;
  return [
    base,
    ...(Array.isArray(override) ? override : [override]),
  ] as SxProps<Theme>;
}

function pickReason(item: MediaItemDTO) {
  const genre = item.genres[0];
  if (genre) {
    return `Because your library points toward ${genre.toLowerCase()} with strong local signals.`;
  }
  return "Because your ratings, rankings, and local signals make this stand out tonight.";
}

function releaseYearLabel(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return String(date.getFullYear());
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

function designedPosterFallback(mediaType: MediaType) {
  const accent = mediaTypeColor(mediaType);
  return [
    `radial-gradient(circle at 22% 16%, ${alpha(accent, 0.34)}, transparent 27%)`,
    `radial-gradient(circle at 72% 8%, ${alpha("#FFFFFF", 0.1)}, transparent 24%)`,
    `linear-gradient(180deg, ${alpha("#FFFFFF", 0.055)}, transparent 34%)`,
    "linear-gradient(145deg, rgba(28, 26, 44, 0.98), rgba(10, 14, 26, 0.99) 52%, rgba(5, 7, 14, 0.99))",
  ].join(", ");
}

function designedHeroFallback(mediaType: MediaType) {
  const accent = mediaTypeColor(mediaType);
  return [
    `radial-gradient(circle at 22% 26%, ${alpha(accent, 0.42)}, transparent 24rem)`,
    `radial-gradient(circle at 78% 18%, ${alpha(noirTokens.accent.blue, 0.16)}, transparent 22rem)`,
    `radial-gradient(circle at 58% 86%, ${alpha(noirTokens.accent.purple, 0.18)}, transparent 26rem)`,
    "linear-gradient(135deg, rgba(20, 24, 42, 0.98), rgba(7, 10, 22, 0.99) 54%, rgba(3, 5, 12, 1))",
  ].join(", ");
}

function shortMediaTypeLabel(mediaType: MediaType) {
  if (mediaType === "TV_SHOW") return "TV";
  if (mediaType === "VIDEO_GAME") return "Games";
  return "Movies";
}
