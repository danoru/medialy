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
import MovieIcon from "@mui/icons-material/Movie";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import TuneIcon from "@mui/icons-material/Tune";
import TvIcon from "@mui/icons-material/Tv";
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
import { alpha } from "@mui/material/styles";
import type { MediaType } from "@prisma/client";
import Link from "next/link";
import { getRecommendations } from "@/lib/recommendations";
import { formatMediaType, formatStatus } from "@/lib/format";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import type { MediaItemDTO, Recommendation } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Watchlist" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const QUEUE_STATUSES = new Set(["WATCHLIST", "BACKLOG"]);
const QUEUE_PAGE_SIZE = 10;
const panelBorder = alpha("#9CCBFF", 0.11);
const panelBg =
  "linear-gradient(145deg, rgba(8, 17, 31, 0.9), rgba(5, 8, 18, 0.96))";

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
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
    <Box
      sx={{
        mx: { xs: -1, sm: -1.5, md: -2 },
        px: { xs: 1, sm: 1.5, md: 2 },
        pb: 2,
      }}
    >
      <Stack spacing={1.15}>
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
              bgcolor: alpha("#F8FAFC", 0.92),
              borderRadius: "6px",
              color: "#08111F",
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
              fontSize: { xs: 24, md: 27 },
              fontWeight: 950,
              letterSpacing: 0,
              lineHeight: 1,
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
              bgcolor: alpha("#07101D", 0.82),
              border: `1px solid ${panelBorder}`,
              borderRadius: "8px",
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
              sx={{ color: "#8B5CF6" }}
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
                borderRadius: "7px",
                color: "text.secondary",
                gap: 0.65,
                minHeight: 34,
                px: 1.35,
                textTransform: "none",
              },
              "& .Mui-selected": {
                background: `linear-gradient(135deg, ${alpha("#8B5CF6", 0.85)}, ${alpha("#22D3EE", 0.22)})`,
                boxShadow: `0 0 18px ${alpha("#8B5CF6", 0.24)}, inset 0 1px 0 ${alpha("#FFFFFF", 0.1)}`,
                color: "#FFFFFF",
              },
            }}
            value={selectedType}
            variant="scrollable"
          >
            {VISIBLE_MEDIA_TYPES.map((type) => (
              <Tab
                component="a"
                href={buildWatchlistHref(type)}
                icon={mediaTypeIcon(type)}
                iconPosition="start"
                key={type}
                label={`${shortMediaTypeLabel(type)} (${countsByType.get(type) ?? 0})`}
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
            borderBottom: `1px solid ${alpha("#FFFFFF", 0.08)}`,
            justifyContent: "space-between",
            px: 1.15,
            py: 0.9,
          }}
        >
          <Stack direction="row" spacing={0.7} sx={{ alignItems: "center" }}>
            <Typography
              sx={{ fontSize: 16, fontWeight: 900, letterSpacing: 0 }}
            >
              Ranked Queue
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 12 }}>
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
            fontSize: 10,
            fontWeight: 850,
            gridTemplateColumns: "34px 48px minmax(0, 1fr) 275px 72px 28px",
            letterSpacing: 0.7,
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
            <Box sx={{ borderTop: `1px solid ${alpha("#FFFFFF", 0.07)}` }} />
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
        borderTop: `1px solid ${alpha("#FFFFFF", 0.08)}`,
        justifyContent: "space-between",
        px: 1.15,
        py: 0.75,
      }}
    >
      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
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
                      bgcolor: alpha("#8B5CF6", 0.36),
                      borderColor: alpha("#8B5CF6", 0.5),
                      color: "#FFFFFF",
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
          "&:hover": { bgcolor: alpha("#FFFFFF", 0.045) },
        }}
      >
        <RankBadge rank={rank} score={entry.score} />
        <PosterThumb item={item} score={entry.score} />
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 0.55 }}>
            <Typography
              noWrap
              sx={{ fontSize: 14, fontWeight: 900, minWidth: 0 }}
            >
              {item.title}
            </Typography>
            {item.isFavorite ? (
              <StarRoundedIcon sx={{ color: "#FBBF24", fontSize: 15 }} />
            ) : null}
          </Stack>
          <Stack
            direction="row"
            sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.4, mt: 0.45 }}
          >
            <Typography color="text.secondary" sx={{ fontSize: 11.5 }}>
              {formatMediaType(item.mediaType)}
            </Typography>
            {releaseYear ? <DotMeta>{releaseYear}</DotMeta> : null}
            <DotMeta>{formatStatus(item.status)}</DotMeta>
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
                fontSize: 12,
                fontWeight: 900,
                lineHeight: 1.15,
              }}
            >
              {matchLabel(entry.score)}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 10.5, mt: 0.2 }}>
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
          sx={{ display: { xs: "none", md: "block" }, fontSize: 12 }}
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
          icon={<AutoAwesomeIcon sx={{ color: "#A78BFA", fontSize: 18 }} />}
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
          <PosterBlock item={item} />
          <Box sx={{ minWidth: 0 }}>
            <Link
              href={`/media/${item.id}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              <Typography noWrap sx={{ fontSize: 16, fontWeight: 930 }}>
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
                <Typography sx={{ fontSize: 12 }}>{releaseYear}</Typography>
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
                  fontSize: 28,
                  fontWeight: 950,
                  lineHeight: 0.9,
                }}
              >
                {Math.round(entry.score)}%
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <MiniBars value={entry.score} />
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", mt: 0.3 }}
                >
                  <Typography color="text.secondary" sx={{ fontSize: 10.5 }}>
                    Medialy Match
                  </Typography>
                  <Typography
                    sx={{ color: matchTone(entry.score), fontSize: 10.5 }}
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
            sx={{
              bgcolor: "#5B21B6",
              boxShadow: `0 0 24px ${alpha("#8B5CF6", 0.26)}`,
              minHeight: 34,
              "&:hover": { bgcolor: "#6D28D9" },
            }}
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
              sx={{ color: "#A78BFA", fontSize: 12, fontWeight: 800 }}
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
              sx={{ py: 1.5, textAlign: "center" }}
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
          bgcolor: alpha("#07101D", 0.68),
          border: `1px solid ${alpha("#FFFFFF", 0.07)}`,
          borderRadius: "8px",
          display: "grid",
          gap: 0.65,
          gridTemplateColumns: "26px 42px minmax(0, 1fr) 36px 20px",
          minHeight: 63,
          px: 0.7,
          py: 0.55,
          "&:hover": { bgcolor: alpha("#FFFFFF", 0.045) },
        }}
      >
        <PlayCircleIcon sx={{ color: alpha("#F8FAFC", 0.76), fontSize: 22 }} />
        <PosterThumb item={item} score={entry.score} small />
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 13, fontWeight: 850 }}>
            {item.title}
          </Typography>
          <Typography
            color="text.secondary"
            noWrap
            sx={{ fontSize: 11, mt: 0.2 }}
          >
            {primarySignal(entry)}
          </Typography>
          <LinearProgress
            value={entry.score}
            variant="determinate"
            sx={{
              bgcolor: alpha("#FFFFFF", 0.07),
              borderRadius: "8px",
              height: 4,
              mt: 0.55,
              "& .MuiLinearProgress-bar": {
                bgcolor: matchTone(entry.score),
                borderRadius: "8px",
              },
            }}
          />
        </Box>
        <Typography
          color="text.secondary"
          sx={{ fontSize: 11, textAlign: "right" }}
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
                bgcolor: "#08111F",
                borderRadius: "50%",
                display: "flex",
                flexDirection: "column",
                height: 72,
                justifyContent: "center",
                width: 72,
              }}
            >
              <Typography sx={{ fontSize: 20, fontWeight: 950, lineHeight: 1 }}>
                {total.toLocaleString()}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 10.5 }}>
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
                      bgcolor: mediaTypeColor(entry.mediaType),
                      borderRadius: "50%",
                      height: 7,
                      width: 7,
                    }}
                  />
                  <Typography noWrap sx={{ fontSize: 12 }}>
                    {formatMediaType(entry.mediaType)}
                  </Typography>
                </Stack>
                <Typography color="text.secondary" sx={{ fontSize: 11 }}>
                  {entry.count}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>
        <Box
          sx={{
            borderTop: `1px solid ${alpha("#FFFFFF", 0.08)}`,
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
              sx={{ color: "#A78BFA", fontSize: 12, fontWeight: 800 }}
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
            borderTop: `1px solid ${alpha("#FFFFFF", 0.08)}`,
            fontSize: 11,
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
        <Typography sx={{ flex: 1, fontSize: 12.5, minWidth: 0 }}>
          {signal.label}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 11 }}>
          {Math.round(signal.share)}%
        </Typography>
      </Stack>
      <LinearProgress
        value={signal.share}
        variant="determinate"
        sx={{
          bgcolor: alpha("#FFFFFF", 0.075),
          borderRadius: "8px",
          height: 6,
          "& .MuiLinearProgress-bar": {
            bgcolor: accent,
            borderRadius: "8px",
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
      <Typography sx={{ flex: 1, fontSize: 14.5, fontWeight: 900 }}>
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
          rank <= 3 ? alpha(matchTone(score), 0.18) : alpha("#FFFFFF", 0.035),
        border: `1px solid ${rank <= 3 ? alpha(matchTone(score), 0.42) : alpha("#FFFFFF", 0.14)}`,
        borderRadius: "6px",
        color: rank <= 3 ? matchTone(score) : "text.secondary",
        display: "flex",
        fontSize: 14,
        fontWeight: 900,
        height: 30,
        justifyContent: "center",
        width: 30,
      }}
    >
      {rank}
    </Box>
  );
}

function PosterThumb({
  item,
  score,
  small = false,
}: {
  item: MediaItemDTO;
  score: number;
  small?: boolean;
}) {
  return (
    <Box
      sx={{
        backgroundImage: item.posterUrl
          ? `url(${item.posterUrl})`
          : designedPosterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: `1px solid ${alpha(matchTone(score), 0.18)}`,
        borderRadius: "6px",
        height: small ? 48 : 60,
        overflow: "hidden",
        position: "relative",
        width: small ? 32 : 40,
      }}
    />
  );
}

function PosterBlock({ item }: { item: MediaItemDTO }) {
  return (
    <Box
      sx={{
        aspectRatio: "2 / 3",
        backgroundImage: item.posterUrl
          ? `url(${item.posterUrl})`
          : designedPosterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: `1px solid ${alpha("#FFFFFF", 0.1)}`,
        borderRadius: "8px",
        minHeight: 184,
        overflow: "hidden",
      }}
    />
  );
}

function ScoreRing({ score, size }: { score: number; size: number }) {
  return (
    <Box
      sx={{
        alignItems: "center",
        background: `conic-gradient(${matchTone(score)} ${Math.round(score)}%, ${alpha("#FFFFFF", 0.09)} 0)`,
        borderRadius: "50%",
        display: "flex",
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          bgcolor: "#08111F",
          borderRadius: "50%",
          display: "flex",
          fontSize: 11,
          fontWeight: 950,
          height: size - 10,
          justifyContent: "center",
          width: size - 10,
        }}
      >
        {Math.round(score)}%
      </Box>
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
        borderRadius: "6px",
        color,
        fontSize: 10.5,
        fontWeight: 760,
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
        bgcolor: alpha("#FFFFFF", 0.055),
        border: `1px solid ${alpha("#FFFFFF", 0.08)}`,
        borderRadius: "6px",
        color: alpha("#F8FAFC", 0.82),
        fontSize: 10.5,
        fontWeight: 720,
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
    <Typography color="text.secondary" sx={{ fontSize: 11.5 }}>
      / {children}
    </Typography>
  );
}

function MiniBars({ value }: { value: number }) {
  const activeBars = Math.max(1, Math.round(value / 10));

  return (
    <Box
      sx={{
        display: "grid",
        gap: 0.25,
        gridTemplateColumns: "repeat(10, 1fr)",
      }}
    >
      {Array.from({ length: 10 }).map((_, index) => (
        <Box
          key={index}
          sx={{
            bgcolor:
              index < activeBars ? matchTone(value) : alpha("#FFFFFF", 0.11),
            borderRadius: "2px",
            height: 9,
          }}
        />
      ))}
    </Box>
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
        sx={{ color: "#22D3EE", display: "flex", "& svg": { fontSize: 18 } }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography color="text.secondary" noWrap sx={{ fontSize: 10.5 }}>
          {label}
        </Typography>
        <Typography sx={{ color: "#2EFFC3", fontSize: 14, fontWeight: 900 }}>
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
        <Typography
          sx={{ fontSize: 20, fontWeight: 930, letterSpacing: 0, mt: 1 }}
        >
          No {selectedLabel.toLowerCase()} queue yet
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 520, mt: 0.6 }}>
          Add watchlist or backlog items and they will appear as a ranked queue
          with compact match signals.
        </Typography>
        <Button href="/media" sx={{ mt: 1.3 }} variant="outlined">
          Browse media
        </Button>
      </CardContent>
    </Card>
  );
}

const compactPanelSx = {
  background: panelBg,
  borderColor: panelBorder,
  boxShadow: `0 18px 50px ${alpha("#000000", 0.28)}, inset 0 1px 0 ${alpha("#FFFFFF", 0.04)}`,
  overflow: "hidden",
} as const;

const compactControlSx = {
  bgcolor: alpha("#07101D", 0.82),
  borderColor: panelBorder,
  color: alpha("#F8FAFC", 0.84),
  minHeight: 34,
  px: 1.05,
  "&:hover": {
    bgcolor: alpha("#FFFFFF", 0.06),
    borderColor: alpha("#8B5CF6", 0.35),
  },
} as const;

const paginationButtonSx = {
  ...compactControlSx,
  fontSize: 11.5,
  minHeight: 29,
  minWidth: 34,
  px: 0.8,
} as const;

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

function formatReasonValue(value: number) {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function primarySignal(entry: Recommendation) {
  const bestReason = positiveReasons(entry).sort(
    (a, b) => b.value - a.value,
  )[0];

  if (bestReason) {
    return `${bestReason.label} ${formatReasonValue(bestReason.value)}`;
  }

  return entry.media.genres[0] ?? formatStatus(entry.media.status);
}

function matchLabel(score: number) {
  if (score >= 85) return "Very High";
  if (score >= 70) return "High";
  if (score >= 55) return "Solid";
  return "Niche";
}

function matchTone(score: number) {
  if (score >= 85) return "#2EFFC3";
  if (score >= 70) return "#22D3EE";
  if (score >= 55) return "#FBBF24";
  return "#A78BFA";
}

function compactDateLabel(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function releaseYearLabel(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return String(date.getFullYear());
}

function queueDonutBackground(
  mix: Array<{ count: number; mediaType: MediaType }>,
  total: number,
) {
  if (total === 0) return alpha("#FFFFFF", 0.08);

  let cursor = 0;
  const stops = mix
    .filter((entry) => entry.count > 0)
    .map((entry) => {
      const start = cursor;
      const end = cursor + (entry.count / total) * 100;
      cursor = end;
      return `${mediaTypeColor(entry.mediaType)} ${start}% ${end}%`;
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

function mediaTypeIcon(mediaType: MediaType) {
  if (mediaType === "TV_SHOW") return <TvIcon fontSize="small" />;
  if (mediaType === "VIDEO_GAME") return <SportsEsportsIcon fontSize="small" />;
  return <MovieIcon fontSize="small" />;
}

function mediaTypeColor(mediaType: MediaType) {
  if (mediaType === "TV_SHOW") return "#60A5FA";
  if (mediaType === "VIDEO_GAME") return "#2EFFC3";
  return "#8B5CF6";
}

function shortMediaTypeLabel(mediaType: MediaType) {
  if (mediaType === "TV_SHOW") return "TV";
  if (mediaType === "VIDEO_GAME") return "Games";
  return "Movies";
}

function designedPosterFallback(mediaType: MediaType) {
  const accent = mediaTypeColor(mediaType);
  return [
    `linear-gradient(160deg, ${alpha(accent, 0.34)}, transparent 42%)`,
    `linear-gradient(20deg, ${alpha("#22D3EE", 0.14)}, transparent 48%)`,
    "linear-gradient(145deg, rgba(17, 23, 42, 0.98), rgba(8, 17, 31, 0.99) 52%, rgba(5, 8, 18, 0.99))",
  ].join(", ");
}
