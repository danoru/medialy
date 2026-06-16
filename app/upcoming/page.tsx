import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import Link from "next/link";
import type { MediaStatus, MediaType, ReleaseKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMediaType } from "@/lib/format";
import { statusLabel } from "@/lib/status-labels";
import { RELEASE_KIND_LABEL } from "@/lib/media-relations";
import {
  isVisibleMediaType,
  VISIBLE_MEDIA_TYPES,
} from "@/lib/media-types";
import {
  mediaTypeTabIndicatorColor,
  mediaTypeTabSx,
} from "@/lib/media-ui-helpers";
import {
  formatUpcomingRelativeLabel,
  recentlyReleasedSince,
  sortUpcomingItems,
  startOfToday,
} from "@/lib/upcoming";
import { StatePanel } from "@/components/shared/StatePanel";
import { PageAccentBackground } from "@/components/shared/PageAccentBackground";
import { getCurrentUser } from "@/lib/user";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";
import {
  UpcomingCalendar,
  type CalendarRelease,
} from "@/components/upcoming/UpcomingCalendar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upcoming" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * A unified calendar row — either a brand-new item (its own `releaseDate`) or a
 * re-release event of an existing item (`releaseKind` set). Both link to a
 * `MediaItem` via `id`; `rowKey` keeps React keys unique when an item and its
 * event share that id.
 */
type ReleaseEntry = {
  rowKey: string;
  id: string;
  title: string;
  mediaType: MediaType;
  status: MediaStatus;
  releaseDate: Date;
  genres: string[];
  posterUrl: string | null;
  releaseKind?: ReleaseKind;
};

export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedType = stringParam(params.type);
  const selectedType = isVisibleMediaType(requestedType)
    ? requestedType
    : VISIBLE_MEDIA_TYPES[0];
  const mode = stringParam(params.mode) === "released" ? "released" : "upcoming";
  const now = new Date();
  const today = startOfToday(now);
  // "Just Released" looks back over a recent window; "Upcoming" looks forward.
  const dateFilter =
    mode === "released"
      ? { gte: recentlyReleasedSince(now), lt: today }
      : { gte: today };
  const releaseOrder = mode === "released" ? "desc" : "asc";
  const user = await getCurrentUser();
  const userId = user?.id ?? null;
  const isSignedIn = Boolean(userId);
  const archivedFilter =
    userId == null
      ? {}
      : {
          OR: [
            { userMedia: { none: { userId } } },
            { userMedia: { some: { userId, isArchived: false } } },
          ],
        };

  const rawItems = await prisma.mediaItem.findMany({
    where: {
      mediaType: selectedType,
      releaseDate: dateFilter,
      ...archivedFilter,
    },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
      ...userMediaInclude(userId),
    },
    orderBy: [{ releaseDate: releaseOrder }, { title: "asc" }],
  });

  // Second source: re-releases (remaster/port/DLC) of *existing* items. These
  // hang off `MediaReleaseEvent` because the parent item's own `releaseDate` is
  // the first release (often in the past) and must not move. We surface the
  // event's future date here, linking back to the existing item.
  const rawEvents = await prisma.mediaReleaseEvent.findMany({
    where: {
      date: dateFilter,
      media: { mediaType: selectedType, ...archivedFilter },
    },
    include: {
      media: {
        include: {
          genres: { include: { genre: true } },
          ...userMediaInclude(userId),
        },
      },
    },
    orderBy: [{ date: releaseOrder }],
  });

  const baseEntries: ReleaseEntry[] = rawItems
    .map(mergeUserMedia)
    .filter((item) => item.releaseDate != null)
    .map((item) => ({
      rowKey: `item-${item.id}`,
      id: item.id,
      title: item.title,
      mediaType: item.mediaType,
      status: item.status,
      releaseDate: item.releaseDate!,
      genres: item.genres.map((entry) => entry.genre.name),
      posterUrl: item.posterUrl,
    }));

  const eventEntries: ReleaseEntry[] = rawEvents.map((event) => {
    const media = mergeUserMedia(event.media);
    return {
      rowKey: `event-${event.id}`,
      id: media.id,
      title: event.title ?? media.title,
      mediaType: media.mediaType,
      status: media.status,
      releaseDate: event.date,
      genres: media.genres.map((entry) => entry.genre.name),
      posterUrl: media.posterUrl,
      releaseKind: event.kind,
    };
  });

  const sortedEntries = sortUpcomingItems([...baseEntries, ...eventEntries]);
  // Released view shows newest-first; upcoming shows soonest-first.
  const entries =
    mode === "released" ? sortedEntries.reverse() : sortedEntries;

  const calendarReleases: CalendarRelease[] = entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    date: isoDate(entry.releaseDate),
    mediaType: entry.mediaType,
    posterUrl: entry.posterUrl,
    genres: entry.genres,
    status: entry.status,
    relativeLabel: formatUpcomingRelativeLabel(entry.releaseDate, now),
    releaseKind: entry.releaseKind,
  }));

  const initialMonth = entries[0]?.releaseDate
    ? monthKey(entries[0].releaseDate)
    : monthKey(now);

  return (
    <Stack spacing={2.5}>
      <PageAccentBackground mediaType={selectedType} />
      <Card variant="outlined">
        <CardContent>
          <Tabs
            sx={{ mb: 1.5 }}
            slotProps={{
              indicator: {
                sx: { backgroundColor: mediaTypeTabIndicatorColor(selectedType) },
              },
            }}
            value={mode}
          >
            <Tab
              component="a"
              href={`/upcoming?type=${selectedType}`}
              label="Upcoming"
              value="upcoming"
            />
            <Tab
              component="a"
              href={`/upcoming?type=${selectedType}&mode=released`}
              label="Just Released"
              value="released"
            />
          </Tabs>
          <Tabs
            allowScrollButtonsMobile
            scrollButtons="auto"
            sx={{ mb: 2 }}
            slotProps={{
              indicator: {
                sx: { backgroundColor: mediaTypeTabIndicatorColor(selectedType) },
              },
            }}
            value={selectedType}
            variant="scrollable"
          >
            {VISIBLE_MEDIA_TYPES.map((type) => (
              <Tab
                component="a"
                href={modeHref(type, mode)}
                key={type}
                label={formatMediaType(type)}
                sx={mediaTypeTabSx(type)}
                value={type}
              />
            ))}
          </Tabs>
          <Divider />
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <UpcomingCalendar
            initialMonth={initialMonth}
            releases={calendarReleases}
          />
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            sx={{ alignItems: { sm: "center" }, mb: 1.5 }}
          >
            <Typography sx={{ flex: 1, fontWeight: 650 }} variant="h6">
              {mode === "released" ? "Just Released" : "Releases"}
            </Typography>
            <Chip label={entries.length} size="small" />
          </Stack>
          {entries.length > 0 ? (
            <Stack spacing={1.25}>
              {entries.map((entry) => (
                <ReleaseRow
                  genres={entry.genres}
                  id={entry.id}
                  isSignedIn={isSignedIn}
                  key={entry.rowKey}
                  mediaType={entry.mediaType}
                  now={now}
                  releaseDate={entry.releaseDate}
                  releaseKind={entry.releaseKind}
                  status={entry.status}
                  title={entry.title}
                />
              ))}
            </Stack>
          ) : (
            <EmptyState mode={mode} />
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

function ReleaseRow({
  genres,
  id,
  isSignedIn,
  mediaType,
  now,
  status,
  title,
  releaseDate,
  releaseKind,
}: {
  genres: string[];
  id: string;
  isSignedIn: boolean;
  mediaType: MediaType;
  now: Date;
  status: MediaStatus;
  title: string;
  releaseDate: Date;
  releaseKind?: ReleaseKind;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      id={`date-${isoDate(releaseDate)}`}
      spacing={1.5}
      sx={{
        alignItems: { sm: "center" },
        borderBottom: "1px solid",
        borderColor: "divider",
        pb: 1.25,
        scrollMarginTop: 96,
      }}
    >
      <Stack
        direction="row"
        spacing={1.25}
        sx={{ alignItems: "center", flex: 1, minWidth: 0 }}
      >
        <CalendarMonthIcon color="primary" />
        <Box sx={{ minWidth: 0 }}>
          <Link href={`/media/${id}`} style={{ textDecoration: "none" }}>
            <Typography noWrap sx={{ color: "primary.main", fontWeight: 650 }}>
              {title}
            </Typography>
          </Link>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.6, mt: 0.6 }}>
            <Chip label={formatMediaType(mediaType)} size="small" />
            {releaseKind ? (
              <Chip
                color="secondary"
                label={RELEASE_KIND_LABEL[releaseKind]}
                size="small"
              />
            ) : null}
            <Chip
              label={statusLabel(status, mediaType)}
              size="small"
              variant="outlined"
            />
            {genres.slice(0, 3).map((genre) => (
              <Chip key={genre} label={genre} size="small" variant="outlined" />
            ))}
          </Stack>
        </Box>
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          justifyContent: { xs: "space-between", sm: "flex-end" },
        }}
      >
        <Box sx={{ minWidth: { sm: 112 }, textAlign: { sm: "right" } }}>
          <Typography
            color="text.secondary"
            sx={{ whiteSpace: "nowrap" }}
            variant="body2"
          >
            {releaseDate.toLocaleDateString()}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ whiteSpace: "nowrap" }}
            variant="caption"
          >
            {formatUpcomingRelativeLabel(releaseDate, now)}
          </Typography>
        </Box>
        <Stack
          direction="row"
          sx={{ flexWrap: "wrap", gap: 0.75, justifyContent: "flex-end" }}
        >
          <Button href={`/media/${id}`} size="small" variant="outlined">
            Open
          </Button>
          {isSignedIn ? (
            <Button href={`/media/${id}/edit`} size="small" variant="contained">
              Edit
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </Stack>
  );
}

function EmptyState({ mode }: { mode: "upcoming" | "released" }) {
  if (mode === "released") {
    return (
      <StatePanel
        action={{ href: "/upcoming", label: "See upcoming" }}
        description="Items released in the last few months will appear here once their release dates are set."
        icon={<CalendarMonthIcon />}
        title="Nothing released recently"
      />
    );
  }
  return (
    <StatePanel
      action={{ href: "/media/new", label: "Add one" }}
      description="Future-dated media will appear here once release dates are added."
      icon={<CalendarMonthIcon />}
      title="No upcoming releases"
    />
  );
}

function modeHref(type: MediaType, mode: "upcoming" | "released") {
  return mode === "released"
    ? `/upcoming?type=${type}&mode=released`
    : `/upcoming?type=${type}`;
}

function isoDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
