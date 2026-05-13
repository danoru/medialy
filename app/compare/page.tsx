import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { ComparisonContext, MediaType, Prisma } from "@prisma/client";
import { saveComparison } from "@/app/compare/actions";
import {
  comparisonEligibleWhere,
  comparisonKey,
  getComparisonPair,
} from "@/lib/compare";
import { prisma } from "@/lib/prisma";
import { formatMediaType, formatStatus } from "@/lib/format";
import { isVisibleMediaType, visibleMediaTypeFilter } from "@/lib/media-types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ComparePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const selectedType = coerceMediaTypeParam(stringParam(params.mediaType));
  const selectedGenre = stringParam(params.genre);
  const focusId = stringParam(params.focus);
  const skipPairKey = stringParam(params.skip);
  const historyItemId = stringParam(params.historyItem);
  const historyContext = coerceComparisonContextParam(
    stringParam(params.historyContext),
  );
  const historyWhere: Prisma.PairwiseComparisonWhereInput = {
    winner: { mediaType: visibleMediaTypeFilter() },
    ...(historyItemId
      ? { OR: [{ winnerId: historyItemId }, { loserId: historyItemId }] }
      : {}),
    ...(historyContext ? { context: historyContext } : {}),
  };

  const [pair, history, typeCounts, genres, focus, historyMedia] =
    await Promise.all([
      getComparisonPair({
        mediaType: selectedType,
        genre: selectedGenre,
        focusId,
        skipPairKey,
      }),
      prisma.pairwiseComparison.findMany({
        where: historyWhere,
        include: { winner: true, loser: true },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.mediaItem.groupBy({
        by: ["mediaType"],
        where: comparisonEligibleWhere(),
        _count: true,
      }),
      prisma.genre.findMany({
        where: selectedType
          ? {
              media: {
                some: {
                  media: {
                    ...comparisonEligibleWhere(),
                    mediaType: selectedType,
                  },
                },
              },
            }
          : { media: { some: { media: comparisonEligibleWhere() } } },
        orderBy: { name: "asc" },
      }),
      focusId ? prisma.mediaItem.findUnique({ where: { id: focusId } }) : null,
      prisma.mediaItem.findMany({
        where: {
          ...comparisonEligibleWhere(),
          OR: [
            { comparisonsWon: { some: {} } },
            { comparisonsLost: { some: {} } },
          ],
        },
        orderBy: { title: "asc" },
      }),
    ]);
  const first = pair?.[0];
  const second = pair?.[1];
  const compareHref = buildCompareHref({
    mediaType: selectedType,
    genre: selectedGenre,
    focus: focusId,
    skip: first && second ? comparisonKey(first.id, second.id) : undefined,
  });

  return (
    <Stack spacing={3}>
      <Box>
        <Typography component="h1" sx={{ fontWeight: 700 }} variant="h4">
          Compare
        </Typography>
        <Typography color="text.secondary">
          Choose pairwise winners within the same media type. Shared-genre
          matchups are preferred when enough items exist. Watchlist and backlog
          items are skipped until you mark them as played or watched.
        </Typography>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Stack
            component="form"
            direction={{ xs: "column", md: "row" }}
            spacing={2}
          >
            <TextField
              defaultValue={selectedType ?? ""}
              label="Media type"
              name="mediaType"
              select
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Auto</MenuItem>
              {typeCounts
                .filter((entry) => entry._count >= 2)
                .map((entry) => (
                  <MenuItem key={entry.mediaType} value={entry.mediaType}>
                    {formatMediaType(entry.mediaType)} ({entry._count})
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              defaultValue={selectedGenre ?? ""}
              label="Genre"
              name="genre"
              select
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Prefer shared genres</MenuItem>
              {genres.map((genre) => (
                <MenuItem key={genre.id} value={genre.name}>
                  {genre.name}
                </MenuItem>
              ))}
            </TextField>
            {focusId ? (
              <input name="focus" type="hidden" value={focusId} />
            ) : null}
            <Button type="submit" variant="contained">
              Apply
            </Button>
            <Button href="/compare" variant="outlined">
              Clear
            </Button>
          </Stack>
          {focus ? (
            <Typography color="text.secondary" sx={{ mt: 2 }} variant="body2">
              Focused on {focus.title}. The other item will use the same media
              type and closest available genre match.
            </Typography>
          ) : null}
        </CardContent>
      </Card>

      {first && second ? (
        <Stack spacing={2}>
          <Button
            href={compareHref}
            sx={{ alignSelf: "flex-start" }}
            variant="outlined"
          >
            Different pair
          </Button>
          <Grid container spacing={2}>
            {[first, second].map((item, index) => {
              const opponent = index === 0 ? second : first;
              return (
                <Grid key={item.id} size={{ xs: 12, md: 6 }}>
                  <form action={saveComparison}>
                    <Stack spacing={2}>
                      <Card variant="outlined">
                        <CardContent>
                          <Stack spacing={2}>
                            <TextField
                              defaultValue="OVERALL"
                              label="Context"
                              name="context"
                              select
                            >
                              {Object.values(ComparisonContext).map(
                                (context) => (
                                  <MenuItem key={context} value={context}>
                                    {formatStatus(context)}
                                  </MenuItem>
                                ),
                              )}
                            </TextField>
                            <Box>
                              <Link
                                href={`/media/${item.id}`}
                                style={{ textDecoration: "none" }}
                              >
                                <Typography
                                  sx={{
                                    color: "primary.main",
                                    fontWeight: 800,
                                  }}
                                  variant="h5"
                                >
                                  {item.title}
                                </Typography>
                              </Link>
                              <Stack
                                direction="row"
                                sx={{ flexWrap: "wrap", gap: 1, mt: 1 }}
                              >
                                <Chip label={formatMediaType(item.mediaType)} />
                                <Chip
                                  label={formatStatus(item.status)}
                                  variant="outlined"
                                />
                                <Chip
                                  label={`${item.comparisonCount} comparisons`}
                                  variant="outlined"
                                />
                                {item.genres.map((entry) => (
                                  <Chip
                                    key={entry.genreId}
                                    label={entry.genre.name}
                                    variant="outlined"
                                  />
                                ))}
                              </Stack>
                            </Box>
                            <Typography color="text.secondary">
                              {item.description ||
                                item.genres
                                  .map((entry) => entry.genre.name)
                                  .join(", ") ||
                                "No description yet."}
                            </Typography>
                            <input
                              name="winnerId"
                              type="hidden"
                              value={item.id}
                            />
                            <input
                              name="loserId"
                              type="hidden"
                              value={opponent.id}
                            />
                            <TextField
                              fullWidth
                              label="Comparison note"
                              minRows={2}
                              multiline
                              name="notes"
                            />
                            <Button type="submit" variant="contained">
                              Choose winner
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Stack>
                  </form>
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      ) : (
        <Card variant="outlined">
          <CardContent>
            <Typography>
              Add at least two watched or played items in the same media type,
              or loosen the selected genre filter.
            </Typography>
          </CardContent>
        </Card>
      )}

      <Card variant="outlined">
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ justifyContent: "space-between", mb: 2 }}
          >
            <Typography sx={{ fontWeight: 700 }} variant="h6">
              Recent Comparisons
            </Typography>
            <Stack
              component="form"
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
            >
              <TextField
                defaultValue={historyItemId ?? ""}
                label="Item"
                name="historyItem"
                select
                size="small"
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">All items</MenuItem>
                {historyMedia.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.title}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                defaultValue={historyContext ?? ""}
                label="Context"
                name="historyContext"
                select
                size="small"
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">All contexts</MenuItem>
                {Object.values(ComparisonContext).map((context) => (
                  <MenuItem key={context} value={context}>
                    {formatStatus(context)}
                  </MenuItem>
                ))}
              </TextField>
              {selectedType ? (
                <input name="mediaType" type="hidden" value={selectedType} />
              ) : null}
              {selectedGenre ? (
                <input name="genre" type="hidden" value={selectedGenre} />
              ) : null}
              {focusId ? (
                <input name="focus" type="hidden" value={focusId} />
              ) : null}
              <Button type="submit" variant="outlined">
                Filter
              </Button>
            </Stack>
          </Stack>
          <Stack spacing={1.25}>
            {history.map((entry) => (
              <Box key={entry.id}>
                <Typography>
                  <Link
                    href={`/media/${entry.winner.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <strong>{entry.winner.title}</strong>
                  </Link>{" "}
                  beat{" "}
                  <Link
                    href={`/media/${entry.loser.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    {entry.loser.title}
                  </Link>{" "}
                  on {entry.createdAt.toLocaleDateString()}
                </Typography>
                <Stack
                  direction="row"
                  sx={{ flexWrap: "wrap", gap: 1, mt: 0.75 }}
                >
                  {entry.context ? (
                    <Chip
                      label={formatStatus(entry.context)}
                      size="small"
                      variant="outlined"
                    />
                  ) : null}
                  {entry.notes ? (
                    <Chip label={entry.notes} size="small" variant="outlined" />
                  ) : null}
                </Stack>
              </Box>
            ))}
            {history.length === 0 ? (
              <Typography color="text.secondary">
                No comparisons yet.
              </Typography>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function coerceMediaTypeParam(value: string | undefined) {
  return isVisibleMediaType(value) ? (value as MediaType) : undefined;
}

function coerceComparisonContextParam(value: string | undefined) {
  return value &&
    Object.values(ComparisonContext).includes(value as ComparisonContext)
    ? (value as ComparisonContext)
    : undefined;
}

function buildCompareHref(params: {
  mediaType?: MediaType;
  genre?: string;
  focus?: string;
  skip?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.mediaType) searchParams.set("mediaType", params.mediaType);
  if (params.genre) searchParams.set("genre", params.genre);
  if (params.focus) searchParams.set("focus", params.focus);
  if (params.skip) searchParams.set("skip", params.skip);
  const query = searchParams.toString();
  return query ? `/compare?${query}` : "/compare";
}
