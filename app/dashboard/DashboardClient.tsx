"use client";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
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
} from "@/components/cinematic/CinematicPrimitives";
import { formatMediaType } from "@/lib/format";
import { statusLabel } from "@/lib/status-labels";
import type { MediaItemDTO } from "@/lib/types";
import { formatUpcomingRelativeLabel } from "@/lib/upcoming";
import { releaseYearLabel } from "@/lib/date-labels";
import {
  ACCENTS,
  mediaAccent,
  mediaTypeIcon,
  posterFallback,
  shortMediaTypeLabel,
} from "@/lib/media-ui-helpers";
import { PosterTile } from "@/components/media/PosterCard";
import { ScoreBadge as PosterScoreBadge } from "@/components/media/ScoreDisplay";
import CollectionsBookmarkIcon from "@mui/icons-material/CollectionsBookmark";
import type { CollectionSummary } from "@/lib/db/collections";

type DashboardData = {
  userName: string | null;
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

export function DashboardClient({
  collections,
  data,
  isAuthenticated,
  isAdmin,
}: {
  collections: CollectionSummary[];
  data: DashboardData;
  isAuthenticated: boolean;
  isAdmin: boolean;
}) {
  // Anonymous viewers see public quality/consensus signals only — match %,
  // confidence %, and personal-status panels (watchlist, comparisons) all
  // depend on a user's taste graph and are hidden when no one is signed in.
  // System integrity is moderation surface area, so it's admin-only.
  const showPersonalSignals = isAuthenticated;
  const showSystemIntegrity = isAdmin;
  const initialTonightPickType =
    dashboardMediaTypes.find((mediaType) =>
      data.tonightPicksByMediaType.some(
        (entry) => entry.mediaType === mediaType && entry.recommendations[0],
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

  const topItems = topItemsForType.slice(0, 10);

  const upcomingItemsForType = useMemo(
    () =>
      data.upcomingItemsByMediaType.find(
        (entry) => entry.mediaType === upcomingMediaType,
      )?.items ?? [],
    [data.upcomingItemsByMediaType, upcomingMediaType],
  );

  const watchlistMatchByMediaId = useMemo(() => {
    const map = new Map<string, number>();
    for (const rec of data.recommendations) {
      map.set(rec.media.id, rec.score);
    }
    return map;
  }, [data.recommendations]);

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
    .slice(0, 5);
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
            {data.userName ? `Welcome back, ${data.userName}` : "Welcome to Medialy"}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
            Your recommendations, watchlist, and library at a glance.
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
          {showPersonalSignals ? (
            <CompactStatCard
              accent={mediaAccent("TV_SHOW")}
              icon={<PlaylistAddCheckIcon fontSize="small" />}
              label="Watchlist"
              value={data.watchlistCount.toLocaleString()}
            />
          ) : null}
          {showPersonalSignals ? (
            <CompactStatCard
              accent={mediaAccent("VIDEO_GAME")}
              icon={<CompareArrowsIcon fontSize="small" />}
              label="Comparisons"
              value={data.comparisonCount.toLocaleString()}
            />
          ) : null}
          {showSystemIntegrity ? (
            <CompactStatCard
              accent={ACCENTS.peach}
              icon={<ReportProblemIcon fontSize="small" />}
              label="Metadata gaps"
              value={data.missingMetadataCount.toLocaleString()}
            />
          ) : null}
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateAreas: {
            xs: [
              `"tonight"`,
              `"top"`,
              `"genre"`,
              showPersonalSignals ? `"watch"` : null,
              `"side"`,
              showSystemIntegrity ? `"health"` : null,
            ]
              .filter(Boolean)
              .join("\n"),
            lg: [
              `"tonight tonight tonight tonight tonight tonight tonight tonight tonight tonight tonight tonight"`,
              `"top top top top top top top top top top top top"`,
              showPersonalSignals
                ? `"genre genre genre genre watch watch watch watch side side side side"`
                : `"genre genre genre genre genre genre side side side side side side"`,
              showSystemIntegrity
                ? `"health health health health health health health health health health health health"`
                : null,
            ]
              .filter(Boolean)
              .join("\n"),
          },
          gridTemplateColumns: { xs: "1fr", lg: "repeat(12, minmax(0, 1fr))" },
        }}
      >
        <Box sx={{ gridArea: "tonight", minWidth: 0 }}>
          {heroRecommendation ? (
            <DiagonalPickStrip
              counts={tonightPickCounts}
              confidence={heroRecommendation.confidence}
              hero={heroRecommendation.media}
              heroScore={heroRecommendation.score}
              onTypeChange={setTonightPickType}
              showMatch={showPersonalSignals}
              upNext={recommendationRailItems.map((r) => ({
                media: r.media,
                score: r.score,
              }))}
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

        <Box sx={{ gridArea: "top", minWidth: 0 }}>
          <DashboardSection
            action={
              <Button
                href={`/canon?type=${topMediaType}`}
                size="small"
                sx={panelActionSx}
              >
                Open Canon
              </Button>
            }
            title="Overall top 10"
          >
            <MediaTypeTabs
              counts={data.mediaTypeCounts}
              onChange={setTopMediaType}
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
                    lg: "repeat(10, minmax(0, 1fr))",
                  },
                  mt: 1.5,
                }}
              >
                {topItems.map((recommendation) => {
                  const releaseYear = releaseYearLabel(
                    recommendation.media.releaseDate,
                  );
                  const meta = [
                    shortMediaTypeLabel(recommendation.media.mediaType),
                    releaseYear,
                  ].filter((value): value is string => Boolean(value));
                  return (
                    <PosterTile
                      item={recommendation.media}
                      key={recommendation.media.id}
                      meta={meta}
                      scoreBadge={
                        typeof recommendation.score === "number" ? (
                          <PosterScoreBadge score={recommendation.score} />
                        ) : undefined
                      }
                    />
                  );
                })}
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
              <Button
                href="/discover/collections"
                size="small"
                sx={panelActionSx}
              >
                Browse all
              </Button>
            }
            title="Featured collections"
          >
            <FeaturedCollectionsPanel collections={collections} />
          </DashboardSection>
        </Box>

        {showPersonalSignals ? (
        <Box sx={{ gridArea: "watch", minWidth: 0 }}>
          <DashboardSection
            action={
              <Button href="/watchlist" size="small" sx={panelActionSx}>
                Open watchlist
              </Button>
            }
            title="Watchlist highlights"
          >
            <Stack spacing={1} sx={{ flex: 1, mt: 0.5 }}>
              {data.watchlistItems.slice(0, 5).map((item) => {
                // Prefer the Medialy Match score (0–100, "how strongly we
                // predict you'll like this"). Fall back to consensus when an
                // item is missing from the rec pool (e.g., release date filter).
                const match = watchlistMatchByMediaId.get(item.id);
                return (
                  <MediaSignalRow
                    href={`/media/${item.id}`}
                    item={item}
                    key={item.id}
                    score={match ?? null}
                    fallbackConsensus={item.computedConsensusScore}
                    compact
                  />
                );
              })}
            </Stack>
          </DashboardSection>
        </Box>
        ) : null}

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

        {showSystemIntegrity ? (
          <Box sx={{ gridArea: "health", minWidth: 0 }}>
            <DataHealthStrip
              duplicateCount={data.duplicateCount}
              health={data.health}
            />
          </Box>
        ) : null}
      </Box>
    </Stack>
  );
}


// Diagonal skew offset (px) applied to each slice's clip-path. Larger = more
// dramatic angle. Slices after the featured one are pulled back by this same
// amount so adjacent diagonals share an edge exactly.
const DIAG_SKEW = 40;

function DiagonalPickStrip({
  counts,
  confidence,
  hero,
  heroScore,
  onTypeChange,
  showMatch,
  upNext,
  value,
}: {
  counts: Array<{ mediaType: MediaType; count: number }>;
  confidence: number;
  hero: MediaItemDTO;
  heroScore: number;
  onTypeChange: (value: MediaType) => void;
  showMatch: boolean;
  upNext: Array<{ media: MediaItemDTO; score: number }>;
  value: MediaType;
}) {
  const heroYear = releaseYearLabel(hero.releaseDate);
  const heroMeta = [
    formatMediaType(hero.mediaType),
    heroYear,
    ...hero.genres.slice(0, 1),
  ].filter((v): v is string => Boolean(v));

  // Clip paths: featured has a straight left edge + diagonal right; up-next
  // slices are parallelograms; the final slice has a diagonal left + straight
  // right. Slice height is `100%` so the offset is purely horizontal.
  const featuredClip = `polygon(0 0, 100% 0, calc(100% - ${DIAG_SKEW}px) 100%, 0 100%)`;
  const middleClip = `polygon(${DIAG_SKEW}px 0, 100% 0, calc(100% - ${DIAG_SKEW}px) 100%, 0 100%)`;
  const lastClip = `polygon(${DIAG_SKEW}px 0, 100% 0, 100% 100%, 0 100%)`;

  const heroAccent = mediaAccent(hero.mediaType);
  return (
    <Box
      component="section"
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "border.subtle",
        borderLeft: `2px solid ${heroAccent}`,
        borderRadius: 3,
        boxShadow: `0 14px 40px rgba(0,0,0,0.5), 0 1px 0 ${alpha("#FFFFFF", 0.04)} inset, -14px 0 56px -22px ${alpha(heroAccent, 0.6)}`,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        height: { xs: "auto", md: 468 },
        minHeight: { xs: 720, md: 468 },
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Featured slice */}
      <Box
        sx={{
          flex: { xs: "1 1 auto", md: "2.4 1 0" },
          height: { xs: 360, md: "100%" },
          minWidth: 0,
          position: "relative",
          clipPath: { xs: "none", md: featuredClip },
          "&:hover .pick-backdrop": { transform: "scale(1.03)" },
        }}
      >
        <SliceBackdrop item={hero} className="pick-backdrop" />
        {/* Dark gradient skewed left so the copy stays legible */}
        <Box
          sx={{
            background:
              "linear-gradient(90deg, rgba(8,8,11,0.92) 0%, rgba(8,8,11,0.72) 45%, rgba(8,8,11,0.18) 80%, rgba(8,8,11,0.45) 100%), linear-gradient(0deg, rgba(8,8,11,0.95) 0%, rgba(8,8,11,0.35) 45%, rgba(8,8,11,0) 100%)",
            inset: 0,
            position: "absolute",
            zIndex: 1,
          }}
        />
        {/* Tabs */}
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
        {showMatch ? (
          <ScoreBadge
            label="Match"
            sx={{
              position: "absolute",
              right: { xs: 16, sm: 64 },
              top: { xs: 16, sm: 18 },
              zIndex: 5,
            }}
            value={`${Math.round(heroScore)}%`}
          />
        ) : null}
        {/* Copy */}
        <Stack
          spacing={1.25}
          sx={{
            bottom: { xs: 20, md: 26 },
            left: { xs: 20, md: 26 },
            maxWidth: { xs: "calc(100% - 40px)", sm: 480 },
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
              fontSize: "clamp(1.75rem, 3.8vw, 3.1rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.02,
            }}
          >
            {hero.title}
          </Typography>
          <Box
            sx={{
              background: `linear-gradient(90deg, ${heroAccent}, ${alpha(heroAccent, 0)})`,
              borderRadius: 1,
              boxShadow: `0 0 16px ${alpha(heroAccent, 0.55)}`,
              height: 3,
              mt: -0.5,
              width: 72,
            }}
          />
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, pt: 0.25 }}>
            {heroMeta.map((entry) => (
              <OnDarkChip key={entry}>{entry}</OnDarkChip>
            ))}
            {showMatch ? (
              <OnDarkChip>{`${Math.round(confidence * 100)}% confidence`}</OnDarkChip>
            ) : null}
          </Stack>
          <Typography
            sx={{
              color: "rgba(255,255,255,0.82)",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              maxWidth: 420,
            }}
          >
            {pickReason(hero)}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, pt: 0.5 }}>
            <Button
              component={Link}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
              href={`/media/${hero.id}`}
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

      {/* Up-next slices */}
      {upNext.map((rec, i) => {
        const isLast = i === upNext.length - 1;
        const clip = isLast ? lastClip : middleClip;
        const sliceAccent = mediaAccent(rec.media.mediaType);
        return (
          <Box
            component={Link}
            href={`/media/${rec.media.id}`}
            key={rec.media.id}
            sx={{
              color: "inherit",
              display: "block",
              flex: { xs: "1 1 auto", md: "1 1 0" },
              height: { xs: 200, md: "100%" },
              marginLeft: { xs: 0, md: `-${DIAG_SKEW}px` },
              minWidth: 0,
              position: "relative",
              textDecoration: "none",
              clipPath: { xs: "none", md: clip },
              transition: "filter 200ms ease",
              "&:hover .upnext-backdrop": { transform: "scale(1.04)" },
              "&:hover .upnext-title-bar": { width: 56 },
              "&:hover": { filter: "brightness(1.08)" },
            }}
          >
            <SliceBackdrop item={rec.media} className="upnext-backdrop" />
            <Box
              sx={{
                background:
                  "linear-gradient(0deg, rgba(8,8,11,0.92) 0%, rgba(8,8,11,0.30) 55%, rgba(8,8,11,0.10) 100%)",
                inset: 0,
                position: "absolute",
                zIndex: 1,
              }}
            />
            {/* Diagonal seam line — sits on the slice's left edge, visible only
                on md+ where the clip-path is active. Slants from (40,0) to (0,h)
                matching the polygon's left edge exactly. */}
            <Box
              aria-hidden
              sx={{
                clipPath: {
                  xs: "none",
                  md: `polygon(${DIAG_SKEW}px 0, ${DIAG_SKEW + 1.5}px 0, 1.5px 100%, 0 100%)`,
                },
                background: `linear-gradient(180deg, ${alpha(sliceAccent, 0.55)} 0%, ${alpha("#FFFFFF", 0.18)} 50%, ${alpha(sliceAccent, 0.55)} 100%)`,
                display: { xs: "none", md: "block" },
                inset: 0,
                position: "absolute",
                zIndex: 2,
              }}
            />
            {showMatch ? (
              <ScoreBadge
                label="Match"
                sx={{
                  position: "absolute",
                  right: 18 + DIAG_SKEW / 2,
                  top: 16,
                  zIndex: 3,
                  height: 44,
                  width: 44,
                }}
                value={`${Math.round(rec.score)}%`}
              />
            ) : null}
            <Stack
              spacing={0.5}
              sx={{
                bottom: 18,
                left: 18 + DIAG_SKEW / 2,
                position: "absolute",
                right: 16,
                zIndex: 3,
              }}
            >
              <Typography
                sx={{
                  color: "#FFFFFF",
                  fontFamily: (theme) => theme.typography.displayHero.fontFamily,
                  fontSize: "clamp(1rem, 1.5vw, 1.5rem)",
                  fontWeight: 650,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.1,
                  textShadow: "0 2px 12px rgba(0,0,0,0.6)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {rec.media.title}
              </Typography>
              <Box
                className="upnext-title-bar"
                sx={{
                  background: `linear-gradient(90deg, ${sliceAccent}, ${alpha(sliceAccent, 0)})`,
                  borderRadius: 1,
                  boxShadow: `0 0 12px ${alpha(sliceAccent, 0.6)}`,
                  height: 2.5,
                  mt: 0.4,
                  transition: "width 250ms cubic-bezier(.2,.8,.2,1)",
                  width: 36,
                }}
              />
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

function SliceBackdrop({
  item,
  className,
}: {
  item: MediaItemDTO;
  className?: string;
}) {
  return (
    <Box
      className={className}
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

function FeaturedCollectionsPanel({
  collections,
}: {
  collections: CollectionSummary[];
}) {
  if (collections.length === 0) {
    return (
      <EmptyPanel
        icon={<CollectionsBookmarkIcon />}
        label="No published collections yet."
      />
    );
  }

  const single = collections.length === 1;
  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        gap: 1.5,
        mt: 0.5,
        overflowX: single ? "visible" : "auto",
        pb: single ? 0 : 0.5,
        scrollbarWidth: "thin",
      }}
    >
      {collections.map((collection) => (
        <CollectionCoverCard
          collection={collection}
          key={collection.id}
          single={single}
        />
      ))}
    </Box>
  );
}

function CollectionCoverCard({
  collection,
  single,
}: {
  collection: CollectionSummary;
  single: boolean;
}) {
  const blurb = collection.description ?? collection.subtitle;
  return (
    <Box
      component={Link}
      href={`/discover/collections/${collection.id}`}
      sx={{
        backgroundColor: "surface.2",
        backgroundImage: collection.coverUrl
          ? `linear-gradient(180deg, rgba(8,8,11,0.15) 0%, rgba(8,8,11,0.55) 55%, rgba(8,8,11,0.92) 100%), url(${collection.coverUrl})`
          : "linear-gradient(140deg, rgba(90,120,200,0.35), rgba(8,8,11,0.92))",
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 2,
        color: "#FFFFFF",
        display: "flex",
        flex: single ? "1 1 auto" : "0 0 auto",
        flexDirection: "column",
        justifyContent: "flex-end",
        minHeight: 176,
        overflow: "hidden",
        p: 1.5,
        position: "relative",
        textDecoration: "none",
        transition: "border-color 160ms ease, transform 160ms ease",
        width: single ? "100%" : 240,
        "&:hover": {
          borderColor: "border.strong",
          transform: "translateY(-2px)",
        },
      }}
    >
      {collection.featuredMonth ? (
        <Chip
          color="secondary"
          label={`Featured · ${collection.featuredMonth}`}
          size="small"
          sx={{ alignSelf: "flex-start", mb: "auto" }}
        />
      ) : null}
      <Typography
        sx={{
          fontFamily: (t) => t.typography.h5.fontFamily,
          fontSize: "1.05rem",
          fontWeight: 700,
          letterSpacing: "-0.015em",
          lineHeight: 1.2,
          textShadow: "0 2px 12px rgba(0,0,0,0.6)",
        }}
      >
        {collection.name}
      </Typography>
      {blurb ? (
        <Typography
          sx={{
            color: "rgba(255,255,255,0.82)",
            display: "-webkit-box",
            fontSize: "0.8rem",
            lineHeight: 1.35,
            mt: 0.5,
            overflow: "hidden",
            textShadow: "0 1px 8px rgba(0,0,0,0.6)",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 3,
          }}
        >
          {blurb}
        </Typography>
      ) : null}
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
        border: "1px solid",
        borderColor: "border.subtle",
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
      {dashboardMediaTypes.map((mediaType) => {
        const accent = mediaAccent(mediaType);
        return (
          <ToggleButton
            disabled={disabledTypes.has(mediaType)}
            key={mediaType}
            value={mediaType}
            sx={{
              borderLeft: `2px solid ${alpha(accent, 0.35)} !important`,
              "& svg": { color: accent },
              "&.Mui-selected": {
                bgcolor: `${alpha(accent, 0.18)} !important`,
                borderLeft: `2px solid ${accent} !important`,
                color: `${accent} !important`,
              },
            }}
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
        );
      })}
    </ToggleButtonGroup>
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
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 2,
        minHeight: 46,
        px: 1.25,
        py: 0.75,
        transition: "border-color 160ms ease",
        "&:hover": {
          borderColor: "border.default",
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
        border: "1px solid",
        borderColor: "border.subtle",
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
        border: "1px dashed",
        borderColor: "border.default",
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
  fallbackConsensus,
}: {
  compact?: boolean;
  href: string;
  item: MediaItemDTO;
  /** 0–100 Medialy Match score. `null` when the item isn't in the rec pool. */
  score: number | null;
  /** 0–10 critic consensus to show when no match score is available. */
  fallbackConsensus?: number | null;
}) {
  // Two presentations: match score shows "82%" with a bar at 82/100; consensus
  // fallback shows "8.2" with the bar at 82. Either way the bar uses 0–100.
  const usingMatch = score != null;
  const displayValue = usingMatch
    ? `${Math.round(score)}%`
    : typeof fallbackConsensus === "number"
      ? fallbackConsensus.toFixed(1)
      : "—";
  const normalized = usingMatch
    ? Math.min(100, Math.max(0, Math.round(score)))
    : typeof fallbackConsensus === "number"
      ? Math.min(100, Math.max(0, Math.round(fallbackConsensus * 10)))
      : 0;
  const scoreLabel = usingMatch ? "Match" : "Critics";

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
          border: "1px solid",
        borderColor: "border.subtle",
          borderRadius: 2,
          p: 1.25,
          transition: "border-color 160ms ease",
          "&:hover": {
            borderColor: "border.default",
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
                {scoreLabel}
              </Typography>
              <Typography sx={{ fontSize: "0.625rem", fontWeight: 600 }}>
                {displayValue}
              </Typography>
            </Stack>
            <LinearProgress value={normalized} variant="determinate" />
          </Box>
        </Stack>
      </Box>
    </Link>
  );
}

function pickReason(item: MediaItemDTO) {
  const genre = item.genres[0];
  if (genre) {
    return `Because you've rated ${genre.toLowerCase()} highly in your library.`;
  }
  return "Because your ratings and rankings make this stand out tonight.";
}
