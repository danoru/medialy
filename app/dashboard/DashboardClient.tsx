"use client";

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
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { MediaType } from "@prisma/client";
import Link from "next/link";
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

  return (
    <Stack spacing={2}>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            color="#5b8cff"
            icon={<LibraryBooksIcon />}
            label="Library items"
            value={data.totalItems.toLocaleString()}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            color="#25d0b2"
            icon={<PlaylistAddCheckIcon />}
            label="Watchlist"
            value={data.watchlistCount.toLocaleString()}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            color="#8c6bff"
            icon={<CompareArrowsIcon />}
            label="Comparisons"
            value={data.comparisonCount.toLocaleString()}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            color="#ffb13d"
            icon={<ReportProblemIcon />}
            label="Needs metadata"
            value={data.missingMetadataCount.toLocaleString()}
          />
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <DashboardCard
            action={
              <Button href="/recommendations" size="small">
                View all
              </Button>
            }
            title="Recommended Next"
          >
            <Box
              sx={{
                display: "grid",
                gap: 1.25,
                gridAutoColumns: {
                  xs: "minmax(168px, 72vw)",
                  sm: "minmax(180px, 1fr)",
                },
                gridAutoFlow: "column",
                overflowX: "auto",
                pb: 0.5,
                scrollSnapType: "x proximity",
              }}
            >
              {data.recommendations.map((recommendation) => (
                <RecommendationPosterCard
                  href={`/media/${recommendation.media.id}`}
                  item={recommendation.media}
                  key={recommendation.media.id}
                  score={recommendation.score}
                />
              ))}
            </Box>
          </DashboardCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
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
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {topItemsForType.map((item, index) => (
                  <TopRankedRow index={index} item={item} key={item.id} />
                ))}
              </Stack>
            ) : (
              <EmptyPanel
                icon={<PlaylistAddCheckIcon />}
                label={`No completed ${formatMediaType(topMediaType).toLowerCase()} ranked yet.`}
              />
            )}
          </DashboardCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <DashboardCard
            action={
              <Button href="/media" size="small">
                Browse
              </Button>
            }
            title="Collection Mix"
          >
            <Stack spacing={1.25}>
              {data.mediaTypeCounts.map((entry) => (
                <CollectionTypeRow
                  count={entry.count}
                  key={entry.mediaType}
                  mediaType={entry.mediaType}
                  total={data.totalItems}
                />
              ))}
            </Stack>
          </DashboardCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <DashboardCard
            action={
              <Button href="/insights" size="small">
                View insights
              </Button>
            }
            title="Genre Insights"
          >
            <Stack spacing={1.2}>
              {data.genreInsights.slice(0, 6).map((genre) => (
                <Box key={genre.name}>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: "space-between", mb: 0.5 }}
                  >
                    <Typography variant="body2">{genre.name}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      {genre.count} items
                    </Typography>
                  </Stack>
                  <LinearProgress
                    color={genre.needsData ? "warning" : "secondary"}
                    value={genre.share}
                    variant="determinate"
                  />
                </Box>
              ))}
            </Stack>
          </DashboardCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <DashboardCard
            action={
              <Button href="/data-health" size="small">
                Review
              </Button>
            }
            title="Data Health"
          >
            <Stack spacing={1.1}>
              <HealthRow
                label="Items missing genres"
                value={data.health.missingGenres}
              />
              <HealthRow
                label="Items missing release dates"
                value={data.health.missingReleaseDates}
              />
              <HealthRow
                label="Items with few comparisons"
                value={data.health.lowComparisonItems}
              />
              <HealthRow
                label="Possible duplicates"
                value={data.duplicateCount}
              />
            </Stack>
          </DashboardCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DashboardCard
            action={
              <Button href="/watchlist" size="small">
                Open watchlist
              </Button>
            }
            title="Watchlist Signals"
          >
            <Stack spacing={1.2}>
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
          </DashboardCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
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
              <Stack spacing={1.2} sx={{ mt: 1.5 }}>
                {upcomingItemsForType.map((item) => (
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
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <DashboardCard
            action={
              <Button href="/friends" size="small">
                Open friends
              </Button>
            }
            title="Friend Compatibility"
          >
            {data.friendCompatibility.length > 0 ? (
              <Stack spacing={1.2}>
                {data.friendCompatibility.map((friend) => (
                  <FriendCompatibilityRow
                    friend={friend}
                    key={friend.friendId}
                  />
                ))}
              </Stack>
            ) : (
              <EmptyPanel
                icon={<CompareArrowsIcon />}
                label={
                  data.friendCount > 0
                    ? "Add friend ratings to calculate compatibility."
                    : "No friends imported yet."
                }
              />
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </Stack>
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
        bgcolor: alpha("#07111d", 0.34),
        border: `1px solid ${alpha("#9fb4d0", 0.12)}`,
        borderRadius: 1.5,
        p: 0.35,
        "& .MuiToggleButton-root": {
          border: 0,
          borderRadius: 1.1,
          color: "text.secondary",
          gap: 0.6,
          px: 1,
          py: 0.7,
          textTransform: "none",
          whiteSpace: "nowrap",
          "&.Mui-selected": {
            bgcolor: alpha("#7c5cff", 0.28),
            color: "text.primary",
          },
        },
      }}
      value={value}
    >
      {dashboardMediaTypes.map((mediaType) => (
        <ToggleButton key={mediaType} value={mediaType}>
          {mediaTypeIcon(mediaType)}
          <Typography component="span" sx={{ fontSize: 12, fontWeight: 800 }}>
            {shortMediaTypeLabel(mediaType)}
          </Typography>
          <Typography
            color="text.secondary"
            component="span"
            sx={{ fontSize: 11 }}
          >
            {countByType.get(mediaType) ?? 0}
          </Typography>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

function RecommendationPosterCard({
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
      style={{ color: "inherit", display: "block", textDecoration: "none" }}
    >
      <Box
        sx={{
          border: `1px solid ${alpha("#9fb4d0", 0.14)}`,
          borderRadius: 1.5,
          height: "100%",
          overflow: "hidden",
          scrollSnapAlign: "start",
          transition: "border-color 140ms ease, background-color 140ms ease",
          "&:hover": {
            bgcolor: alpha("#9fb4d0", 0.06),
            borderColor: alpha("#7c5cff", 0.42),
          },
        }}
      >
        <Box
          sx={{
            aspectRatio: "16 / 10",
            bgcolor: alpha(mediaTypeColor(item.mediaType), 0.16),
            backgroundImage: item.posterUrl
              ? `linear-gradient(180deg, transparent 40%, rgba(7, 17, 29, 0.82)), url(${item.posterUrl})`
              : `linear-gradient(135deg, ${alpha(mediaTypeColor(item.mediaType), 0.34)}, ${alpha("#07111d", 0.92)})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
            borderBottom: `1px solid ${alpha("#9fb4d0", 0.12)}`,
            position: "relative",
          }}
        >
          <Box
            sx={{
              alignItems: "center",
              bgcolor: alpha("#07111d", 0.76),
              border: `1px solid ${alpha("#55d66b", 0.44)}`,
              borderRadius: 999,
              bottom: 10,
              color: "#7df08e",
              display: "flex",
              fontSize: 13,
              fontWeight: 900,
              height: 34,
              justifyContent: "center",
              left: 10,
              width: 34,
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
        <Box sx={{ p: 1.15 }}>
          <Typography noWrap sx={{ fontWeight: 900 }} variant="body2">
            {item.title}
          </Typography>
          <Typography color="text.secondary" noWrap variant="caption">
            {formatMediaType(item.mediaType)} · {formatStatus(item.status)}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.55, mt: 1 }}>
            {item.genres.slice(0, 2).map((genre) => (
              <Chip key={genre} label={genre} size="small" variant="outlined" />
            ))}
            {item.genres.length === 0 ? (
              <Chip label="Needs genre" size="small" variant="outlined" />
            ) : null}
          </Stack>
        </Box>
      </Box>
    </Link>
  );
}

function TopRankedRow({ index, item }: { index: number; item: MediaItemDTO }) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        alignItems: "center",
        borderBottom: `1px solid ${alpha("#9fb4d0", 0.1)}`,
        pb: 1,
      }}
    >
      <Typography color="text.secondary" sx={{ width: 22 }} variant="body2">
        {index + 1}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 700 }} variant="body2">
          {item.title}
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {formatMediaType(item.mediaType)}
        </Typography>
      </Box>
      <Chip
        label={formatDashboardScore(
          item.computedPersonalScore ?? item.pairwiseScore / 100,
        )}
        size="small"
      />
    </Stack>
  );
}

function UpcomingRow({ item }: { item: MediaItemDTO }) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        alignItems: "center",
        borderBottom: `1px solid ${alpha("#9fb4d0", 0.1)}`,
        pb: 1,
      }}
    >
      <CalendarMonthIcon color="primary" fontSize="small" />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Link href={`/media/${item.id}`} style={{ textDecoration: "none" }}>
          <Typography
            noWrap
            sx={{ color: "primary.main", fontWeight: 800 }}
            variant="body2"
          >
            {item.title}
          </Typography>
        </Link>
      </Box>
      <Box sx={{ minWidth: 96, textAlign: "right" }}>
        <Typography color="text.secondary" variant="body2">
          {item.upcomingDate
            ? new Date(item.upcomingDate).toLocaleDateString()
            : "-"}
        </Typography>
        {item.upcomingDate ? (
          <Typography color="text.secondary" variant="caption">
            {formatUpcomingRelativeLabel(item.upcomingDate)}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

function CollectionTypeRow({
  count,
  mediaType,
  total,
}: {
  count: number;
  mediaType: MediaType;
  total: number;
}) {
  const share = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: "center", mb: 0.65 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flex: 1, minWidth: 0 }}
        >
          <Box
            sx={{
              alignItems: "center",
              bgcolor: alpha(mediaTypeColor(mediaType), 0.14),
              border: `1px solid ${alpha(mediaTypeColor(mediaType), 0.28)}`,
              borderRadius: 1.25,
              color: mediaTypeColor(mediaType),
              display: "flex",
              flexShrink: 0,
              height: 30,
              justifyContent: "center",
              width: 30,
            }}
          >
            {mediaTypeIcon(mediaType)}
          </Box>
          <Typography noWrap sx={{ fontWeight: 800 }} variant="body2">
            {formatMediaType(mediaType)}
          </Typography>
        </Stack>
        <Typography color="text.secondary" variant="body2">
          {count.toLocaleString()} items
        </Typography>
      </Stack>
      <LinearProgress
        sx={{
          "& .MuiLinearProgress-bar": {
            bgcolor: mediaTypeColor(mediaType),
          },
        }}
        value={share}
        variant="determinate"
      />
    </Box>
  );
}

function FriendCompatibilityRow({ friend }: { friend: FriendCompatibility }) {
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: "center", mb: 0.6 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 800 }} variant="body2">
            {friend.friendName}
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {friend.overlapCount} shared ratings
          </Typography>
        </Box>
        <Typography sx={{ fontWeight: 900 }} variant="body2">
          {Math.round(friend.compatibilityScore)}%
        </Typography>
      </Stack>
      <LinearProgress
        color={
          friend.compatibilityScore >= 80
            ? "success"
            : friend.compatibilityScore >= 65
              ? "warning"
              : "primary"
        }
        value={Math.max(0, Math.min(100, friend.compatibilityScore))}
        variant="determinate"
      />
    </Box>
  );
}

function MetricCard({
  color,
  icon,
  label,
  value,
}: {
  color: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card variant="outlined">
      <CardContent
        sx={{ display: "flex", gap: 1.5, p: 2, "&:last-child": { pb: 2 } }}
      >
        <Box
          sx={{
            alignItems: "center",
            bgcolor: alpha(color, 0.15),
            border: `1px solid ${alpha(color, 0.28)}`,
            borderRadius: 2,
            color,
            display: "flex",
            flexShrink: 0,
            height: 42,
            justifyContent: "center",
            width: 42,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            color="text.secondary"
            sx={{ fontWeight: 700, textTransform: "uppercase" }}
            variant="caption"
          >
            {label}
          </Typography>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.1 }} variant="h5">
            {value}
          </Typography>
        </Box>
      </CardContent>
    </Card>
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
    <Card variant="outlined">
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack direction="row" sx={{ alignItems: "center", mb: 1.5 }}>
          <Typography
            component="h2"
            sx={{ flex: 1, fontWeight: 800 }}
            variant="h6"
          >
            {title}
          </Typography>
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

function EmptyPanel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Stack
      spacing={1}
      sx={{
        alignItems: "center",
        border: `1px dashed ${alpha("#9fb4d0", 0.18)}`,
        borderRadius: 1.5,
        color: "text.secondary",
        mt: 1.5,
        py: 3,
      }}
    >
      {icon}
      <Typography variant="body2">{label}</Typography>
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
      style={{ color: "inherit", display: "block", textDecoration: "none" }}
    >
      <Box
        sx={{
          border: `1px solid ${alpha("#9fb4d0", 0.12)}`,
          borderRadius: 1.5,
          p: 1.25,
          "&:hover": {
            bgcolor: alpha("#9fb4d0", 0.06),
            borderColor: alpha("#8c6bff", 0.36),
          },
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          sx={{ alignItems: { sm: "center" } }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 800 }} variant="body2">
              {item.title}
            </Typography>
            <Stack
              direction="row"
              sx={{ flexWrap: "wrap", gap: 0.6, mt: 0.75 }}
            >
              <Chip label={formatMediaType(item.mediaType)} size="small" />
              <Chip
                label={formatStatus(item.status)}
                size="small"
                variant="outlined"
              />
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
          <Box sx={{ minWidth: { sm: 150 } }}>
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                mb: 0.6,
              }}
            >
              <Typography color="text.secondary" variant="caption">
                Score
              </Typography>
              <Typography sx={{ fontWeight: 800 }} variant="caption">
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

function HealthRow({ label, value }: { label: string; value: number }) {
  return (
    <Stack
      direction="row"
      sx={{ alignItems: "center", justifyContent: "space-between" }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <CheckCircleIcon
          color={value > 0 ? "warning" : "success"}
          fontSize="small"
        />
        <Typography variant="body2">{label}</Typography>
      </Stack>
      <Chip
        color={value > 0 ? "warning" : "success"}
        label={value}
        size="small"
      />
    </Stack>
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
