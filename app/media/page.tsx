import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MediaStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatMediaType, formatStatus } from "@/lib/format";
import {
  isVisibleMediaType,
  VISIBLE_MEDIA_TYPES,
  visibleMediaTypeFilter,
} from "@/lib/media-types";
import { updateMediaRatings } from "@/app/media/actions";
import { normalizeSearchText } from "@/lib/text-normalization";
import { StatePanel } from "@/components/shared/StatePanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Media" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 50;
const ALL_MEDIA_TYPES = "ALL";
const SORT_DIRECTIONS = ["asc", "desc"] as const;
type SortDirection = (typeof SORT_DIRECTIONS)[number];

export default async function MediaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filter = stringParam(params.filter);
  const sort = stringParam(params.sort) || "title";
  const direction = sortDirectionParam(params.direction) ?? defaultDirection(sort);
  const requestedType = stringParam(params.type);
  const selectedType =
    requestedType === ALL_MEDIA_TYPES
      ? ALL_MEDIA_TYPES
      : isVisibleMediaType(requestedType)
        ? requestedType
        : filter
          ? ALL_MEDIA_TYPES
          : VISIBLE_MEDIA_TYPES[0];
  const page = Math.max(1, intParam(params.page) ?? 1);
  const where: Prisma.MediaItemWhereInput = {
    mediaType:
      selectedType === ALL_MEDIA_TYPES
        ? visibleMediaTypeFilter()
        : selectedType,
  };

  if (stringParam(params.status))
    where.status = stringParam(params.status) as MediaStatus;
  if (stringParam(params.favorite) === "true") where.isFavorite = true;
  if (stringParam(params.archived) !== "true") where.isArchived = false;
  if (filter) {
    const matchingIds = await mediaIdsMatchingFilter(where, filter);
    where.id = { in: matchingIds };
  }

  const [total, items] = await Promise.all([
    prisma.mediaItem.count({ where }),
    prisma.mediaItem.findMany({
      where,
      include: {
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
      },
      orderBy: orderBy(sort, direction),
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total > 0 && page > totalPages) {
    redirect(buildMediaHref(params, { page: String(totalPages) }));
  }

  const startIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(total, page * PAGE_SIZE);
  const currentHref = buildMediaHref(params, {
    type: selectedType,
    page: String(page),
  });

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
            <Tab
              component="a"
              href={buildMediaHref(params, {
                page: undefined,
                type: ALL_MEDIA_TYPES,
              })}
              label="All"
              value={ALL_MEDIA_TYPES}
            />
            {VISIBLE_MEDIA_TYPES.map((type) => (
              <Tab
                component="a"
                href={buildMediaHref(params, { type, page: undefined })}
                key={type}
                label={formatMediaType(type)}
                value={type}
              />
            ))}
          </Tabs>
          <Divider sx={{ mb: 2 }} />

          <Stack
            component="form"
            direction={{ xs: "column", md: "row" }}
            spacing={2}
          >
            {selectedType ? (
              <input name="type" type="hidden" value={selectedType} />
            ) : null}
            <TextField
              defaultValue={filter}
              label="Genre, tag, or title"
              name="filter"
              size="small"
              sx={{ minWidth: { md: 220 } }}
            />
            <TextField
              defaultValue={stringParam(params.status) ?? ""}
              label="Status"
              name="status"
              select
              size="small"
              sx={{ minWidth: { md: 170 } }}
            >
              <MenuItem value="">All statuses</MenuItem>
              {Object.values(MediaStatus).map((status) => (
                <MenuItem key={status} value={status}>
                  {formatStatus(status)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              defaultValue={stringParam(params.favorite) ?? ""}
              label="Favorite"
              name="favorite"
              select
              size="small"
              sx={{ minWidth: { md: 140 } }}
            >
              <MenuItem value="">Any</MenuItem>
              <MenuItem value="true">Favorites</MenuItem>
            </TextField>
            <TextField
              defaultValue={stringParam(params.archived) ?? ""}
              label="Archived"
              name="archived"
              select
              size="small"
              sx={{ minWidth: { md: 140 } }}
            >
              <MenuItem value="">Active</MenuItem>
              <MenuItem value="true">Include</MenuItem>
            </TextField>
            <TextField
              defaultValue={sort}
              label="Sort"
              name="sort"
              select
              size="small"
              sx={{ minWidth: { md: 170 } }}
            >
              <MenuItem value="title">Title</MenuItem>
              <MenuItem value="releaseDate">Release date</MenuItem>
              <MenuItem value="pairwiseScore">Pairwise score</MenuItem>
              <MenuItem value="computedPersonalScore">Personal score</MenuItem>
              <MenuItem value="computedConsensusScore">
                Consensus score
              </MenuItem>
              <MenuItem value="personalRating">Explicit rating</MenuItem>
              <MenuItem value="updatedAt">Updated</MenuItem>
            </TextField>
            <TextField
              defaultValue={direction}
              label="Order"
              name="direction"
              select
              size="small"
              sx={{ minWidth: { md: 140 } }}
            >
              <MenuItem value="asc">Ascending</MenuItem>
              <MenuItem value="desc">Descending</MenuItem>
            </TextField>
            <Button type="submit" variant="outlined">
              Apply
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <form action={updateMediaRatings}>
          <MediaRatingsTable
            currentHref={currentHref}
            endIndex={endIndex}
            items={items}
            page={page}
            params={params}
            startIndex={startIndex}
            total={total}
            totalPages={totalPages}
          />
        </form>
      </Box>

      <Box sx={{ display: { xs: "block", md: "none" } }}>
        <form action={updateMediaRatings}>
          <MediaRatingsCards
            currentHref={currentHref}
            endIndex={endIndex}
            items={items}
            page={page}
            params={params}
            startIndex={startIndex}
            total={total}
            totalPages={totalPages}
          />
        </form>
      </Box>
    </Stack>
  );
}

type MediaListItem = Awaited<
  ReturnType<
    typeof prisma.mediaItem.findMany<{
      include: {
        genres: { include: { genre: true } };
        tags: { include: { tag: true } };
      };
    }>
  >
>[number];

function MediaRatingsTable({
  currentHref,
  endIndex,
  items,
  page,
  params,
  startIndex,
  total,
  totalPages,
}: {
  currentHref: string;
  endIndex: number;
  items: MediaListItem[];
  page: number;
  params: Record<string, string | string[] | undefined>;
  startIndex: number;
  total: number;
  totalPages: number;
}) {
  return (
    <Card variant="outlined">
      <input name="returnTo" type="hidden" value={currentHref} />
      {items.length > 0 ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Genres</TableCell>
              <TableCell align="right">Personal</TableCell>
              <TableCell align="right">Consensus</TableCell>
              <TableCell align="right">Explicit</TableCell>
              <TableCell>Updated</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow hover key={item.id}>
                <TableCell>
                  <input name="mediaId" type="hidden" value={item.id} />
                  <input
                    name={`current:${item.id}`}
                    type="hidden"
                    value={item.personalRating ?? ""}
                  />
                  <Stack spacing={0.5}>
                    <Link
                      href={`/media/${item.id}`}
                      style={{ textDecoration: "none" }}
                    >
                      <Typography
                        sx={{ color: "primary.main", fontWeight: 700 }}
                      >
                        {item.title}
                      </Typography>
                    </Link>
                    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
                      {item.isFavorite ? (
                        <Chip color="secondary" label="Favorite" size="small" />
                      ) : null}
                      {item.isArchived ? (
                        <Chip label="Archived" size="small" />
                      ) : null}
                      {item.tags.slice(0, 2).map((entry) => (
                        <Chip
                          key={entry.tagId}
                          label={entry.tag.name}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Stack>
                </TableCell>
                <TableCell>{formatMediaType(item.mediaType)}</TableCell>
                <TableCell>{formatStatus(item.status)}</TableCell>
                <TableCell>
                  {item.genres.map((entry) => entry.genre.name).join(", ") ||
                    "Missing"}
                </TableCell>
                <TableCell align="right">
                  {formatScore(item.computedPersonalScore)}
                </TableCell>
                <TableCell align="right">
                  {formatScore(item.computedConsensusScore)}
                </TableCell>
                <TableCell align="right">
                  <TextField
                    defaultValue={item.personalRating ?? ""}
                    name={`rating:${item.id}`}
                    placeholder="-"
                    size="small"
                    slotProps={{ htmlInput: { max: 10, min: 0, step: 0.5 } }}
                    sx={{ width: 86 }}
                    type="number"
                  />
                </TableCell>
                <TableCell>{item.updatedAt.toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <StatePanel
          action={{ href: "/media/new", label: "Add media" }}
          description="Adjust the filters or add a new movie, show, or game to start building your library."
          title="No media found"
        />
      )}
      <CardContent>
        <MediaResultsFooter
          endIndex={endIndex}
          itemsLength={items.length}
          page={page}
          params={params}
          startIndex={startIndex}
          total={total}
          totalPages={totalPages}
        />
      </CardContent>
    </Card>
  );
}

function MediaRatingsCards({
  currentHref,
  endIndex,
  items,
  page,
  params,
  startIndex,
  total,
  totalPages,
}: {
  currentHref: string;
  endIndex: number;
  items: MediaListItem[];
  page: number;
  params: Record<string, string | string[] | undefined>;
  startIndex: number;
  total: number;
  totalPages: number;
}) {
  return (
    <Card sx={{ overflow: "hidden" }} variant="outlined">
      <input name="returnTo" type="hidden" value={currentHref} />
      {items.length === 0 ? (
        <StatePanel
          action={{ href: "/media/new", label: "Add media" }}
          description="Adjust the filters or add a new movie, show, or game to start building your library."
          title="No media found"
        />
      ) : (
        <Stack sx={{ p: 1 }}>
          {items.map((item, index) => (
            <Box
              key={item.id}
              sx={{
                borderTop: index === 0 ? 0 : "1px solid",
                borderColor: "divider",
                px: 0.4,
                py: 1,
              }}
            >
              <input name="mediaId" type="hidden" value={item.id} />
              <input
                name={`current:${item.id}`}
                type="hidden"
                value={item.personalRating ?? ""}
              />
              <Stack spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Link
                    href={`/media/${item.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <Typography
                      sx={{
                        color: "primary.main",
                        fontSize: 15,
                        fontWeight: 850,
                        lineHeight: 1.2,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {item.title}
                    </Typography>
                  </Link>
                  <Stack
                    direction="row"
                    sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.7 }}
                  >
                    <Chip
                      label={formatMediaType(item.mediaType)}
                      size="small"
                    />
                    <Chip
                      label={formatStatus(item.status)}
                      size="small"
                      variant="outlined"
                    />
                    {item.isFavorite ? (
                      <Chip color="secondary" label="Favorite" size="small" />
                    ) : null}
                    {item.isArchived ? (
                      <Chip label="Archived" size="small" />
                    ) : null}
                  </Stack>
                </Box>

                <Typography color="text.secondary" variant="body2">
                  {item.genres.map((entry) => entry.genre.name).join(", ") ||
                    "Missing genres"}
                </Typography>

                {item.tags.length > 0 ? (
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
                    {item.tags.slice(0, 3).map((entry) => (
                      <Chip
                        key={entry.tagId}
                        label={entry.tag.name}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                ) : null}

                <Box
                  sx={{
                    alignItems: "center",
                    display: "grid",
                    gap: 1,
                    gridTemplateColumns: "1fr 1fr 86px",
                  }}
                >
                  <Box>
                    <Typography color="text.secondary" variant="caption">
                      Personal
                    </Typography>
                    <Typography sx={{ fontWeight: 800 }}>
                      {formatScore(item.computedPersonalScore)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary" variant="caption">
                      Consensus
                    </Typography>
                    <Typography sx={{ fontWeight: 800 }}>
                      {formatScore(item.computedConsensusScore)}
                    </Typography>
                  </Box>
                  <TextField
                    defaultValue={item.personalRating ?? ""}
                    name={`rating:${item.id}`}
                    placeholder="-"
                    size="small"
                    slotProps={{ htmlInput: { max: 10, min: 0, step: 0.5 } }}
                    type="number"
                  />
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
      <CardContent>
        <MediaResultsFooter
          endIndex={endIndex}
          itemsLength={items.length}
          page={page}
          params={params}
          startIndex={startIndex}
          total={total}
          totalPages={totalPages}
        />
      </CardContent>
    </Card>
  );
}

function MediaResultsFooter({
  endIndex,
  itemsLength,
  page,
  params,
  startIndex,
  total,
  totalPages,
}: {
  endIndex: number;
  itemsLength: number;
  page: number;
  params: Record<string, string | string[] | undefined>;
  startIndex: number;
  total: number;
  totalPages: number;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{
        alignItems: { sm: "center" },
        justifyContent: "space-between",
      }}
    >
      <Typography color="text.secondary" variant="body2">
        {total === 0
          ? "No items found."
          : `Showing ${startIndex}-${endIndex} of ${total}`}
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          flexWrap: "wrap",
          gap: 1,
          justifyContent: { sm: "flex-end" },
        }}
      >
        <Button disabled={itemsLength === 0} type="submit" variant="contained">
          Save ratings
        </Button>
        {totalPages > 1 ? (
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              flexWrap: "wrap",
              gap: 0.75,
              justifyContent: { sm: "flex-end" },
            }}
          >
            <Button
              disabled={page <= 1}
              href={buildMediaHref(params, { page: String(page - 1) })}
              size="small"
              variant="outlined"
            >
              Previous
            </Button>
            {getPaginationItems(page, totalPages).map((item, index) =>
              item === "ellipsis" ? (
                <Button
                  disabled
                  key={`${item}-${index}`}
                  size="small"
                  sx={{ minWidth: 36 }}
                  variant="text"
                >
                  ...
                </Button>
              ) : (
                <Button
                  aria-current={item === page ? "page" : undefined}
                  href={buildMediaHref(params, { page: String(item) })}
                  key={item}
                  size="small"
                  sx={{ minWidth: 36 }}
                  variant={item === page ? "contained" : "outlined"}
                >
                  {item}
                </Button>
              ),
            )}
            <Button
              disabled={page >= totalPages}
              href={buildMediaHref(params, { page: String(page + 1) })}
              size="small"
              variant="outlined"
            >
              Next
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function intParam(value: string | string[] | undefined) {
  const raw = stringParam(value);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortDirectionParam(
  value: string | string[] | undefined,
): SortDirection | null {
  const raw = stringParam(value);
  return raw && SORT_DIRECTIONS.includes(raw as SortDirection)
    ? (raw as SortDirection)
    : null;
}

function defaultDirection(sort: string): SortDirection {
  return sort === "title" ? "asc" : "desc";
}

function orderBy(
  sort: string,
  direction: SortDirection,
): Prisma.MediaItemOrderByWithRelationInput[] {
  if (sort === "releaseDate")
    return [{ releaseDate: direction }, { title: "asc" }];
  if (sort === "pairwiseScore")
    return [{ pairwiseScore: direction }, { title: "asc" }];
  if (sort === "computedPersonalScore")
    return [
      { computedPersonalScore: direction },
      { pairwiseScore: direction },
      { title: "asc" },
    ];
  if (sort === "computedConsensusScore")
    return [{ computedConsensusScore: direction }, { title: "asc" }];
  if (sort === "personalRating")
    return [{ personalRating: direction }, { title: "asc" }];
  if (sort === "updatedAt") return [{ updatedAt: direction }, { title: "asc" }];
  return [{ title: direction }];
}

function formatScore(value: number | null) {
  return value == null ? "-" : value.toFixed(1);
}

function getPaginationItems(currentPage: number, totalPages: number) {
  const pages = new Set([1, totalPages]);

  for (
    let nextPage = currentPage - 1;
    nextPage <= currentPage + 1;
    nextPage += 1
  ) {
    if (nextPage >= 1 && nextPage <= totalPages) pages.add(nextPage);
  }

  const sortedPages = [...pages].sort((first, second) => first - second);
  const items: Array<number | "ellipsis"> = [];

  for (const nextPage of sortedPages) {
    const previous = items.at(-1);
    if (typeof previous === "number" && nextPage - previous > 1)
      items.push("ellipsis");
    items.push(nextPage);
  }

  return items;
}

function buildMediaHref(
  params: Record<string, string | string[] | undefined>,
  overrides: Partial<
    Record<
      | "filter"
      | "type"
      | "status"
      | "favorite"
      | "archived"
      | "sort"
      | "direction"
      | "page",
      string | undefined
    >
  >,
) {
  const searchParams = new URLSearchParams();

  for (const key of [
    "filter",
    "type",
    "status",
    "favorite",
    "archived",
    "sort",
    "direction",
    "page",
  ] as const) {
    const nextValue =
      key in overrides ? overrides[key] : stringParam(params[key]);
    if (nextValue) searchParams.set(key, nextValue);
  }

  const query = searchParams.toString();
  return query ? `/media?${query}` : "/media";
}

async function mediaIdsMatchingFilter(
  baseWhere: Prisma.MediaItemWhereInput,
  filter: string,
) {
  const query = normalizeSearchText(filter);
  if (!query) return [];

  const candidates = await prisma.mediaItem.findMany({
    where: baseWhere,
    select: {
      id: true,
      title: true,
      genres: { select: { genre: { select: { name: true } } } },
      tags: { select: { tag: { select: { name: true } } } },
      credits: { select: { contributor: { select: { name: true } } } },
    },
  });

  return candidates
    .filter((item) => {
      const searchable = normalizeSearchText(
        [
          item.title,
          ...item.genres.map((entry) => entry.genre.name),
          ...item.tags.map((entry) => entry.tag.name),
          ...item.credits.map((entry) => entry.contributor.name),
        ].join(" "),
      );
      return searchable.includes(query);
    })
    .map((item) => item.id);
}
