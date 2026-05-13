"use client";

import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
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
  upcomingItems: MediaItemDTO[];
  watchlistItems: MediaItemDTO[];
  recentItems: MediaItemDTO[];
  friendCompatibility: FriendCompatibility[];
  health: {
    missingGenres: number;
    missingReleaseDates: number;
    lowComparisonItems: number;
  };
};

export function DashboardClient({ data }: { data: DashboardData }) {
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
            <Stack spacing={1.25}>
              {data.recommendations.map((recommendation) => (
                <MediaSignalRow
                  href={`/media/${recommendation.media.id}`}
                  item={recommendation.media}
                  key={recommendation.media.id}
                  score={recommendation.score}
                />
              ))}
            </Stack>
          </DashboardCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <DashboardCard
            action={
              <Button href="/top-lists" size="small">
                Open lists
              </Button>
            }
            title="Top Ranked"
          >
            <Stack spacing={1}>
              {data.topItems.slice(0, 6).map((item, index) => (
                <TopRankedRow index={index} item={item} key={item.id} />
              ))}
            </Stack>
          </DashboardCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
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

        <Grid size={{ xs: 12, md: 6 }}>
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
                  score={item.pairwiseScore}
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
            {data.upcomingItems.length > 0 ? (
              <Stack spacing={1.2}>
                {data.upcomingItems.slice(0, 5).map((item) => (
                  <UpcomingRow item={item} key={item.id} />
                ))}
              </Stack>
            ) : (
              <Stack
                spacing={1}
                sx={{ alignItems: "center", color: "text.secondary", py: 3 }}
              >
                <CalendarMonthIcon />
                <Typography variant="body2">No upcoming dates yet.</Typography>
              </Stack>
            )}
          </DashboardCard>
        </Grid>
      </Grid>
    </Stack>
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
      <Chip label={Math.round(item.pairwiseScore)} size="small" />
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
  const normalized = Math.min(100, Math.max(0, Math.round(score / 13)));

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
                {Math.round(score)}
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
