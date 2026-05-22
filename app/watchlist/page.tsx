import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import FilterListIcon from "@mui/icons-material/FilterList";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import GridViewIcon from "@mui/icons-material/GridView";
import GroupIcon from "@mui/icons-material/Group";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import TuneIcon from "@mui/icons-material/Tune";
import ViewListIcon from "@mui/icons-material/ViewList";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import type { MediaType } from "@prisma/client";
import Link from "next/link";
import { getRecommendations } from "@/lib/recommendations";
import { formatMediaType } from "@/lib/format";
import { statusLabel } from "@/lib/status-labels";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import type { Recommendation } from "@/lib/types";
import { requireUserId } from "@/lib/user";
import { formatReasonValue, matchLabel, matchTone } from "@/lib/score-display";
import { releaseYearLabel, compactDateLabel } from "@/lib/date-labels";
import {
  mediaAccent,
  mediaTypeIcon,
  mediaTypeTabIndicatorColor,
  mediaTypeTabSx,
  shortMediaTypeLabel,
} from "@/lib/media-ui-helpers";
import { PosterImage, PosterThumb } from "@/components/media/PosterCard";
import { ScoreRing, ScoreBars } from "@/components/media/ScoreDisplay";
import { PageAccentBackground } from "@/components/shared/PageAccentBackground";

export const dynamic = "force-dynamic";
export const metadata = { title: "Watchlist" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const QUEUE_STATUSES = new Set(["WATCHLIST", "BACKLOG"]);
const QUEUE_PAGE_SIZE = 10;

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireUserId("/watchlist");
  const params = await searchParams;
  const requestedType = stringParam(params.type);
  const selectedType = isVisibleMediaType(requestedType)
    ? requestedType
    : VISIBLE_MEDIA_TYPES[0];
  const recommendations = await getRecommendations();
  const queueEntries = recommendations.filter((entry) =>
    QUEUE_STATUSES.has(entry.media.status),
  );
  const countsByType = new Map(
    VISIBLE_MEDIA_TYPES.map((type) => [
      type,
      queueEntries.filter((entry) => entry.media.mediaType === type).length,
    ]),
  );
  const entries = queueEntries.filter(
    (entry) => entry.media.mediaType === selectedType,
  );
  const totalPages = Math.max(1, Math.ceil(entries.length / QUEUE_PAGE_SIZE));
  const currentPage = Math.min(
    totalPages,
    Math.max(1, intParam(params.page) ?? 1),
  );
  const pageStartIndex = (currentPage - 1) * QUEUE_PAGE_SIZE;
  const visibleEntries = entries.slice(
    pageStartIndex,
    pageStartIndex + QUEUE_PAGE_SIZE,
  );
  const selectedLabel = formatMediaType(selectedType);
  const topPick = entries[0] ?? null;
  const nextUp = entries.slice(1, 3);
  const queueMix = getQueueMix(queueEntries);
  const matchSignals = getMatchSignals(entries);
  const averageMatch = averageScore(entries);
  const highMatchCount = entries.filter((entry) => entry.score >= 70).length;

  return (
    <Box sx={{ pb: 2 }}>
      <PageAccentBackground mediaType={selectedType} />
      <Stack spacing={1.5}>
        <WatchlistHeader
          countsByType={countsByType}
          entriesCount={entries.length}
          selectedType={selectedType}
        />

        {entries.length > 0 ? (
          <Box
            sx={{
              alignItems: "start",
              display: "grid",
              gap: 1,
              gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 360px" },
            }}
          >
            <RankedQueuePanel
              currentPage={currentPage}
              entries={visibleEntries}
              pageStartIndex={pageStartIndex}
              selectedLabel={selectedLabel}
              selectedType={selectedType}
              totalCount={entries.length}
              totalPages={totalPages}
            />
            <Stack spacing={1} sx={{ minWidth: 0, width: "100%" }}>
              {topPick ? <TonightPickPanel entry={topPick} /> : null}
              <NextUpPanel entries={nextUp} />
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "1fr" },
                }}
              >
                <QueueMixPanel
                  averageMatch={averageMatch}
                  highMatchCount={highMatchCount}
                  mix={queueMix}
                  total={queueEntries.length}
                />
                <MatchSignalsPanel signals={matchSignals} />
              </Box>
            </Stack>
          </Box>
        ) : (
          <EmptyState selectedLabel={selectedLabel} />
        )}
      </Stack>
    </Box>
  );
}

function WatchlistHeader({
  countsByType,
  entriesCount,
  selectedType,
}: {
  countsByType: Map<MediaType, number>;
  entriesCount: number;
  selectedType: MediaType;
}) {
  return (
    <Stack spacing={1}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.12)",
              borderRadius: 1.5,
              color: "primary.main",
              display: "flex",
              height: 28,
              justifyContent: "center",
              width: 28,
            }}
          >
            <BookmarkIcon sx={{ fontSize: 18 }} />
          </Box>
          <Typography
            component="h1"
            sx={{
              fontFamily:
                'var(--font-heading), "Satoshi", "General Sans", "Space Grotesk", "Inter", system-ui, sans-serif',
              fontSize: { xs: "1.5rem", md: "1.875rem" },
              fontWeight: 650,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
            }}
          >
            Watchlist
          </Typography>
          <Chip label={entriesCount.toLocaleString()} size="small" />
          <IconButton aria-label="More watchlist actions" size="small">
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack
          direction="row"
          spacing={0.65}
          sx={{ flexWrap: "wrap", justifyContent: { md: "flex-end" } }}
        >
          <Button
            size="small"
            startIcon={<FilterListIcon />}
            sx={compactControlSx}
            variant="outlined"
          >
            Filter
          </Button>
          <Button
            size="small"
            startIcon={<TuneIcon />}
            sx={compactControlSx}
            variant="outlined"
          >
            Sort: Priority
          </Button>
          <Box
            sx={{
              bgcolor: "surface.1",
              border: "1px solid",
              borderColor: "border.subtle",
              borderRadius: 2,
              display: "flex",
              gap: 0.25,
              p: 0.3,
            }}
          >
            <IconButton aria-label="List view" size="small">
              <ViewListIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label="Grid view"
              size="small"
              sx={{ color: "primary.main" }}
            >
              <GridViewIcon fontSize="small" />
            </IconButton>
          </Box>
        </Stack>
      </Stack>

      <Card variant="outlined" sx={compactPanelSx}>
        <CardContent sx={{ p: 0.45, "&:last-child": { pb: 0.45 } }}>
          <Tabs
            allowScrollButtonsMobile
            scrollButtons="auto"
            sx={{
              minHeight: 35,
              "& .MuiTabs-indicator": { display: "none" },
              "& .MuiTab-root": {
                borderRadius: 1.5,
                color: "text.secondary",
                gap: 0.65,
                minHeight: 34,
                px: 1.35,
                textTransform: "none",
              },
              "& .Mui-selected": {
                bgcolor: "background.paper",
                boxShadow: 1,
                color: "text.primary",
              },
            }}
            value={selectedType}
            variant="scrollable"
          >
            {VISIBLE_MEDIA_TYPES.map((type) => (
              <Tab
                component="a"
                href={buildWatchlistHref(type)}
                icon={mediaTypeIcon(type) as React.ReactElement}
                iconPosition="start"
                key={type}
                label={`${shortMediaTypeLabel(type)} (${countsByType.get(type) ?? 0})`}
                sx={mediaTypeTabSx(type)}
                value={type}
              />
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </Stack>
  );
}

function RankedQueuePanel({
  currentPage,
  entries,
  pageStartIndex,
  selectedLabel,
  selectedType,
  totalCount,
  totalPages,
}: {
  currentPage: number;
  entries: Recommendation[];
  pageStartIndex: number;
  selectedLabel: string;
  selectedType: MediaType;
  totalCount: number;
  totalPages: number;
}) {
  const pageEndIndex = pageStartIndex + entries.length;

  return (
    <Card component="section" variant="outlined" sx={compactPanelSx}>
      <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            borderBottom: "1px solid",
            borderColor: "divider",
            justifyContent: "space-between",
            px: 1.15,
            py: 0.9,
          }}
        >
          <Stack direction="row" spacing={0.7} sx={{ alignItems: "center" }}>
            <Typography sx={{ fontSize: "1rem", fontWeight: 650 }}>
              Ranked Queue
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: "0.75rem" }}>
              {selectedLabel}
            </Typography>
          </Stack>
          <Chip
            icon={<FormatListNumberedIcon />}
            label={`${totalCount} items`}
            size="small"
            variant="outlined"
          />
        </Stack>

        <Box
          sx={{
            color: "text.secondary",
            display: { xs: "none", md: "grid" },
            fontSize: "0.625rem",
            fontWeight: 600,
            gridTemplateColumns: "34px 48px minmax(0, 1fr) 275px 72px 28px",
            letterSpacing: "0.07em",
            px: 1.15,
            py: 0.65,
            textTransform: "uppercase",
          }}
        >
          <Box>#</Box>
          <Box />
          <Box>Title</Box>
          <Box>Medialy Match</Box>
          <Box>Updated</Box>
          <Box />
        </Box>

        <Stack
          divider={
            <Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />
          }
        >
          {entries.map((entry, index) => (
            <QueueRow
              entry={entry}
              key={entry.media.id}
              rank={pageStartIndex + index + 1}
            />
          ))}
        </Stack>

        <QueuePagination
          currentPage={currentPage}
          pageEndIndex={pageEndIndex}
          pageStartIndex={pageStartIndex}
          selectedType={selectedType}
          totalCount={totalCount}
          totalPages={totalPages}
        />
      </CardContent>
    </Card>
  );
}

function QueuePagination({
  currentPage,
  pageEndIndex,
  pageStartIndex,
  selectedType,
  totalCount,
  totalPages,
}: {
  currentPage: number;
  pageEndIndex: number;
  pageStartIndex: number;
  selectedType: MediaType;
  totalCount: number;
  totalPages: number;
}) {
  const pages = paginationWindow(currentPage, totalPages);

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={0.8}
      sx={{
        alignItems: { sm: "center" },
        borderTop: "1px solid",
        borderColor: "divider",
        justifyContent: "space-between",
        px: 1.15,
        py: 0.75,
      }}
    >
      <Typography color="text.secondary" sx={{ fontSize: "0.75rem" }}>
        Showing {pageStartIndex + 1}-{pageEndIndex} of {totalCount}
      </Typography>
      {totalPages > 1 ? (
        <Stack direction="row" spacing={0.45} sx={{ alignItems: "center" }}>
          <Button
            disabled={currentPage === 1}
            href={buildWatchlistHref(selectedType, currentPage - 1)}
            size="small"
            sx={paginationButtonSx}
            variant="outlined"
          >
            Prev
          </Button>
          {pages.map((page) => (
            <Button
              href={buildWatchlistHref(selectedType, page)}
              key={page}
              size="small"
              sx={{
                ...paginationButtonSx,
                ...(page === currentPage
                  ? {
                      bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.12)",
                      borderColor: "primary.main",
                      color: "primary.main",
                    }
                  : {}),
              }}
              variant="outlined"
            >
              {page}
            </Button>
          ))}
          <Button
            disabled={currentPage === totalPages}
            href={buildWatchlistHref(selectedType, currentPage + 1)}
            size="small"
            sx={paginationButtonSx}
            variant="outlined"
          >
            Next
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
}

function QueueRow({ entry, rank }: { entry: Recommendation; rank: number }) {
  const item = entry.media;
  const releaseYear = releaseYearLabel(item.releaseDate);
  const reasons = positiveReasons(entry).slice(0, 2);
  const updatedLabel = compactDateLabel(item.updatedAt);

  return (
    <Link
      href={`/media/${item.id}`}
      style={{ color: "inherit", display: "block", textDecoration: "none" }}
    >
      <Box
        sx={{
          alignItems: "center",
          display: "grid",
          gap: { xs: 0.8, md: 0.95 },
          gridTemplateColumns: {
            xs: "34px 45px minmax(0, 1fr)",
            md: "34px 48px minmax(0, 1fr) 275px 72px 28px",
          },
          minHeight: { xs: 77, md: 72 },
          px: 1.15,
          py: 0.55,
          transition: "background-color 160ms ease",
          "&:hover": { bgcolor: "surface.1" },
        }}
      >
        <RankBadge rank={rank} score={entry.score} />
        <PosterThumb item={item} accent={matchTone(entry.score)} size="md" />
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 0.55 }}>
            <Typography
              noWrap
              sx={{ fontSize: "0.875rem", fontWeight: 600, minWidth: 0 }}
            >
              {item.title}
            </Typography>
            {item.isFavorite ? (
              <StarRoundedIcon sx={{ color: "warning.main", fontSize: 15 }} />
            ) : null}
          </Stack>
          <Stack
            direction="row"
            sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.4, mt: 0.45 }}
          >
            <Typography color="text.secondary" sx={{ fontSize: "0.75rem" }}>
              {formatMediaType(item.mediaType)}
            </Typography>
            {releaseYear ? <DotMeta>{releaseYear}</DotMeta> : null}
            <DotMeta>{statusLabel(item.status, item.mediaType)}</DotMeta>
            {item.genres.slice(0, 3).map((genre) => (
              <SoftPill key={genre}>{genre}</SoftPill>
            ))}
          </Stack>
        </Box>

        <Box
          sx={{
            display: { xs: "none", md: "grid" },
            gap: 0.8,
            gridTemplateColumns: "48px 76px minmax(0, 1fr)",
            minWidth: 0,
          }}
        >
          <ScoreRing score={entry.score} size={46} />
          <Box sx={{ alignSelf: "center" }}>
            <Typography
              sx={{
                color: matchTone(entry.score),
                fontSize: "0.75rem",
                fontWeight: 600,
                lineHeight: 1.15,
              }}
            >
              {matchLabel(entry.score)}
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ fontSize: "0.625rem", mt: 0.2 }}
            >
              {Math.round(entry.confidence * 100)}% conf.
            </Typography>
          </Box>
          <Stack
            direction="row"
            sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.4 }}
          >
            {reasons.map((reason) => (
              <ReasonChip
                key={reason.label}
                label={reason.label}
                value={reason.value}
              />
            ))}
          </Stack>
        </Box>

        <Typography
          color="text.secondary"
          sx={{ display: { xs: "none", md: "block" }, fontSize: "0.75rem" }}
        >
          {updatedLabel}
        </Typography>
        <MoreVertIcon
          sx={{
            color: "text.secondary",
            display: { xs: "none", md: "block" },
            fontSize: 19,
          }}
        />
      </Box>
    </Link>
  );
}

function TonightPickPanel({ entry }: { entry: Recommendation }) {
  const item = entry.media;
  const releaseYear = releaseYearLabel(item.releaseDate);
  const reasons = positiveReasons(entry).slice(0, 2);

  return (
    <Card component="section" variant="outlined" sx={compactPanelSx}>
      <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
        <PanelTitle
          action={
            <MoreVertIcon sx={{ color: "text.secondary", fontSize: 19 }} />
          }
          icon={<AutoAwesomeIcon sx={{ color: "primary.main", fontSize: 18 }} />}
          title="Tonight Pick"
        />

        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: "126px minmax(0, 1fr)",
            mt: 0.9,
          }}
        >
          <PosterImage item={item} minHeight={184} />
          <Box sx={{ minWidth: 0 }}>
            <Link
              href={`/media/${item.id}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              <Typography noWrap sx={{ fontSize: "1rem", fontWeight: 650 }}>
                {item.title}
              </Typography>
            </Link>
            <Stack
              direction="row"
              sx={{
                color: "text.secondary",
                flexWrap: "wrap",
                gap: 0.45,
                mt: 0.45,
              }}
            >
              {releaseYear ? (
                <Typography sx={{ fontSize: "0.75rem" }}>
                  {releaseYear}
                </Typography>
              ) : null}
              <DotMeta>{formatMediaType(item.mediaType)}</DotMeta>
              {item.genres.slice(0, 2).map((genre) => (
                <SoftPill key={genre}>{genre}</SoftPill>
              ))}
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "end", mt: 1.15 }}
            >
              <Typography
                sx={{
                  color: matchTone(entry.score),
                  fontSize: "1.75rem",
                  fontWeight: 650,
                  lineHeight: 0.9,
                }}
              >
                {Math.round(entry.score)}%
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <ScoreBars value={entry.score} />
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", mt: 0.3 }}
                >
                  <Typography
                    color="text.secondary"
                    sx={{ fontSize: "0.625rem" }}
                  >
                    Medialy Match
                  </Typography>
                  <Typography
                    sx={{
                      color: matchTone(entry.score),
                      fontSize: "0.625rem",
                    }}
                  >
                    {matchLabel(entry.score)}
                  </Typography>
                </Stack>
              </Box>
            </Stack>

            <Stack
              direction="row"
              sx={{ flexWrap: "wrap", gap: 0.45, mt: 0.9 }}
            >
              {reasons.map((reason) => (
                <ReasonChip
                  key={reason.label}
                  label={reason.label}
                  value={reason.value}
                />
              ))}
            </Stack>
          </Box>
        </Box>

        <Stack direction="row" spacing={0.55} sx={{ mt: 1 }}>
          <Button
            fullWidth
            href={`/media/${item.id}`}
            startIcon={<CheckCircleIcon />}
            sx={{ minHeight: 34 }}
            variant="contained"
          >
            Open Details
          </Button>
          <IconButton aria-label="Save watchlist item" size="small">
            <BookmarkBorderIcon fontSize="small" />
          </IconButton>
          <IconButton aria-label="Dismiss watchlist item" size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </CardContent>
    </Card>
  );
}

function NextUpPanel({ entries }: { entries: Recommendation[] }) {
  return (
    <Card component="section" variant="outlined" sx={compactPanelSx}>
      <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
        <PanelTitle
          action={
            <Typography
              sx={{
                color: "primary.main",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              View all
            </Typography>
          }
          count={entries.length}
          title="Next Up"
        />
        <Stack spacing={0.55} sx={{ mt: 0.8 }}>
          {entries.length > 0 ? (
            entries.map((entry) => (
              <NextUpRow entry={entry} key={entry.media.id} />
            ))
          ) : (
            <Typography
              color="text.secondary"
              sx={{ fontSize: "0.8125rem", py: 1.5, textAlign: "center" }}
            >
              Add more queue items to build this lane.
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function NextUpRow({ entry }: { entry: Recommendation }) {
  const item = entry.media;

  return (
    <Link
      href={`/media/${item.id}`}
      style={{ color: "inherit", textDecoration: "none" }}
    >
      <Box
        sx={{
          alignItems: "center",
          bgcolor: "surface.1",
          border: "1px solid",
          borderColor: "border.subtle",
          borderRadius: 2,
          display: "grid",
          gap: 0.65,
          gridTemplateColumns: "26px 42px minmax(0, 1fr) 36px 20px",
          minHeight: 63,
          px: 0.7,
          py: 0.55,
          transition: "border-color 160ms ease",
          "&:hover": {
            borderColor: "border.default",
          },
        }}
      >
        <PlayCircleIcon sx={{ color: "text.secondary", fontSize: 22 }} />
        <PosterThumb item={item} accent={matchTone(entry.score)} size="sm" />
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>
            {item.title}
          </Typography>
          <Typography
            color="text.secondary"
            noWrap
            sx={{ fontSize: "0.6875rem", mt: 0.2 }}
          >
            {primarySignal(entry)}
          </Typography>
          <LinearProgress
            value={entry.score}
            variant="determinate"
            sx={{
              bgcolor: "rgba(var(--mui-palette-text-primaryChannel) / 0.08)",
              borderRadius: 5,
              height: 4,
              mt: 0.55,
              "& .MuiLinearProgress-bar": {
                bgcolor: matchTone(entry.score),
                borderRadius: 5,
              },
            }}
          />
        </Box>
        <Typography
          color="text.secondary"
          sx={{ fontSize: "0.6875rem", textAlign: "right" }}
        >
          {Math.round(entry.score)}%
        </Typography>
        <MoreVertIcon sx={{ color: "text.secondary", fontSize: 18 }} />
      </Box>
    </Link>
  );
}

function QueueMixPanel({
  averageMatch,
  highMatchCount,
  mix,
  total,
}: {
  averageMatch: number;
  highMatchCount: number;
  mix: Array<{ count: number; mediaType: MediaType }>;
  total: number;
}) {
  return (
    <Card component="section" variant="outlined" sx={compactPanelSx}>
      <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
        <PanelTitle title="Queue Mix" />
        <Stack
          direction="row"
          spacing={1.1}
          sx={{ alignItems: "center", mt: 1 }}
        >
          <Box
            sx={{
              alignItems: "center",
              background: queueDonutBackground(mix, total),
              borderRadius: "50%",
              display: "flex",
              height: 108,
              justifyContent: "center",
              width: 108,
            }}
          >
            <Box
              sx={{
                alignItems: "center",
                bgcolor: "background.paper",
                borderRadius: "50%",
                display: "flex",
                flexDirection: "column",
                height: 72,
                justifyContent: "center",
                width: 72,
              }}
            >
              <Typography
                sx={{ fontSize: "1.25rem", fontWeight: 650, lineHeight: 1 }}
              >
                {total.toLocaleString()}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: "0.625rem" }}>
                Items
              </Typography>
            </Box>
          </Box>
          <Stack spacing={0.55} sx={{ flex: 1, minWidth: 0 }}>
            {mix.map((entry) => (
              <Stack
                direction="row"
                key={entry.mediaType}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Stack
                  direction="row"
                  spacing={0.55}
                  sx={{ alignItems: "center", minWidth: 0 }}
                >
                  <Box
                    sx={{
                      bgcolor: mediaAccent(entry.mediaType),
                      borderRadius: "50%",
                      height: 7,
                      width: 7,
                    }}
                  />
                  <Typography noWrap sx={{ fontSize: "0.75rem" }}>
                    {formatMediaType(entry.mediaType)}
                  </Typography>
                </Stack>
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: "0.6875rem" }}
                >
                  {entry.count}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
        <Box
          sx={{
            borderTop: "1px solid",
            borderColor: "divider",
            display: "grid",
            gap: 0.75,
            gridTemplateColumns: "1fr 1fr",
            mt: 1,
            pt: 0.85,
          }}
        >
          <StatPill
            icon={<PlaylistAddCheckIcon />}
            label="Avg Match"
            value={`${averageMatch}%`}
          />
          <StatPill
            icon={<StarRoundedIcon />}
            label="High+"
            value={`${highMatchCount}`}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

function MatchSignalsPanel({
  signals,
}: {
  signals: Array<{ label: string; share: number; value: number }>;
}) {
  return (
    <Card component="section" variant="outlined" sx={compactPanelSx}>
      <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
        <PanelTitle
          action={
            <Typography
              sx={{
                color: "primary.main",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              View all
            </Typography>
          }
          title="Match Signals"
        />
        <Stack spacing={0.9} sx={{ mt: 1 }}>
          {signals.map((signal) => (
            <SignalBar key={signal.label} signal={signal} />
          ))}
        </Stack>
        <Typography
          color="text.secondary"
          sx={{
            borderTop: "1px solid",
            borderColor: "divider",
            fontSize: "0.6875rem",
            lineHeight: 1.35,
            mt: 1,
            pt: 0.8,
          }}
        >
          Signals combine ratings, genres, friends, and community data.
        </Typography>
      </CardContent>
    </Card>
  );
}

function SignalBar({
  signal,
}: {
  signal: { label: string; share: number; value: number };
}) {
  const accent = signalColor(signal.label);

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.65, mb: 0.35 }}>
        <Box sx={{ color: accent, display: "flex" }}>
          {signalIcon(signal.label)}
        </Box>
        <Typography sx={{ flex: 1, fontSize: "0.75rem", minWidth: 0 }}>
          {signal.label}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: "0.6875rem" }}>
          {Math.round(signal.share)}%
        </Typography>
      </Stack>
      <LinearProgress
        value={signal.share}
        variant="determinate"
        sx={{
          bgcolor: "rgba(var(--mui-palette-text-primaryChannel) / 0.08)",
          borderRadius: 5,
          height: 6,
          "& .MuiLinearProgress-bar": {
            bgcolor: accent,
            borderRadius: 5,
          },
        }}
      />
    </Box>
  );
}

function PanelTitle({
  action,
  count,
  icon,
  title,
}: {
  action?: React.ReactNode;
  count?: number;
  icon?: React.ReactNode;
  title: string;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 0.55 }}>
      {icon}
      <Typography sx={{ flex: 1, fontSize: "0.9375rem", fontWeight: 650 }}>
        {title}
      </Typography>
      {typeof count === "number" ? <Chip label={count} size="small" /> : null}
      {action}
    </Stack>
  );
}

function RankBadge({ rank, score }: { rank: number; score: number }) {
  return (
    <Box
      sx={{
        alignItems: "center",
        bgcolor:
          rank <= 3
            ? alpha(matchTone(score), 0.16)
            : "rgba(var(--mui-palette-text-primaryChannel) / 0.05)",
        border:
          rank <= 3
            ? `1px solid ${alpha(matchTone(score), 0.42)}`
            : "1px solid var(--mui-palette-border-subtle)",
        borderRadius: 1.5,
        color: rank <= 3 ? matchTone(score) : "text.secondary",
        display: "flex",
        fontSize: "0.875rem",
        fontWeight: 600,
        height: 30,
        justifyContent: "center",
        width: 30,
      }}
    >
      {rank}
    </Box>
  );
}

function ReasonChip({ label, value }: { label: string; value: number }) {
  const color = signalColor(label);

  return (
    <Box
      sx={{
        bgcolor: alpha(color, 0.13),
        border: `1px solid ${alpha(color, 0.2)}`,
        borderRadius: 1,
        color,
        fontSize: "0.625rem",
        fontWeight: 600,
        lineHeight: 1,
        px: 0.65,
        py: 0.4,
      }}
    >
      {label} {formatReasonValue(value)}
    </Box>
  );
}

function SoftPill({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: "surface.2",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 1,
        color: "text.secondary",
        fontSize: "0.625rem",
        fontWeight: 600,
        lineHeight: 1,
        px: 0.55,
        py: 0.35,
      }}
    >
      {children}
    </Box>
  );
}

function DotMeta({ children }: { children: React.ReactNode }) {
  return (
    <Typography color="text.secondary" sx={{ fontSize: "0.75rem" }}>
      / {children}
    </Typography>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={0.55}
      sx={{ alignItems: "center", minWidth: 0 }}
    >
      <Box
        sx={{
          color: "primary.main",
          display: "flex",
          "& svg": { fontSize: 18 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography color="text.secondary" noWrap sx={{ fontSize: "0.625rem" }}>
          {label}
        </Typography>
        <Typography
          sx={{ color: "text.primary", fontSize: "0.875rem", fontWeight: 650 }}
        >
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function EmptyState({ selectedLabel }: { selectedLabel: string }) {
  return (
    <Card component="section" variant="outlined" sx={compactPanelSx}>
      <CardContent
        sx={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          minHeight: 220,
          justifyContent: "center",
          p: 2,
          textAlign: "center",
        }}
      >
        <PlaylistAddCheckIcon sx={{ color: "text.secondary", fontSize: 38 }} />
        <Typography sx={{ fontSize: "1.125rem", fontWeight: 650, mt: 1 }}>
          No {selectedLabel.toLowerCase()} queue yet
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ fontSize: "0.875rem", maxWidth: 520, mt: 0.6 }}
        >
          Add watchlist or backlog items and they will appear as a ranked queue
          with compact match signals.
        </Typography>
        <Button href="/library" sx={{ mt: 1.3 }} variant="outlined">
          Browse library
        </Button>
      </CardContent>
    </Card>
  );
}

const compactPanelSx: SxProps<Theme> = {
  bgcolor: "background.paper",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 3,
  boxShadow: 1,
  overflow: "hidden",
};

const compactControlSx = {
  bgcolor: "surface.1",
  borderColor: "border.subtle",
  color: "text.secondary",
  minHeight: 34,
  px: 1.05,
  "&:hover": {
    bgcolor: "surface.2",
    borderColor: "border.strong",
  },
} satisfies SxProps<Theme>;

const paginationButtonSx = {
  bgcolor: "surface.1",
  borderColor: "border.subtle",
  color: "text.secondary",
  fontSize: "0.75rem",
  minHeight: 29,
  minWidth: 34,
  px: 0.8,
  "&:hover": {
    bgcolor: "surface.2",
    borderColor: "border.strong",
  },
} satisfies SxProps<Theme>;

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function intParam(value: string | string[] | undefined) {
  const parsed = Number.parseInt(stringParam(value) ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildWatchlistHref(type: MediaType, page = 1) {
  const searchParams = new URLSearchParams({ type });
  if (page > 1) searchParams.set("page", String(page));
  return `/watchlist?${searchParams.toString()}`;
}

function paginationWindow(currentPage: number, totalPages: number) {
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function getQueueMix(entries: Recommendation[]) {
  return VISIBLE_MEDIA_TYPES.map((mediaType) => ({
    mediaType,
    count: entries.filter((entry) => entry.media.mediaType === mediaType)
      .length,
  }));
}

function getMatchSignals(entries: Recommendation[]) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    for (const reason of positiveReasons(entry)) {
      totals.set(reason.label, (totals.get(reason.label) ?? 0) + reason.value);
    }
  }

  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const signals = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({
      label,
      share: total > 0 ? (value / total) * 100 : 0,
      value,
    }));

  return signals.length > 0
    ? signals
    : [
        { label: "Genre affinity", share: 38, value: 38 },
        { label: "Friend signal", share: 27, value: 27 },
        { label: "Consensus", share: 18, value: 18 },
      ];
}

function positiveReasons(entry: Recommendation) {
  return entry.reasons.filter((reason) => reason.value > 0);
}

function averageScore(entries: Recommendation[]) {
  if (entries.length === 0) return 0;
  return Math.round(
    entries.reduce((total, entry) => total + entry.score, 0) / entries.length,
  );
}

function primarySignal(entry: Recommendation) {
  const bestReason = positiveReasons(entry).sort(
    (a, b) => b.value - a.value,
  )[0];

  if (bestReason) {
    return `${bestReason.label} ${formatReasonValue(bestReason.value)}`;
  }

  return (
    entry.media.genres[0] ??
    statusLabel(entry.media.status, entry.media.mediaType)
  );
}

function queueDonutBackground(
  mix: Array<{ count: number; mediaType: MediaType }>,
  total: number,
) {
  if (total === 0) return alpha("#8A8F98", 0.18);

  let cursor = 0;
  const stops = mix
    .filter((entry) => entry.count > 0)
    .map((entry) => {
      const start = cursor;
      const end = cursor + (entry.count / total) * 100;
      cursor = end;
      return `${mediaAccent(entry.mediaType)} ${start}% ${end}%`;
    });

  return `conic-gradient(${stops.join(", ")})`;
}

function signalColor(label: string) {
  if (label.includes("Genre")) return "#2EFFC3";
  if (label.includes("Friend")) return "#A78BFA";
  if (label.includes("Consensus")) return "#60A5FA";
  if (label.includes("Personal")) return "#FBBF24";
  if (label.includes("Upcoming") || label.includes("Discovery"))
    return "#FB923C";
  return "#22D3EE";
}

function signalIcon(label: string) {
  if (label.includes("Friend")) return <GroupIcon sx={{ fontSize: 17 }} />;
  if (label.includes("Consensus"))
    return <SportsEsportsIcon sx={{ fontSize: 17 }} />;
  if (label.includes("Personal"))
    return <StarRoundedIcon sx={{ fontSize: 17 }} />;
  if (label.includes("Upcoming") || label.includes("Discovery")) {
    return <LocalFireDepartmentIcon sx={{ fontSize: 17 }} />;
  }
  return <AutoAwesomeIcon sx={{ fontSize: 17 }} />;
}

