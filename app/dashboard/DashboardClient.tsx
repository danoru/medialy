"use client";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
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
  IconButton,
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
} from "@/components/cinematic/CinematicPrimitives";
import { formatMediaType } from "@/lib/format";
import { statusLabel } from "@/lib/status-labels";
import type { FriendCompatibility, MediaItemDTO } from "@/lib/types";
import { formatUpcomingRelativeLabel } from "@/lib/upcoming";

type DashboardData = {
  userName: string;
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
    recommendations: Array<{
      media: MediaItemDTO;
      score: number;
      confidence: number;
    }>;
  }>;
  genreInsights: Array<{
    mediaType: MediaType;
    totalCount: number;
    completedCount: number;
    ratedCount: number;
    genres: Array<{
      name: string;
      count: number;
      completedCount: number;
      ratedCount: number;
      averageScore: number;
      share: number;
      needsData: boolean;
    }>;
  }>;
  mediaTypeCounts: Array<{ mediaType: MediaType; count: number }>;
  topItemsByMediaType: Array<{
    mediaType: MediaType;
    items: Array<{
      media: MediaItemDTO;
      score: number;
    }>;
  }>;
  personalTopItemsByMediaType: Array<{
    mediaType: MediaType;
    items: MediaItemDTO[];
  }>;
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

const panelActionSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.75rem",
  fontWeight: 550,
  minHeight: 26,
  px: 1,
  "&:hover": { color: "text.primary" },
};

export function DashboardClient({ data }: { data: DashboardData }) {
  const initialTonightPickType =
    dashboardMediaTypes.find((mediaType) =>
      data.tonightPicksByMediaType.some(
        (entry) => entry.mediaType === mediaType && entry.recommendations[0],
      ),
    ) ?? "MOVIE";
  const [topMediaType, setTopMediaType] = useState<MediaType>("MOVIE");
  const [topPage, setTopPage] = useState(0);
  const [genreMediaType, setGenreMediaType] = useState<MediaType>("MOVIE");
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

  const TOP_PAGE_SIZE = 5;
  const topItems = topItemsForType.slice(0, 10);
  const topPageCount = Math.max(1, Math.ceil(topItems.length / TOP_PAGE_SIZE));
  const safeTopPage = Math.min(topPage, topPageCount - 1);
  const topItemsPage = topItems.slice(
    safeTopPage * TOP_PAGE_SIZE,
    safeTopPage * TOP_PAGE_SIZE + TOP_PAGE_SIZE,
  );

  const upcomingItemsForType = useMemo(
    () =>
      data.upcomingItemsByMediaType.find(
        (entry) => entry.mediaType === upcomingMediaType,
      )?.items ?? [],
    [data.upcomingItemsByMediaType, upcomingMediaType],
  );

  const genreInsightsForType = useMemo(
    () =>
      data.genreInsights.find((entry) => entry.mediaType === genreMediaType)
        ?.genres ?? [],
    [data.genreInsights, genreMediaType],
  );

  const tonightPicksByType = useMemo(() => {
    const picks = new Map<MediaType, DashboardRecommendation>();

    for (const entry of data.tonightPicksByMediaType) {
      if (
        entry.recommendations.length === 0 ||
        !dashboardMediaTypes.includes(entry.mediaType)
      ) {
        continue;
      }

      picks.set(entry.mediaType, entry.recommendations[0]);
    }

    return picks;
  }, [data.tonightPicksByMediaType]);

  const tonightRecommendationsForType =
    data.tonightPicksByMediaType.find(
      (entry) => entry.mediaType === tonightPickType,
    )?.recommendations ?? [];
  const heroRecommendation = tonightPicksByType.get(tonightPickType);
  const recommendationRailItems = tonightRecommendationsForType
    .filter(
      (recommendation) =>
        recommendation.media.id !== heroRecommendation?.media.id,
    )
    .slice(0, 4);
  const tonightPickCounts = dashboardMediaTypes.map((mediaType) => ({
    mediaType,
    count: tonightPicksByType.has(mediaType) ? 1 : 0,
  }));

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        sx={{ alignItems: { lg: "flex-end" }, gap: 2 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="eyebrow" sx={{ display: "block", mb: 0.75 }}>
            Dashboard
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
            Welcome back, {data.userName}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
            Recommendations, watchlist, and library signals at a glance.
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
            accent={mediaAccent("MOVIE")}
            icon={<LibraryBooksIcon fontSize="small" />}
            label="Total items"
            value={data.totalItems.toLocaleString()}
          />
          <CompactStatCard
            accent={mediaAccent("TV_SHOW")}
            icon={<PlaylistAddCheckIcon fontSize="small" />}
            label="Watchlist"
            value={data.watchlistCount.toLocaleString()}
          />
          <CompactStatCard
            accent={mediaAccent("VIDEO_GAME")}
            icon={<CompareArrowsIcon fontSize="small" />}
            label="Comparisons"
            value={data.comparisonCount.toLocaleString()}
          />
          <CompactStatCard
            accent="#D97706"
            icon={<ReportProblemIcon fontSize="small" />}
            label="Metadata gaps"
            value={data.missingMetadataCount.toLocaleString()}
          />
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
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
              onTypeChange={setTonightPickType}
              score={heroRecommendation.score}
              value={tonightPickType}
            />
          ) : (
            <DashboardSection title="Tonight's pick">
              <EmptyPanel
                icon={<AutoAwesomeIcon />}
                label="Add ratings to unlock a featured recommendation."
              />
            </DashboardSection>
          )}
        </Box>

        <Box sx={{ gridArea: "recs", minWidth: 0 }}>
          <DashboardSection
            action={
              <Button href="/recommendations" size="small" sx={panelActionSx}>
                View all
              </Button>
            }
            title={`${shortMediaTypeLabel(tonightPickType)} up next`}
          >
            {recommendationRailItems.length > 0 ? (
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
            ) : (
              <EmptyPanel
                icon={<AutoAwesomeIcon />}
                label={`No additional ${formatMediaType(tonightPickType).toLowerCase()} recommendations yet.`}
              />
            )}
          </DashboardSection>
        </Box>

        <Box sx={{ gridArea: "top", minWidth: 0 }}>
          <DashboardSection
            action={
              <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                {topPageCount > 1 ? (
                  <>
                    <IconButton
                      aria-label="Previous"
                      disabled={safeTopPage === 0}
                      onClick={() =>
                        setTopPage((page) => Math.max(0, page - 1))
                      }
                      size="small"
                      sx={{ height: 26, width: 26 }}
                    >
                      <ChevronLeftIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Typography
                      sx={{
                        color: "text.secondary",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        minWidth: 28,
                        textAlign: "center",
                      }}
                    >
                      {safeTopPage + 1}/{topPageCount}
                    </Typography>
                    <IconButton
                      aria-label="Next"
                      disabled={safeTopPage >= topPageCount - 1}
                      onClick={() =>
                        setTopPage((page) =>
                          Math.min(topPageCount - 1, page + 1),
                        )
                      }
                      size="small"
                      sx={{ height: 26, width: 26 }}
                    >
                      <ChevronRightIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </>
                ) : null}
                <Button href="/discover" size="small" sx={panelActionSx}>
                  Open lists
                </Button>
              </Stack>
            }
            title="Overall top 10"
          >
            <MediaTypeTabs
              counts={data.mediaTypeCounts}
              onChange={(value) => {
                setTopMediaType(value);
                setTopPage(0);
              }}
              showCounts={false}
              value={topMediaType}
            />
            {topItemsForType.length > 0 ? (
              <Box
                sx={{
                  alignContent: "center",
                  display: "grid",
                  flex: 1,
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    sm: "repeat(5, minmax(0, 1fr))",
                  },
                  mt: 1.5,
                }}
              >
                {topItemsPage.map((recommendation) => (
                  <TopPosterTile
                    item={recommendation.media}
                    key={recommendation.media.id}
                    score={recommendation.score}
                  />
                ))}
              </Box>
            ) : (
              <EmptyPanel
                icon={<PlaylistAddCheckIcon />}
                label={`No ${formatMediaType(topMediaType).toLowerCase()} items yet.`}
              />
            )}
          </DashboardSection>
        </Box>

        <Box sx={{ gridArea: "genre", minWidth: 0 }}>
          <DashboardSection
            action={
              <Button href="/insights" size="small" sx={panelActionSx}>
                View insights
              </Button>
            }
            title="Media breakdown"
          >
            <MediaTypeTabs
              counts={data.mediaTypeCounts}
              onChange={setGenreMediaType}
              showCounts={false}
              value={genreMediaType}
            />
            {genreInsightsForType.some((genre) => genre.ratedCount > 0) ? (
              <GenreBarChart
                genres={genreInsightsForType
                  .filter((genre) => genre.ratedCount > 0)
                  .slice(0, 7)}
              />
            ) : (
              <EmptyPanel
                icon={<InfoOutlinedIcon />}
                label={`No rated ${formatMediaType(genreMediaType).toLowerCase()} genres yet.`}
              />
            )}
          </DashboardSection>
        </Box>

        <Box sx={{ gridArea: "watch", minWidth: 0 }}>
          <DashboardSection
            action={
              <Button href="/watchlist" size="small" sx={panelActionSx}>
                Open watchlist
              </Button>
            }
            title="Watchlist signals"
          >
            <Stack spacing={1} sx={{ flex: 1, mt: 0.5 }}>
              {data.watchlistItems.slice(0, 5).map((item) => (
                <MediaSignalRow
                  href={`/media/${item.id}`}
                  item={item}
                  key={item.id}
                  score={item.computedPersonalScore ?? item.pairwiseScore / 100}
                  compact
                />
              ))}
            </Stack>
          </DashboardSection>
        </Box>

        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridArea: "side",
            minWidth: 0,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <DashboardSection
              action={
                <Button href="/upcoming" size="small" sx={panelActionSx}>
                  Open upcoming
                </Button>
              }
              title="Upcoming releases"
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
                <Stack spacing={1} sx={{ mt: 1.5 }}>
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
            </DashboardSection>
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
  onTypeChange,
  score,
  value,
}: {
  counts: Array<{ mediaType: MediaType; count: number }>;
  confidence: number;
  item: MediaItemDTO;
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
        bgcolor: "background.paper",
        border: (theme) => `1px solid ${theme.palette.border.subtle}`,
        borderRadius: 3,
        height: { xs: 420, md: 468 },
        overflow: "hidden",
        position: "relative",
        "&:hover .tonight-backdrop": { transform: "scale(1.03)" },
      }}
    >
      <Box
        className="tonight-backdrop"
        sx={{
          backgroundImage: item.posterUrl
            ? `url(${item.posterUrl})`
            : posterFallback(item.mediaType),
          backgroundPosition: "center",
          backgroundSize: "cover",
          inset: 0,
          position: "absolute",
          transition: "transform 700ms cubic-bezier(.2,.8,.2,1)",
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          background:
            "linear-gradient(90deg, rgba(8,8,11,0.92) 0%, rgba(8,8,11,0.7) 42%, rgba(8,8,11,0.15) 72%, rgba(8,8,11,0.4) 100%), linear-gradient(0deg, rgba(8,8,11,0.95) 0%, rgba(8,8,11,0.4) 42%, rgba(8,8,11,0.05) 100%)",
          inset: 0,
          position: "absolute",
          zIndex: 1,
        }}
      />
      <Box
        sx={{
          left: { xs: 16, sm: 20 },
          maxWidth: { xs: "calc(100% - 96px)", sm: 420 },
          position: "absolute",
          top: { xs: 16, sm: 18 },
          zIndex: 5,
        }}
      >
        <MediaTypeTabs
          counts={counts}
          disabledMediaTypes={counts
            .filter((entry) => entry.count === 0)
            .map((entry) => entry.mediaType)}
          onChange={onTypeChange}
          onDark
          showCounts={false}
          value={value}
        />
      </Box>
      <ScoreBadge
        label="Match"
        sx={{
          position: "absolute",
          right: { xs: 16, sm: 20 },
          top: { xs: 16, sm: 18 },
          zIndex: 5,
        }}
        value={`${Math.round(score)}%`}
      />
      <Stack
        spacing={1.25}
        sx={{
          bottom: { xs: 20, md: 26 },
          left: { xs: 20, md: 26 },
          maxWidth: { xs: "calc(100% - 40px)", sm: 600 },
          position: "absolute",
          right: { xs: 20, sm: "auto" },
          zIndex: 4,
        }}
      >
        <Typography
          sx={{
            color: "rgba(255,255,255,0.72)",
            fontSize: "0.6875rem",
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Tonight&apos;s pick
        </Typography>
        <Typography
          component="h2"
          sx={{
            color: "#FFFFFF",
            fontFamily: (theme) => theme.typography.displayHero.fontFamily,
            fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.02,
          }}
        >
          {item.title}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, pt: 0.25 }}>
          {heroMeta.map((entry) => (
            <OnDarkChip key={entry}>{entry}</OnDarkChip>
          ))}
          <OnDarkChip>{`${Math.round(confidence * 100)}% confidence`}</OnDarkChip>
        </Stack>
        <Typography
          sx={{
            color: "rgba(255,255,255,0.82)",
            fontSize: "0.875rem",
            lineHeight: 1.5,
            maxWidth: 480,
          }}
        >
          {pickReason(item)}
        </Typography>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, pt: 0.5 }}>
          <Button
            component={Link}
            endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
            href={`/media/${item.id}`}
            size="small"
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
              bgcolor: "rgba(255,255,255,0.1)",
              color: "#FFFFFF",
              "&:hover": { bgcolor: "rgba(255,255,255,0.18)" },
            }}
          >
            Why this pick?
          </Button>
        </Stack>
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
        bgcolor: "rgba(8,8,11,0.55)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.16)",
        borderRadius: 2,
        color: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        height: { xs: 52, sm: 56 },
        justifyContent: "center",
        width: { xs: 52, sm: 56 },
        ...sx,
      }}
    >
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography
        sx={{
          color: "rgba(255,255,255,0.7)",
          fontSize: "0.625rem",
          fontWeight: 550,
          lineHeight: 1,
          mt: 0.25,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function OnDarkChip({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: "rgba(255,255,255,0.12)",
        borderRadius: 1.5,
        color: "rgba(255,255,255,0.92)",
        fontSize: "0.6875rem",
        fontWeight: 550,
        lineHeight: 1,
        px: 1,
        py: 0.6,
      }}
    >
      {children}
    </Box>
  );
}

function TopPosterTile({
  item,
  score,
}: {
  item: MediaItemDTO;
  score?: number;
}) {
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
          bgcolor: "surface.2",
          border: (theme) => `1px solid ${theme.palette.border.subtle}`,
          borderRadius: 2,
          minWidth: 0,
          overflow: "hidden",
          position: "relative",
          transition: "transform 200ms ease, border-color 200ms ease",
          "&:hover": {
            borderColor: (theme) => theme.palette.border.strong,
            transform: "translateY(-3px)",
            "& .tile-poster": { transform: "scale(1.06)" },
          },
        }}
      >
        <Box
          className="tile-poster"
          sx={{
            backgroundImage: item.posterUrl
              ? `url(${item.posterUrl})`
              : posterFallback(item.mediaType),
            backgroundPosition: "center",
            backgroundSize: "cover",
            inset: 0,
            position: "absolute",
            transition: "transform 500ms cubic-bezier(.2,.8,.2,1)",
          }}
        />
        <Box
          sx={{
            background:
              "linear-gradient(180deg, transparent 35%, rgba(8,8,11,0.45) 62%, rgba(8,8,11,0.92) 100%)",
            inset: 0,
            position: "absolute",
          }}
        />
        {typeof score === "number" ? (
          <Box
            sx={{
              bgcolor: "rgba(8,8,11,0.6)",
              backdropFilter: "blur(6px)",
              borderRadius: 1,
              color: "#FFFFFF",
              fontSize: "0.625rem",
              fontWeight: 700,
              px: 0.75,
              py: 0.35,
              position: "absolute",
              right: 6,
              top: 6,
              zIndex: 3,
            }}
          >
            {formatDashboardScore(score)}
          </Box>
        ) : null}
        {!item.posterUrl ? (
          <Box
            sx={{
              alignItems: "center",
              color: alpha(mediaAccent(item.mediaType), 0.9),
              display: "flex",
              inset: 0,
              justifyContent: "center",
              position: "absolute",
              zIndex: 1,
              "& svg": { fontSize: 28 },
            }}
          >
            {mediaTypeIcon(item.mediaType)}
          </Box>
        ) : null}
        <Box
          sx={{
            bottom: 0,
            left: 0,
            p: 1,
            position: "absolute",
            right: 0,
            zIndex: 3,
          }}
        >
          <Typography
            sx={{
              color: "#FFFFFF",
              display: "-webkit-box",
              fontSize: "0.75rem",
              fontWeight: 600,
              lineHeight: 1.15,
              overflow: "hidden",
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
                color: "rgba(255,255,255,0.7)",
                fontSize: "0.625rem",
                fontWeight: 500,
                lineHeight: 1,
                mt: 0.5,
              }}
            >
              {meta.join(" · ")}
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
    ratedCount: number;
    share: number;
  }>;
}) {
  const maxScore = Math.max(10, ...genres.map((genre) => genre.averageScore));

  return (
    <Box
      sx={{
        alignItems: "end",
        bgcolor: "surface.1",
        border: (theme) => `1px solid ${theme.palette.border.subtle}`,
        borderRadius: 2,
        display: "grid",
        flex: 1,
        gap: 1,
        gridTemplateColumns: `repeat(${Math.max(genres.length, 1)}, minmax(0, 1fr))`,
        minHeight: 188,
        mt: 1.5,
        overflow: "hidden",
        px: 1.5,
        pt: 1.5,
      }}
    >
      {genres.map((genre) => {
        const height = Math.max(
          16,
          Math.round((genre.averageScore / maxScore) * 128),
        );

        return (
          <Stack
            key={genre.name}
            spacing={0.5}
            sx={{ alignItems: "center", justifyContent: "end", minWidth: 0 }}
          >
            <Typography
              sx={{ fontSize: "0.625rem", fontWeight: 600 }}
            >
              {genre.averageScore.toFixed(1)}
            </Typography>
            <Box
              sx={{
                bgcolor: "primary.main",
                borderRadius: "4px 4px 0 0",
                height,
                width: "56%",
              }}
            />
            <Typography
              noWrap
              color="text.secondary"
              sx={{ fontSize: "0.625rem", maxWidth: "100%" }}
              title={genre.name}
            >
              {genre.name}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: "0.5625rem" }}>
              {genre.ratedCount}
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
  onDark = false,
  showCounts = true,
  value,
}: {
  counts: Array<{ mediaType: MediaType; count: number }>;
  disabledMediaTypes?: MediaType[];
  onChange: (value: MediaType) => void;
  onDark?: boolean;
  showCounts?: boolean;
  value: MediaType;
}) {
  const countByType = new Map(
    counts.map((entry) => [entry.mediaType, entry.count]),
  );
  const disabledTypes = new Set(disabledMediaTypes);

  const rootSx: SxProps<Theme> = onDark
    ? {
        alignSelf: "flex-start",
        bgcolor: "rgba(8,8,11,0.5)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 2,
        display: "inline-flex",
        gap: 0.25,
        p: 0.35,
        width: "max-content",
        "& .MuiToggleButton-root": {
          border: 0,
          borderRadius: 1.5,
          color: "rgba(255,255,255,0.7)",
          gap: 0.6,
          minHeight: 28,
          px: 1,
          py: 0.4,
          textTransform: "none",
          whiteSpace: "nowrap",
          "&.Mui-disabled": { color: "rgba(255,255,255,0.28)" },
          "&.Mui-selected": {
            bgcolor: "rgba(255,255,255,0.18)",
            color: "#FFFFFF",
            "&:hover": { bgcolor: "rgba(255,255,255,0.24)" },
          },
        },
      }
    : {
        alignSelf: "flex-start",
        bgcolor: "surface.1",
        border: (theme) => `1px solid ${theme.palette.border.subtle}`,
        borderRadius: 2,
        display: "inline-flex",
        gap: 0.25,
        p: 0.35,
        width: "max-content",
        "& .MuiToggleButton-root": {
          border: 0,
          borderRadius: 1.5,
          color: "text.secondary",
          gap: 0.6,
          minHeight: 28,
          px: 1,
          py: 0.4,
          textTransform: "none",
          whiteSpace: "nowrap",
          "&.Mui-disabled": { color: "text.disabled" },
          "&.Mui-selected": {
            bgcolor: "background.paper",
            color: "text.primary",
            boxShadow: (theme) => theme.shadows[1],
            "&:hover": { bgcolor: "background.paper" },
          },
        },
      };

  return (
    <ToggleButtonGroup
      exclusive
      onChange={(_, nextValue: MediaType | null) => {
        if (nextValue) onChange(nextValue);
      }}
      size="small"
      sx={rootSx}
      value={value}
    >
      {dashboardMediaTypes.map((mediaType) => (
        <ToggleButton
          disabled={disabledTypes.has(mediaType)}
          key={mediaType}
          value={mediaType}
        >
          {mediaTypeIcon(mediaType)}
          <Typography
            component="span"
            sx={{ fontSize: "0.75rem", fontWeight: 550 }}
          >
            {shortMediaTypeLabel(mediaType)}
          </Typography>
          {showCounts ? (
            <Typography
              component="span"
              sx={{ fontSize: "0.6875rem", opacity: 0.7 }}
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
        gap: 1.25,
        gridAutoColumns: { xs: "min(42vw, 138px)", sm: "auto" },
        gridAutoFlow: { xs: "column", md: "row" },
        gridTemplateColumns: { xs: "none", md: "repeat(4, minmax(0, 1fr))" },
        height: "100%",
        minHeight: { xs: 248, sm: 308, xl: 336 },
        mt: 1.5,
        overflowX: { xs: "auto", md: "hidden" },
        pb: 0.5,
        scrollSnapType: "x proximity",
        scrollbarWidth: "thin",
        "& > *": { height: "100%", minWidth: 0 },
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
          bgcolor: "surface.2",
          border: (theme) => `1px solid ${theme.palette.border.subtle}`,
          borderRadius: 2,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          overflow: "hidden",
          position: "relative",
          scrollSnapAlign: "start",
          transition: "transform 200ms ease, border-color 200ms ease",
          width: "100%",
          "&:hover": {
            borderColor: (theme) => theme.palette.border.strong,
            transform: "translateY(-3px)",
            "& .poster-art": { transform: "scale(1.05)" },
          },
        }}
      >
        <Box
          className="poster-art"
          sx={{
            backgroundImage: item.posterUrl
              ? `url(${item.posterUrl})`
              : posterFallback(item.mediaType),
            backgroundPosition: "center",
            backgroundSize: "cover",
            inset: 0,
            position: "absolute",
            transition: "transform 500ms cubic-bezier(.2,.8,.2,1)",
          }}
        />
        <Box
          sx={{
            background:
              "linear-gradient(180deg, transparent 40%, rgba(8,8,11,0.4) 64%, rgba(8,8,11,0.92) 100%)",
            inset: 0,
            position: "absolute",
          }}
        />
        <Box
          sx={{
            bgcolor: "rgba(8,8,11,0.6)",
            backdropFilter: "blur(6px)",
            borderRadius: 1,
            color: "#FFFFFF",
            fontSize: "0.625rem",
            fontWeight: 700,
            px: 0.75,
            py: 0.35,
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
              color: alpha(mediaAccent(item.mediaType), 0.9),
              display: "flex",
              height: "100%",
              justifyContent: "center",
              position: "relative",
              zIndex: 1,
              "& svg": { fontSize: 28 },
            }}
          >
            {mediaTypeIcon(item.mediaType)}
          </Box>
        ) : null}
        <Box
          sx={{
            bottom: 0,
            left: 0,
            px: 1.25,
            py: 1,
            position: "absolute",
            right: 0,
            zIndex: 2,
          }}
        >
          <Typography
            sx={{
              color: "#FFFFFF",
              display: "-webkit-box",
              fontSize: "0.8125rem",
              fontWeight: 600,
              lineHeight: 1.15,
              overflow: "hidden",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {item.title}
          </Typography>
          {meta.length > 0 ? (
            <Typography
              noWrap
              sx={{
                color: "rgba(255,255,255,0.7)",
                fontSize: "0.625rem",
                fontWeight: 500,
                lineHeight: 1.2,
                mt: 0.5,
              }}
            >
              {meta.join(" · ")}
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
      spacing={1.25}
      sx={{
        alignItems: "center",
        bgcolor: "surface.1",
        border: (theme) => `1px solid ${theme.palette.border.subtle}`,
        borderRadius: 2,
        minHeight: 46,
        px: 1.25,
        py: 0.75,
        transition: "border-color 160ms ease",
        "&:hover": {
          borderColor: (theme) => theme.palette.border.default,
        },
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
          borderRadius: 1.5,
          color: "primary.main",
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
            sx={{ color: "text.primary", fontSize: "0.8125rem", fontWeight: 550 }}
          >
            {item.title}
          </Typography>
        </Link>
      </Box>
      <Box sx={{ minWidth: 92, textAlign: "right" }}>
        <Typography
          sx={{ color: "text.primary", fontSize: "0.75rem", fontWeight: 600 }}
        >
          {item.releaseDate
            ? new Date(item.releaseDate).toLocaleDateString()
            : "-"}
        </Typography>
        {item.releaseDate ? (
          <Typography color="text.secondary" sx={{ fontSize: "0.6875rem" }}>
            {formatUpcomingRelativeLabel(item.releaseDate)}
          </Typography>
        ) : null}
      </Box>
    </Stack>
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
        <Button href="/data-health" size="small" sx={panelActionSx}>
          Review
        </Button>
      }
      title="System integrity"
    >
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(5, minmax(0, 1fr))",
          },
          mt: 0.5,
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
  return (
    <Box
      sx={{
        alignItems: "center",
        bgcolor: "surface.1",
        border: (theme) => `1px solid ${theme.palette.border.subtle}`,
        borderRadius: 2,
        display: "flex",
        gap: 1,
        minHeight: 38,
        px: 1.25,
      }}
    >
      <CheckCircleIcon
        sx={{
          color: value > 0 ? "warning.main" : "success.main",
          fontSize: 16,
        }}
      />
      <Typography
        noWrap
        color="text.secondary"
        sx={{ flex: 1, fontSize: "0.75rem", minWidth: 0 }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          color: value > 0 ? "warning.main" : "success.main",
          fontSize: "0.8125rem",
          fontWeight: 700,
        }}
      >
        {value.toLocaleString()}
      </Typography>
    </Box>
  );
}

function EmptyPanel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Stack
      spacing={1}
      sx={{
        alignItems: "center",
        bgcolor: "surface.1",
        border: (theme) => `1px dashed ${theme.palette.border.default}`,
        borderRadius: 2,
        color: "text.secondary",
        flex: 1,
        justifyContent: "center",
        mt: 1,
        py: 3,
      }}
    >
      {icon}
      <Typography sx={{ fontSize: "0.8125rem" }}>{label}</Typography>
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
        textDecoration: "none",
      }}
    >
      <Box
        sx={{
          bgcolor: "surface.1",
          border: (theme) => `1px solid ${theme.palette.border.subtle}`,
          borderRadius: 2,
          p: 1.25,
          transition: "border-color 160ms ease",
          "&:hover": {
            borderColor: (theme) => theme.palette.border.default,
          },
          "& .MuiLinearProgress-root": {
            bgcolor: (theme) => alpha(theme.palette.text.primary, 0.08),
            borderRadius: 5,
            height: 5,
          },
          "& .MuiLinearProgress-bar": {
            bgcolor: "primary.main",
            borderRadius: 5,
          },
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { sm: "center" } }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              noWrap
              sx={{ fontSize: "0.8125rem", fontWeight: 600 }}
            >
              {item.title}
            </Typography>
            <Stack
              direction="row"
              sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.75, mt: 0.5 }}
            >
              <Chip
                label={formatMediaType(item.mediaType)}
                size="small"
                variant="outlined"
              />
              <Typography color="text.secondary" sx={{ fontSize: "0.6875rem" }}>
                {statusLabel(item.status, item.mediaType)}
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
                mb: 0.5,
              }}
            >
              <Typography color="text.secondary" sx={{ fontSize: "0.625rem" }}>
                Score
              </Typography>
              <Typography sx={{ fontSize: "0.625rem", fontWeight: 600 }}>
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

// Mode-agnostic accent hues per media type — readable on both light and
// dark surfaces.
function mediaAccent(mediaType: MediaType) {
  if (mediaType === "TV_SHOW") return "#0EA5A4";
  if (mediaType === "VIDEO_GAME") return "#D97706";
  return "#6366F1";
}

function posterFallback(mediaType: MediaType) {
  const accent = mediaAccent(mediaType);
  return `linear-gradient(150deg, ${alpha(accent, 0.45)}, ${alpha(accent, 0.12)} 55%, rgba(8,8,11,0.85))`;
}

function shortMediaTypeLabel(mediaType: MediaType) {
  if (mediaType === "TV_SHOW") return "TV";
  if (mediaType === "VIDEO_GAME") return "Games";
  return "Movies";
}
