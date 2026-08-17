import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import { ComparisonContext, MediaType, Prisma } from "@prisma/client";
import Link from "next/link";
import { saveComparison } from "@/app/compare/actions";
import {
  comparisonEligibleWhere,
  comparisonKey,
  getComparisonPair,
} from "@/lib/compare";
import { requireUserId } from "@/lib/user";
import { formatMediaType, formatStatus } from "@/lib/format";
import { statusLabel } from "@/lib/status-labels";
import { isVisibleMediaType, visibleMediaTypeFilter } from "@/lib/media-types";
import { posterFallback } from "@/lib/media-ui-helpers";
import { prisma } from "@/lib/prisma";
import { StatePanel } from "@/components/shared/StatePanel";
import { ActionToastButton } from "@/components/shared/Toasts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compare" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type CompareItem = NonNullable<
  Awaited<ReturnType<typeof getComparisonPair>>
>[0];

export default async function ComparePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const selectedType = coerceMediaTypeParam(stringParam(params.mediaType));
  const selectedGenre = stringParam(params.genre);
  const selectedTag = stringParam(params.tag);
  const focusId = stringParam(params.focus);
  const skipPairKey = stringParam(params.skip);
  const historyItemId = stringParam(params.historyItem);
  const historyContext = coerceComparisonContextParam(
    stringParam(params.historyContext),
  );
  const userId = await requireUserId("/compare");
  const historyWhere: Prisma.PairwiseComparisonWhereInput = {
    userId,
    winner: { mediaType: visibleMediaTypeFilter() },
    ...(historyItemId
      ? { OR: [{ winnerId: historyItemId }, { loserId: historyItemId }] }
      : {}),
    ...(historyContext ? { context: historyContext } : {}),
  };
  const taxonomyMediaWhere: Prisma.MediaItemWhereInput = {
    ...comparisonEligibleWhere(userId),
    ...(selectedType ? { mediaType: selectedType } : {}),
    ...(selectedGenre
      ? { genres: { some: { genre: { name: selectedGenre } } } }
      : {}),
  };

  const [pair, history, typeCounts, genres, tags, focus, historyMedia] =
    await Promise.all([
      getComparisonPair({
        mediaType: selectedType,
        genre: selectedGenre,
        tag: selectedTag,
        focusId,
        skipPairKey,
      }),
      prisma.pairwiseComparison.findMany({
        where: historyWhere,
        // The history rows render titles and links only — no need to drag two
        // full MediaItem rows (description + metadata) per comparison.
        select: {
          id: true,
          context: true,
          notes: true,
          createdAt: true,
          winner: { select: { id: true, title: true } },
          loser: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.mediaItem.groupBy({
        by: ["mediaType"],
        where: comparisonEligibleWhere(userId),
        _count: true,
      }),
      prisma.genre.findMany({
        where: selectedType
          ? {
              media: {
                some: {
                  media: {
                    ...comparisonEligibleWhere(userId),
                    mediaType: selectedType,
                  },
                },
              },
            }
          : { media: { some: { media: comparisonEligibleWhere(userId) } } },
        orderBy: { name: "asc" },
      }),
      prisma.tag.findMany({
        where: {
          status: "APPROVED",
          media: { some: { media: taxonomyMediaWhere } },
        },
        orderBy: { name: "asc" },
      }),
      focusId
        ? prisma.mediaItem.findUnique({
            where: { id: focusId },
            select: { id: true, title: true },
          })
        : null,
      // Populates the history filter dropdown — labels only.
      prisma.mediaItem.findMany({
        where: {
          ...comparisonEligibleWhere(userId),
          OR: [
            { comparisonsWon: { some: {} } },
            { comparisonsLost: { some: {} } },
          ],
        },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
    ]);

  const first = pair?.[0];
  const second = pair?.[1];
  const sharedGenres = first && second ? getSharedGenres(first, second) : [];
  const sharedTags = first && second ? getSharedTags(first, second) : [];
  const compareHref = buildCompareHref({
    mediaType: selectedType,
    genre: selectedGenre,
    tag: selectedTag,
    focus: focusId,
    skip: first && second ? comparisonKey(first.id, second.id) : undefined,
  });

  return (
    <Stack spacing={2.5}>
      <Card variant="outlined">
        <CardContent sx={{ p: { xs: 2, md: 2.4 } }}>
          <Stack
            component="form"
            direction={{ xs: "column", lg: "row" }}
            spacing={1.5}
            sx={{
              alignItems: { xs: "stretch", lg: "center" },
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ minWidth: { lg: 210 } }}>
              <Typography color="text.secondary" variant="overline">
                Pair rules
              </Typography>
              <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                Match similar titles by type, genre, and tags.
              </Typography>
            </Box>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              sx={{
                alignItems: { xs: "stretch", md: "center" },
                justifyContent: { xs: "flex-start", lg: "flex-end" },
                ml: { lg: "auto" },
              }}
            >
              <TextField
                defaultValue={selectedType ?? ""}
                label="Media type"
                name="mediaType"
                select
                size="small"
                sx={{
                  minWidth: { md: 180 },
                  width: { xs: "100%", md: "auto" },
                }}
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
                size="small"
                sx={{
                  minWidth: { md: 180 },
                  width: { xs: "100%", md: "auto" },
                }}
              >
                <MenuItem value="">Prefer shared genres</MenuItem>
                {genres.map((genre) => (
                  <MenuItem key={genre.id} value={genre.name}>
                    {genre.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                defaultValue={selectedTag ?? ""}
                label="Tags"
                name="tag"
                select
                size="small"
                sx={{
                  minWidth: { md: 180 },
                  width: { xs: "100%", md: "auto" },
                }}
              >
                <MenuItem value="">Prefer shared tags</MenuItem>
                {tags.map((tag) => (
                  <MenuItem key={tag.id} value={tag.name}>
                    {tag.name}
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
          </Stack>
          {focus ? (
            <Typography color="text.secondary" sx={{ mt: 1.5 }} variant="body2">
              Focused on {focus.title}. The other title will stay in the same
              media type and use the closest available taxonomy match.
            </Typography>
          ) : null}
        </CardContent>
      </Card>

      {first && second ? (
        <Stack spacing={2}>
          <Card variant="outlined" sx={{ bgcolor: "surface.1" }}>
            <CardContent sx={{ p: { xs: 2, md: 2.4 } }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{
                  alignItems: { xs: "stretch", md: "center" },
                  justifyContent: "space-between",
                }}
              >
                <Stack direction="row" spacing={1.4} sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      alignItems: "center",
                      bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.12)",
                      border: "1px solid var(--mui-palette-border-subtle)",
                      borderRadius: 2,
                      color: "primary.main",
                      display: "flex",
                      height: 44,
                      justifyContent: "center",
                      width: 44,
                    }}
                  >
                    <CompareArrowsRoundedIcon />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="overline">Compare</Typography>
                    <Typography variant="h4">
                      Which did you like better?
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Similar {formatMediaType(first.mediaType).toLowerCase()}{" "}
                      selected from shared taxonomy and low comparison coverage.
                    </Typography>
                  </Box>
                </Stack>
                <Button
                  href={compareHref}
                  startIcon={<SwapHorizRoundedIcon />}
                  sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
                  variant="outlined"
                >
                  Different pair
                </Button>
              </Stack>
              <Stack
                direction="row"
                sx={{
                  flexWrap: "wrap",
                  gap: 1,
                  ml: { xs: 0, sm: "55px" },
                  mt: 2,
                }}
              >
                <Chip label={formatMediaType(first.mediaType)} />
                <Chip label="Overall" variant="outlined" />
                {selectedGenre ? (
                  <Chip label={selectedGenre} variant="outlined" />
                ) : null}
                {selectedTag ? (
                  <Chip label={selectedTag} variant="outlined" />
                ) : null}
                {sharedGenres.slice(0, 3).map((name) => (
                  <Chip key={name} label={name} variant="outlined" />
                ))}
                {sharedTags.slice(0, 3).map((name) => (
                  <Chip key={name} label={name} variant="outlined" />
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={2} sx={{ alignItems: "stretch" }}>
            {[first, second].map((item, index) => {
              const opponent = index === 0 ? second : first;
              const taxonomyChips = getItemTaxonomyChips(
                item,
                sharedGenres,
                sharedTags,
              );
              return (
                <Grid key={item.id} size={{ xs: 12, md: 6 }}>
                  <form action={saveComparison} style={{ height: "100%" }}>
                    <Card
                      variant="outlined"
                      sx={{ height: "100%", position: "relative" }}
                    >
                      <CardContent sx={{ p: { xs: 2, md: 2.25 } }}>
                        <Stack spacing={2}>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <Typography
                              color="text.secondary"
                              variant="overline"
                            >
                              Option {index + 1}
                            </Typography>
                            <TextField
                              defaultValue="OVERALL"
                              label="Context"
                              name="context"
                              select
                              size="small"
                              sx={{ minWidth: 164 }}
                            >
                              {Object.values(ComparisonContext).map(
                                (context) => (
                                  <MenuItem key={context} value={context}>
                                    {formatStatus(context)}
                                  </MenuItem>
                                ),
                              )}
                            </TextField>
                          </Stack>

                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1.6}
                            sx={{
                              alignItems: { xs: "stretch", sm: "flex-start" },
                            }}
                          >
                            <PosterThumb item={item} />
                            <Stack spacing={1.4} sx={{ flex: 1, minWidth: 0 }}>
                              <Box>
                                <Link
                                  href={`/media/${item.id}`}
                                  style={{ textDecoration: "none" }}
                                >
                                  <Typography
                                    sx={{
                                      color: "primary.main",
                                      fontWeight: 650,
                                      overflowWrap: "anywhere",
                                    }}
                                    variant="h5"
                                  >
                                    {item.title}
                                  </Typography>
                                </Link>
                                <Typography
                                  color="text.secondary"
                                  sx={{ mt: 0.6 }}
                                  variant="body2"
                                >
                                  {formatMediaType(item.mediaType)} -{" "}
                                  {statusLabel(item.status, item.mediaType)} -{" "}
                                  {item.comparisonCount} comparisons
                                </Typography>
                              </Box>

                              <Stack
                                direction="row"
                                sx={{
                                  gap: 0.75,
                                  maxWidth: "100%",
                                  minWidth: 0,
                                  overflowX: "auto",
                                  pb: 0.25,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <Chip
                                  label={formatMediaType(item.mediaType)}
                                  sx={{ flex: "0 0 auto" }}
                                />
                                <Chip
                                  label={statusLabel(
                                    item.status,
                                    item.mediaType,
                                  )}
                                  sx={{ flex: "0 0 auto" }}
                                  variant="outlined"
                                />
                                {taxonomyChips.map((entry) => (
                                  <Chip
                                    key={`${entry.kind}:${entry.name}`}
                                    label={entry.name}
                                    sx={{
                                      bgcolor: entry.shared
                                        ? "rgba(var(--mui-palette-primary-mainChannel) / 0.12)"
                                        : "transparent",
                                      borderColor: entry.shared
                                        ? "rgba(var(--mui-palette-primary-mainChannel) / 0.4)"
                                        : "var(--mui-palette-border-subtle)",
                                      color: entry.shared
                                        ? "primary.main"
                                        : "text.secondary",
                                      flex: "0 0 auto",
                                      maxWidth: 160,
                                      "& .MuiChip-label": {
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      },
                                    }}
                                    variant={
                                      entry.shared ? "filled" : "outlined"
                                    }
                                  />
                                ))}
                              </Stack>

                              <Divider />

                              <Box>
                                <Typography
                                  color="text.secondary"
                                  variant="overline"
                                >
                                  Shared tags
                                </Typography>
                                <Typography sx={{ mt: 0.4 }}>
                                  {formatSharedTaxonomy(
                                    getItemSharedTaxonomy(
                                      item,
                                      sharedGenres,
                                      sharedTags,
                                    ),
                                  )}
                                </Typography>
                              </Box>

                              <Typography
                                color="text.secondary"
                                variant="body2"
                              >
                                {item.description ||
                                  item.genres
                                    .map((entry) => entry.genre.name)
                                    .join(", ") ||
                                  "No description yet."}
                              </Typography>
                            </Stack>
                          </Stack>

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
                          <ActionToastButton
                            successMessage="Comparison saved."
                            variant="contained"
                          >
                            Choose winner
                          </ActionToastButton>
                        </Stack>
                      </CardContent>
                    </Card>
                  </form>
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      ) : (
        <StatePanel
          action={{ href: "/library", label: "Review library" }}
          description="Add at least two released, active items in the same media type, or loosen the selected genre and tag filters."
          title="No comparison pair available"
        />
      )}

      <Card variant="outlined">
        <CardContent sx={{ p: { xs: 2, md: 2.4 } }}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            sx={{ justifyContent: "space-between", mb: 2 }}
          >
            <Box>
              <Typography sx={{ fontWeight: 650 }} variant="h6">
                Recent Comparisons
              </Typography>
              <Typography color="text.secondary" variant="body2">
                Your latest head-to-head picks that are shaping your rankings.
              </Typography>
            </Box>
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
                sx={{
                  minWidth: { md: 220 },
                  width: { xs: "100%", md: "auto" },
                }}
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
                sx={{
                  minWidth: { md: 180 },
                  width: { xs: "100%", md: "auto" },
                }}
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
              {selectedTag ? (
                <input name="tag" type="hidden" value={selectedTag} />
              ) : null}
              {focusId ? (
                <input name="focus" type="hidden" value={focusId} />
              ) : null}
              <Button type="submit" variant="outlined">
                Filter
              </Button>
            </Stack>
          </Stack>

          <Box
            sx={{
              border: "1px solid",
              borderColor: "border.subtle",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {history.map((entry) => (
              <Box
                key={entry.id}
                sx={{
                  alignItems: "center",
                  bgcolor: "background.paper",
                  borderBottom: "1px solid var(--mui-palette-border-subtle)",
                  columnGap: 2,
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "minmax(0, 1fr) minmax(180px, 0.42fr) 128px 72px",
                  },
                  px: { xs: 1.4, md: 1.6 },
                  py: 1.05,
                  rowGap: 1,
                  "&:last-of-type": {
                    borderBottom: 0,
                  },
                  "&:hover": {
                    bgcolor: "surface.2",
                  },
                }}
              >
                <Stack direction="row" spacing={1.1} sx={{ minWidth: 0 }}>
                  <EventOutlinedIcon
                    sx={{
                      color: "text.secondary",
                      flex: "0 0 auto",
                      fontSize: "1.125rem",
                      mt: 0.25,
                    }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ overflowWrap: "anywhere" }}>
                      <MediaTitleLink
                        href={`/media/${entry.winner.id}`}
                        tone="winner"
                      >
                        {entry.winner.title}
                      </MediaTitleLink>{" "}
                      <Typography
                        color="text.secondary"
                        component="span"
                        variant="body2"
                      >
                        vs
                      </Typography>{" "}
                      <MediaTitleLink href={`/media/${entry.loser.id}`}>
                        {entry.loser.title}
                      </MediaTitleLink>
                    </Typography>
                    <Stack
                      direction="row"
                      sx={{ flexWrap: "wrap", gap: 0.8, mt: 0.65 }}
                    >
                      {entry.context ? (
                        <Chip
                          label={formatStatus(entry.context)}
                          size="small"
                          variant="outlined"
                        />
                      ) : null}
                      {entry.notes ? (
                        <Chip
                          label={entry.notes}
                          size="small"
                          variant="outlined"
                        />
                      ) : null}
                    </Stack>
                  </Box>
                </Stack>

                <Stack
                  direction="row"
                  spacing={0.8}
                  sx={{ alignItems: "center", minWidth: 0 }}
                >
                  <EmojiEventsOutlinedIcon
                    sx={{
                      color: "warning.main",
                      flex: "0 0 auto",
                      fontSize: "1.0625rem",
                    }}
                  />
                  <Typography color="text.secondary" variant="body2">
                    Winner:
                  </Typography>
                  <MediaTitleLink
                    href={`/media/${entry.winner.id}`}
                    tone="winner"
                  >
                    {entry.winner.title}
                  </MediaTitleLink>
                </Stack>

                <Typography
                  color="text.secondary"
                  sx={{ whiteSpace: "nowrap" }}
                  variant="body2"
                >
                  {entry.createdAt.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Typography>

                <Button
                  href={`/media/${entry.winner.id}`}
                  size="small"
                  sx={{
                    justifySelf: { xs: "flex-start", md: "end" },
                    minHeight: 32,
                    px: 1.5,
                  }}
                  variant="outlined"
                >
                  View
                </Button>
              </Box>
            ))}
            {history.length === 0 ? (
              <Box sx={{ px: 1.6, py: 1.4 }}>
                <Typography color="text.secondary">
                  No comparisons yet.
                </Typography>
              </Box>
            ) : null}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}

function MediaTitleLink({
  children,
  href,
  tone = "default",
}: {
  children: React.ReactNode;
  href: string;
  tone?: "default" | "winner";
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <Typography
        component="span"
        sx={{
          color: "primary.main",
          fontWeight: tone === "winner" ? 650 : 600,
        }}
      >
        {children}
      </Typography>
    </Link>
  );
}

function PosterThumb({ item }: { item: CompareItem }) {
  return (
    <Box
      component="a"
      href={`/media/${item.id}`}
      sx={{
        alignSelf: "flex-start",
        aspectRatio: "2 / 3",
        backgroundImage: item.posterUrl
          ? `linear-gradient(180deg, transparent 58%, rgba(8,8,11,0.55)), url(${item.posterUrl})`
          : posterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 2,
        boxShadow: 6,
        display: "block",
        flex: "0 0 auto",
        minHeight: { xs: 168, sm: 198 },
        overflow: "hidden",
        position: "relative",
        textDecoration: "none",
        transition: "transform 180ms ease, box-shadow 180ms ease",
        width: { xs: 112, sm: 132 },
        "&:hover": {
          boxShadow: 8,
          transform: "translateY(-2px)",
        },
      }}
    />
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

function getSharedGenres(first: CompareItem, second: CompareItem) {
  const secondGenres = new Set(second.genres.map((entry) => entry.genre.name));
  return first.genres
    .map((entry) => entry.genre.name)
    .filter((name) => secondGenres.has(name));
}

function getSharedTags(first: CompareItem, second: CompareItem) {
  const secondTags = new Set(
    (second.tags ?? []).map((entry) => entry.tag.name),
  );
  return (first.tags ?? [])
    .map((entry) => entry.tag.name)
    .filter((name) => secondTags.has(name));
}

function getItemSharedTaxonomy(
  item: CompareItem,
  sharedGenres: string[],
  sharedTags: string[],
) {
  const itemGenres = new Set(item.genres.map((entry) => entry.genre.name));
  const itemTags = new Set((item.tags ?? []).map((entry) => entry.tag.name));
  return [
    ...sharedGenres.filter((name) => itemGenres.has(name)),
    ...sharedTags.filter((name) => itemTags.has(name)),
  ];
}

function getItemTaxonomyChips(
  item: CompareItem,
  sharedGenres: string[],
  sharedTags: string[],
) {
  const sharedGenreSet = new Set(sharedGenres);
  const sharedTagSet = new Set(sharedTags);
  const shared = [
    ...item.genres
      .map((entry) => entry.genre.name)
      .filter((name) => sharedGenreSet.has(name))
      .map((name) => ({ kind: "genre", name, shared: true })),
    ...(item.tags ?? [])
      .map((entry) => entry.tag.name)
      .filter((name) => sharedTagSet.has(name))
      .map((name) => ({ kind: "tag", name, shared: true })),
  ];
  const sharedNames = new Set(shared.map((entry) => entry.name));
  const additional = [
    ...item.genres
      .map((entry) => entry.genre.name)
      .filter((name) => !sharedNames.has(name))
      .map((name) => ({ kind: "genre", name, shared: false })),
    ...(item.tags ?? [])
      .map((entry) => entry.tag.name)
      .filter((name) => !sharedNames.has(name))
      .map((name) => ({ kind: "tag", name, shared: false })),
  ];

  return [...shared, ...additional].slice(0, 8);
}

function formatSharedTaxonomy(values: string[]) {
  return values.length > 0
    ? values.slice(0, 5).join(", ")
    : "No shared tags yet. This pair is being matched by media type and ranking coverage.";
}

function buildCompareHref(params: {
  mediaType?: MediaType;
  genre?: string;
  tag?: string;
  focus?: string;
  skip?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.mediaType) searchParams.set("mediaType", params.mediaType);
  if (params.genre) searchParams.set("genre", params.genre);
  if (params.tag) searchParams.set("tag", params.tag);
  if (params.focus) searchParams.set("focus", params.focus);
  if (params.skip) searchParams.set("skip", params.skip);
  const query = searchParams.toString();
  return query ? `/compare?${query}` : "/compare";
}
