"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { MediaStatus, MediaType, ReleaseKind } from "@prisma/client";
import { PosterImage } from "@/components/media/PosterCard";
import { mediaAccent } from "@/lib/media-ui-helpers";
import { formatMediaType } from "@/lib/format";
import { statusLabel } from "@/lib/status-labels";
import { RELEASE_KIND_LABEL } from "@/lib/media-relations";

export type CalendarRelease = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  mediaType: MediaType;
  posterUrl: string | null;
  genres: string[];
  status: MediaStatus;
  relativeLabel: string;
  releaseKind?: ReleaseKind;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

export function UpcomingCalendar({
  releases,
  initialMonth,
}: {
  releases: CalendarRelease[];
  initialMonth: string; // YYYY-MM
}) {
  const theme = useTheme();
  const [cursor, setCursor] = useState(() => parseMonth(initialMonth));

  const releasesByDate = useMemo(() => {
    const map = new Map<string, CalendarRelease[]>();
    for (const release of releases) {
      const list = map.get(release.date) ?? [];
      list.push(release);
      map.set(release.date, list);
    }
    return map;
  }, [releases]);

  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);
  const todayKey = isoDate(new Date());

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", mb: 1.5 }}
      >
        <Typography sx={{ flex: 1, fontWeight: 650 }} variant="h6">
          {MONTH_FORMATTER.format(cursor)}
        </Typography>
        <IconButton
          aria-label="Previous month"
          onClick={() => setCursor((current) => shiftMonth(current, -1))}
          size="small"
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <IconButton
          aria-label="Next month"
          onClick={() => setCursor((current) => shiftMonth(current, 1))}
          size="small"
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0.75,
        }}
      >
        {WEEKDAYS.map((label) => (
          <Typography
            color="text.secondary"
            key={label}
            sx={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.6,
              pb: 0.75,
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            {label}
          </Typography>
        ))}

        {cells.map((cell) => {
          const key = isoDate(cell.date);
          const dayReleases = releasesByDate.get(key) ?? [];
          const hasReleases = dayReleases.length > 0;
          const isToday = key === todayKey;
          const isOtherMonth = cell.date.getMonth() !== cursor.getMonth();
          const accent = hasReleases
            ? mediaAccent(dayReleases[0].mediaType)
            : undefined;

          const content = (
            <Box
              component={hasReleases ? "a" : "div"}
              href={hasReleases ? `#date-${key}` : undefined}
              sx={{
                alignItems: "center",
                bgcolor: hasReleases ? alpha(accent!, 0.05) : "transparent",
                border: "1px solid",
                borderColor: isToday
                  ? theme.palette.primary.main
                  : hasReleases
                    ? alpha(accent!, 0.18)
                    : "transparent",
                borderRadius: 2,
                color: "inherit",
                cursor: hasReleases ? "pointer" : "default",
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
                minHeight: { xs: 92, sm: 124, md: 144 },
                opacity: isOtherMonth ? 0.4 : 1,
                p: 1,
                textDecoration: "none",
                transition: "background-color 140ms ease, border-color 140ms ease",
                "&:hover": hasReleases
                  ? {
                      backgroundColor: alpha(accent!, 0.12),
                      borderColor: alpha(accent!, 0.4),
                    }
                  : undefined,
              }}
            >
              <Typography
                sx={{
                  alignSelf: "flex-start",
                  color: isToday ? "primary.main" : "text.secondary",
                  fontSize: 14,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: isToday ? 800 : 600,
                  lineHeight: 1,
                }}
              >
                {cell.date.getDate()}
              </Typography>
              {hasReleases ? (
                <DayPoster accent={accent!} releases={dayReleases} />
              ) : null}
            </Box>
          );

          if (!hasReleases) return <Box key={key}>{content}</Box>;

          return (
            <Tooltip
              arrow
              key={key}
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: 6,
                    color: "text.primary",
                    maxWidth: 380,
                    p: 1.25,
                  },
                },
                arrow: { sx: { color: "background.paper" } },
              }}
              title={<ReleaseCard releases={dayReleases} />}
            >
              {content}
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}

/** The day's lead poster, scaled to fill the cell, with a "+N" badge. */
function DayPoster({
  accent,
  releases,
}: {
  accent: string;
  releases: CalendarRelease[];
}) {
  const [first] = releases;
  const extra = releases.length - 1;
  return (
    <Box
      sx={{
        mt: "auto",
        position: "relative",
        width: { xs: 48, sm: 64, md: 80 },
      }}
    >
      <PosterImage
        elevated
        item={{
          mediaType: first.mediaType,
          posterUrl: first.posterUrl,
          title: first.title,
        }}
        sx={{ borderRadius: 1.5 }}
      />
      {extra > 0 ? (
        <Box
          sx={{
            alignItems: "center",
            backgroundColor: alpha(accent, 0.95),
            borderRadius: 1,
            bottom: 4,
            color: "#fff",
            display: "flex",
            fontSize: 11,
            fontWeight: 800,
            justifyContent: "center",
            minWidth: 20,
            position: "absolute",
            px: 0.5,
            py: 0.25,
            right: 4,
          }}
        >
          +{extra}
        </Box>
      ) : null}
    </Box>
  );
}

function ReleaseCard({ releases }: { releases: CalendarRelease[] }) {
  const shown = releases.slice(0, 5);
  const extra = releases.length - shown.length;
  return (
    <Stack spacing={1}>
      {shown.map((release) => (
        <Stack
          direction="row"
          key={release.id}
          spacing={1}
          sx={{ alignItems: "flex-start" }}
        >
          <Box sx={{ flexShrink: 0, width: 48 }}>
            <PosterImage
              item={{
                mediaType: release.mediaType,
                posterUrl: release.posterUrl,
                title: release.title,
              }}
              sx={{ borderRadius: 1 }}
            />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }} variant="body2">
              {release.title}
            </Typography>
            <Stack
              direction="row"
              sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.5 }}
            >
              <Chip
                label={formatMediaType(release.mediaType)}
                size="small"
                sx={{ height: 18, "& .MuiChip-label": { px: 0.75 } }}
              />
              {release.releaseKind ? (
                <Chip
                  color="secondary"
                  label={RELEASE_KIND_LABEL[release.releaseKind]}
                  size="small"
                  sx={{ height: 18, "& .MuiChip-label": { px: 0.75 } }}
                />
              ) : (
                <Chip
                  label={statusLabel(release.status, release.mediaType)}
                  size="small"
                  sx={{ height: 18, "& .MuiChip-label": { px: 0.75 } }}
                  variant="outlined"
                />
              )}
              <Chip
                label={release.relativeLabel}
                size="small"
                sx={{ height: 18, "& .MuiChip-label": { px: 0.75 } }}
                variant="outlined"
              />
            </Stack>
            {release.genres.length > 0 ? (
              <Typography
                color="text.secondary"
                sx={{ display: "block", mt: 0.5 }}
                variant="caption"
              >
                {release.genres.slice(0, 3).join(" · ")}
              </Typography>
            ) : null}
          </Box>
        </Stack>
      ))}
      {extra > 0 ? (
        <Typography color="text.secondary" variant="caption">
          +{extra} more
        </Typography>
      ) : null}
    </Stack>
  );
}

function parseMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, 1);
}

function shiftMonth(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMonthCells(cursor: Date) {
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - start.getDay());

  const cells: { date: Date }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push({ date });
  }
  return cells;
}
