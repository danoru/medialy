import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { getRecommendations } from "@/lib/recommendations";
import { normalizeScoreForUi } from "@/lib/scoring";
import { formatMediaType, formatStatus } from "@/lib/format";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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
  const items = (await getRecommendations()).filter(
    (entry) =>
      entry.media.mediaType === selectedType &&
      ["WATCHLIST", "BACKLOG"].includes(entry.media.status),
  );

  return (
    <Stack spacing={3}>
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
                href={`/watchlist?type=${type}`}
                key={type}
                label={formatMediaType(type)}
                value={type}
              />
            ))}
          </Tabs>
          <Divider />
        </CardContent>
      </Card>
      <Stack spacing={2}>
        {items.map((entry, index) => (
          <Card key={entry.media.id} variant="outlined">
            <CardContent>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{ justifyContent: "space-between" }}
              >
                <Box>
                  <Link
                    href={`/media/${entry.media.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <Typography sx={{ color: "primary.main", fontWeight: 800 }}>
                      {index + 1}. {entry.media.title}
                    </Typography>
                  </Link>
                  <Stack
                    direction="row"
                    sx={{ flexWrap: "wrap", gap: 1, mt: 1 }}
                  >
                    <Chip
                      label={formatMediaType(entry.media.mediaType)}
                      size="small"
                    />
                    <Chip
                      label={formatStatus(entry.media.status)}
                      size="small"
                      variant="outlined"
                    />
                    {entry.media.genres.slice(0, 3).map((genre) => (
                      <Chip
                        key={genre}
                        label={genre}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Box>
                <Box sx={{ minWidth: 220 }}>
                  <Typography
                    align="right"
                    color="text.secondary"
                    variant="body2"
                  >
                    Priority {Math.round(entry.score)}
                  </Typography>
                  <LinearProgress
                    value={normalizeScoreForUi(entry.score)}
                    variant="determinate"
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 ? (
          <Typography color="text.secondary">
            No {formatMediaType(selectedType).toLowerCase()} watchlist or
            backlog items yet.
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
