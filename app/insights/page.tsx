import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { prisma } from "@/lib/prisma";
import { getGenreInsights } from "@/lib/insights";
import { formatMediaType } from "@/lib/format";
import { visibleMediaTypeFilter } from "@/lib/media-types";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const [genres, types] = await Promise.all([
    getGenreInsights(),
    prisma.mediaItem.groupBy({
      by: ["mediaType"],
      where: { isArchived: false, mediaType: visibleMediaTypeFilter() },
      _count: true,
    }),
  ]);
  const total = types.reduce((sum, entry) => sum + entry._count, 0);

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 2 }} variant="h6">
                Genre Distribution
              </Typography>
              <Stack spacing={1.5}>
                {genres.map((genre) => (
                  <Box key={genre.name}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between" }}
                    >
                      <Typography>{genre.name}</Typography>
                      <Typography color="text.secondary">
                        {genre.count} items
                      </Typography>
                    </Stack>
                    <LinearProgress value={genre.share} variant="determinate" />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 2 }} variant="h6">
                Media Type Mix
              </Typography>
              <Stack spacing={1.5}>
                {types.map((entry) => (
                  <Box key={entry.mediaType}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between" }}
                    >
                      <Typography>
                        {formatMediaType(entry.mediaType)}
                      </Typography>
                      <Typography color="text.secondary">
                        {entry._count}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      value={total ? (entry._count / total) * 100 : 0}
                      variant="determinate"
                    />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 700, mb: 2 }} variant="h6">
                Best And Low-Data Genres
              </Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                {genres.slice(0, 8).map((genre) => (
                  <Chip
                    key={genre.name}
                    label={`${genre.name}: ${Math.round(genre.averageScore || 0)}`}
                  />
                ))}
                {genres
                  .filter((genre) => genre.needsData)
                  .map((genre) => (
                    <Chip
                      color="warning"
                      key={`low-${genre.name}`}
                      label={`${genre.name}: needs data`}
                      variant="outlined"
                    />
                  ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
