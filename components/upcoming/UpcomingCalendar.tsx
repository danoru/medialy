"use client";

import { useMemo, useState } from "react";
import {
  Box,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

export type CalendarRelease = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
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
          gap: 0.5,
        }}
      >
        {WEEKDAYS.map((label) => (
          <Typography
            color="text.secondary"
            key={label}
            sx={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.4,
              py: 0.5,
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

          const content = (
            <Box
              component={hasReleases ? "a" : "div"}
              href={hasReleases ? `#date-${key}` : undefined}
              sx={{
                alignItems: "center",
                borderRadius: 1,
                color: "inherit",
                cursor: hasReleases ? "pointer" : "default",
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
                justifyContent: "flex-start",
                minHeight: 56,
                opacity: isOtherMonth ? 0.35 : 1,
                outline: isToday
                  ? `1px solid ${theme.palette.primary.main}`
                  : "1px solid transparent",
                px: 0.5,
                py: 0.5,
                textDecoration: "none",
                transition: "background-color 120ms ease",
                "&:hover": hasReleases
                  ? { backgroundColor: "action.hover" }
                  : undefined,
              }}
            >
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: isToday ? 700 : 500,
                }}
              >
                {cell.date.getDate()}
              </Typography>
              {hasReleases ? (
                <Stack
                  direction="row"
                  spacing={0.25}
                  sx={{ alignItems: "center" }}
                >
                  <Box
                    sx={{
                      backgroundColor: "primary.main",
                      borderRadius: "50%",
                      height: 6,
                      width: 6,
                    }}
                  />
                  {dayReleases.length > 1 ? (
                    <Typography
                      color="primary"
                      sx={{ fontSize: 10, fontWeight: 700 }}
                    >
                      {dayReleases.length}
                    </Typography>
                  ) : null}
                </Stack>
              ) : null}
            </Box>
          );

          if (!hasReleases) return <Box key={key}>{content}</Box>;

          return (
            <Tooltip
              arrow
              key={key}
              title={
                <Box>
                  {dayReleases.slice(0, 6).map((release) => (
                    <Typography
                      key={release.id}
                      sx={{ fontSize: 12 }}
                    >
                      {release.title}
                    </Typography>
                  ))}
                  {dayReleases.length > 6 ? (
                    <Typography sx={{ fontSize: 11, opacity: 0.7 }}>
                      +{dayReleases.length - 6} more
                    </Typography>
                  ) : null}
                </Box>
              }
            >
              {content}
            </Tooltip>
          );
        })}
      </Box>
    </Box>
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
