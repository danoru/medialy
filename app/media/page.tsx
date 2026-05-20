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
import { formatMediaType } from "@/lib/format";
import { statusLabel } from "@/lib/status-labels";
import {
  isVisibleMediaType,
  VISIBLE_MEDIA_TYPES,
  visibleMediaTypeFilter,
} from "@/lib/media-types";
import { updateMediaRatings } from "@/app/media/actions";
import { StatePanel } from "@/components/shared/StatePanel";
import { getCurrentUserId } from "@/lib/user";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";
import { sortMediaTitleRows, type SortDirection } from "@/lib/media-sort";
import { MediaPageNavigator } from "@/components/media/MediaPageNavigator";
import { SaveRatingsButton } from "@/components/media/SaveRatingsButton";
import { matchesMediaTitleSearch } from "@/lib/media-search";
import {
  getCanonicalTagDefinitions,
  getGenresForMediaType,
} from "@/lib/taxonomy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Media" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 50;
const ALL_MEDIA_TYPES = "ALL";
const SORT_DIRECTIONS = ["asc", "desc"] as const;

export default async function MediaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const titleFilter = titleFilterParam(params);
  const selectedGenre = stringParam(params.genre) ?? "";
  const selectedTag = stringParam(params.tag) ?? "";
  const sort = stringParam(params.sort) || "title";
  const direction =
    sortDirectionParam(params.direction) ?? defaultDirection(sort);
  const requestedType = stringParam(params.type);
  const hasSearchFilters = Boolean(titleFilter || selectedGenre || selectedTag);
  const selectedType =
    requestedType === ALL_MEDIA_TYPES
      ? ALL_MEDIA_TYPES
      : isVisibleMediaType(requestedType)
        ? requestedType
        : hasSearchFilters
          ? ALL_MEDIA_TYPES
          : VISIBLE_MEDIA_TYPES[0];
  const genreOptions = filterOptionValues(
    genreFilterOptions(selectedType),
    selectedGenre,
  );
  const tagOptions = filterOptionValues(
    tagFilterOptions(selectedType),
    selectedTag,
  );
  const page = Math.max(1, intParam(params.page) ?? 1);
  const userId = await getCurrentUserId();
  const where: Prisma.MediaItemWhereInput = {
    mediaType:
      selectedType === ALL_MEDIA_TYPES
        ? visibleMediaTypeFilter()
        : selectedType,
  };

  if (selectedGenre)
    where.genres = { some: { genre: { name: selectedGenre } } };
  if (selectedTag) where.tags = { some: { tag: { name: selectedTag } } };

  const statusParam = stringParam(params.status);
  const favoriteParam = stringParam(params.favorite);
  const includeArchived = stringParam(params.archived) === "true";

  // Per-user filters live on the joined `UserMedia` row. We combine them into
  // one relation filter to avoid emitting overlapping `some` clauses. For
  // anonymous viewers, user-scoped filters are ignored — they only see the
  // public catalog shape.
  if (userId != null) {
    const userMediaFilters: Prisma.UserMediaWhereInput = { userId };
    let hasUserMediaFilter = false;
    if (statusParam) {
      userMediaFilters.status = statusParam as MediaStatus;
      hasUserMediaFilter = true;
    }
    if (favoriteParam === "true") {
      userMediaFilters.isFavorite = true;
      hasUserMediaFilter = true;
    }
    if (!includeArchived) {
      userMediaFilters.isArchived = false;
    }

    if (hasUserMediaFilter) {
      where.userMedia = { some: userMediaFilters };
    } else if (!includeArchived) {
      // Default view: items with no UserMedia (UNTRACKED, not archived) OR
      // items with a UserMedia row that is not archived.
      where.OR = [
        { userMedia: { none: { userId } } },
        { userMedia: { some: { userId, isArchived: false } } },
      ];
    }
  }

  if (titleFilter) {
    const matchingIds = await mediaIdsMatchingTitleFilter(where, titleFilter);
    where.id = { in: matchingIds };
  }

  const { items, total } = await findMediaPageItems({
    direction,
    page,
    sort,
    where,
    userId,
  });

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
            sx={{ flexWrap: "wrap" }}
          >
            {selectedType ? (
              <input name="type" type="hidden" value={selectedType} />
            ) : null}
            <TextField
              defaultValue={titleFilter}
              label="Title"
              name="title"
              placeholder="Title"
              size="small"
              sx={{ minWidth: { md: 220 } }}
            />
            <TextField
              defaultValue={selectedGenre}
              label="Genre"
              name="genre"
              select
              size="small"
              sx={{ minWidth: { md: 170 } }}
            >
              <MenuItem value="">All genres</MenuItem>
              {genreOptions.map((genre) => (
                <MenuItem key={genre} value={genre}>
                  {genre}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              defaultValue={selectedTag}
              label="Tag"
              name="tag"
              select
              size="small"
              sx={{ minWidth: { md: 190 } }}
            >
              <MenuItem value="">All tags</MenuItem>
              {tagOptions.map((tag) => (
                <MenuItem key={tag} value={tag}>
                  {tag}
                </MenuItem>
              ))}
            </TextField>
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
                  {statusLabel(status)}
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

type RawMediaListItem = Awaited<
  ReturnType<
    typeof prisma.mediaItem.findMany<{
      include: {
        genres: { include: { genre: true } };
        tags: { include: { tag: true } };
        userMedia: { where: { userId: string }; take: 1 };
      };
    }>
  >
>[number];

type MediaListItem = ReturnType<typeof mergeUserMedia<RawMediaListItem>>;

const PER_USER_SORTS = new Set([
  "pairwiseScore",
  "computedPersonalScore",
  "personalRating",
]);

async function findMediaPageItems({
  direction,
  page,
  sort,
  where,
  userId,
}: {
  direction: SortDirection;
  page: number;
  sort: string;
  where: Prisma.MediaItemWhereInput;
  userId: string | null;
}) {
  const skip = (page - 1) * PAGE_SIZE;
  const include = {
    genres: { include: { genre: true } },
    tags: { include: { tag: true } },
    ...userMediaInclude(userId),
  } satisfies Prisma.MediaItemInclude;

  if (sort === "title") {
    const titleRows = await prisma.mediaItem.findMany({
      select: { id: true, title: true },
      where,
    });
    const pageIds = sortMediaTitleRows(titleRows, direction)
      .slice(skip, skip + PAGE_SIZE)
      .map((item) => item.id);

    if (pageIds.length === 0) return { items: [], total: titleRows.length };

    const pageItems = await prisma.mediaItem.findMany({
      include,
      where: { id: { in: pageIds } },
    });
    const itemsById = new Map(
      pageItems.map((item) => [item.id, mergeUserMedia(item)]),
    );

    return {
      items: pageIds
        .map((id) => itemsById.get(id))
        .filter((item): item is MediaListItem => Boolean(item)),
      total: titleRows.length,
    };
  }

  // Sorts that touch fields on the joined `UserMedia` row can't be ordered in
  // SQL via Prisma's relation orderBy, so we load matching items, merge, then
  // sort + paginate in memory.
  if (PER_USER_SORTS.has(sort)) {
    const allItems = await prisma.mediaItem.findMany({ include, where });
    const merged = allItems.map(mergeUserMedia);
    merged.sort((a, b) => compareByUserField(a, b, sort, direction));
    return {
      items: merged.slice(skip, skip + PAGE_SIZE),
      total: merged.length,
    };
  }

  const [total, items] = await Promise.all([
    prisma.mediaItem.count({ where }),
    prisma.mediaItem.findMany({
      include,
      orderBy: orderBy(sort, direction),
      skip,
      take: PAGE_SIZE,
      where,
    }),
  ]);

  return { items: items.map(mergeUserMedia), total };
}

function compareByUserField(
  a: MediaListItem,
  b: MediaListItem,
  sort: string,
  direction: SortDirection,
) {
  const valueOf = (item: MediaListItem) => {
    if (sort === "pairwiseScore") return item.pairwiseScore;
    if (sort === "computedPersonalScore")
      return item.computedPersonalScore ?? -Infinity;
    if (sort === "personalRating") return item.personalRating ?? -Infinity;
    return 0;
  };
  const delta = valueOf(b) - valueOf(a);
  const directional = direction === "asc" ? -delta : delta;
  if (directional !== 0) return directional;
  return a.title.localeCompare(b.title);
}

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
                <TableCell>{statusLabel(item.status, item.mediaType)}</TableCell>
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
                        fontSize: "0.9375rem",
                        fontWeight: 600,
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
                      label={statusLabel(item.status, item.mediaType)}
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
                    <Typography sx={{ fontWeight: 600 }}>
                      {formatScore(item.computedPersonalScore)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography color="text.secondary" variant="caption">
                      Consensus
                    </Typography>
                    <Typography sx={{ fontWeight: 600 }}>
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
  page,
  params,
  startIndex,
  total,
  totalPages,
}: {
  endIndex: number;
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
        <SaveRatingsButton />
        {total > 0 ? (
          <MediaPageNavigator
            page={page}
            pages={Array.from({ length: totalPages }, (_, index) => {
              const nextPage = index + 1;

              return {
                href: buildMediaHref(params, { page: String(nextPage) }),
                page: nextPage,
              };
            })}
          />
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

function titleFilterParam(
  params: Record<string, string | string[] | undefined>,
) {
  return (stringParam(params.title) ?? stringParam(params.filter) ?? "").trim();
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
  if (sort === "computedConsensusScore")
    return [{ computedConsensusScore: direction }, { title: "asc" }];
  if (sort === "updatedAt") return [{ updatedAt: direction }, { title: "asc" }];
  return [{ title: direction }];
}

function formatScore(value: number | null) {
  return value == null ? "-" : value.toFixed(1);
}

function buildMediaHref(
  params: Record<string, string | string[] | undefined>,
  overrides: Partial<
    Record<
      | "title"
      | "genre"
      | "tag"
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
    "title",
    "genre",
    "tag",
    "type",
    "status",
    "favorite",
    "archived",
    "sort",
    "direction",
    "page",
  ] as const) {
    const nextValue =
      key in overrides ? overrides[key] : mediaHrefParam(params, key);
    if (nextValue) searchParams.set(key, nextValue);
  }

  const query = searchParams.toString();
  return query ? `/media?${query}` : "/media";
}

function mediaHrefParam(
  params: Record<string, string | string[] | undefined>,
  key:
    | "title"
    | "genre"
    | "tag"
    | "type"
    | "status"
    | "favorite"
    | "archived"
    | "sort"
    | "direction"
    | "page",
) {
  if (key === "title") return titleFilterParam(params);
  return stringParam(params[key]);
}

function genreFilterOptions(selectedType: string) {
  const mediaTypes = isVisibleMediaType(selectedType)
    ? [selectedType]
    : VISIBLE_MEDIA_TYPES;

  return [
    ...new Set(
      mediaTypes.flatMap((mediaType) => getGenresForMediaType(mediaType)),
    ),
  ].sort((first, second) => first.localeCompare(second));
}

function tagFilterOptions(selectedType: string) {
  const visibleTypes = new Set<string>(VISIBLE_MEDIA_TYPES);

  return getCanonicalTagDefinitions()
    .filter((definition) => {
      if (!definition.mediaTypes || definition.mediaTypes.length === 0) {
        return true;
      }

      if (isVisibleMediaType(selectedType)) {
        return definition.mediaTypes.includes(selectedType);
      }

      return definition.mediaTypes.some((mediaType) =>
        visibleTypes.has(mediaType),
      );
    })
    .map((definition) => definition.name);
}

function filterOptionValues(options: string[], selectedValue: string) {
  if (!selectedValue || options.includes(selectedValue)) return options;

  return [...options, selectedValue].sort((first, second) =>
    first.localeCompare(second),
  );
}

async function mediaIdsMatchingTitleFilter(
  baseWhere: Prisma.MediaItemWhereInput,
  titleFilter: string,
) {
  const candidates = await prisma.mediaItem.findMany({
    where: baseWhere,
    select: {
      id: true,
      title: true,
    },
  });

  return candidates
    .filter((item) => matchesMediaTitleSearch(item.title, titleFilter))
    .map((item) => item.id);
}
