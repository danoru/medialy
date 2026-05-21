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
import type { MediaStatus, MediaType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMediaType } from "@/lib/format";
import { statusLabel } from "@/lib/status-labels";
import {
  isVisibleMediaType,
  VISIBLE_MEDIA_TYPES,
} from "@/lib/media-types";
import {
  formatUpcomingRelativeLabel,
  sortUpcomingItems,
  startOfToday,
} from "@/lib/upcoming";
import { StatePanel } from "@/components/shared/StatePanel";
import { getCurrentUser } from "@/lib/user";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";
import {
  UpcomingCalendar,
  type CalendarRelease,
} from "@/components/upcoming/UpcomingCalendar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upcoming" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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
  const now = new Date();
  const today = startOfToday(now);
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
      releaseDate: { gte: today },
      ...archivedFilter,
    },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
      ...userMediaInclude(userId),
    },
    orderBy: [{ releaseDate: "asc" }, { title: "asc" }],
  });

  const items = sortUpcomingItems(
    rawItems
      .map(mergeUserMedia)
      .filter((item) => item.releaseDate != null),
  );

  const calendarReleases: CalendarRelease[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    date: isoDate(item.releaseDate!),
  }));

  const initialMonth = items[0]?.releaseDate
    ? monthKey(items[0].releaseDate)
    : monthKey(now);

  return (
    <Stack spacing={2.5}>
      <Card variant="outlined">
        <CardContent>
          <Tabs
            allowScrollButtonsMobile
            scrollButtons="auto"
            sx={{ mb: 2 }}
            value={selectedType}
            variant="scrollable"
          >
            {VISIBLE_MEDIA_TYPES.map((type) => (
              <Tab
                component="a"
                href={`/upcoming?type=${type}`}
                key={type}
                label={formatMediaType(type)}
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
              Releases
            </Typography>
            <Chip label={items.length} size="small" />
          </Stack>
          {items.length > 0 ? (
            <Stack spacing={1.25}>
              {items.map((item) => (
                <ReleaseRow
                  genres={item.genres.map((entry) => entry.genre.name)}
                  id={item.id}
                  isSignedIn={isSignedIn}
                  key={item.id}
                  mediaType={item.mediaType}
                  now={now}
                  releaseDate={item.releaseDate!}
                  status={item.status}
                  title={item.title}
                />
              ))}
            </Stack>
          ) : (
            <EmptyState />
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
}: {
  genres: string[];
  id: string;
  isSignedIn: boolean;
  mediaType: MediaType;
  now: Date;
  status: MediaStatus;
  title: string;
  releaseDate: Date;
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

function EmptyState() {
  return (
    <StatePanel
      action={{ href: "/media/new", label: "Add one" }}
      description="Future-dated media will appear here once release dates are added."
      icon={<CalendarMonthIcon />}
      title="No upcoming releases"
    />
  );
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
