import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
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
import { StatePanel } from "@/components/shared/StatePanel";
import { getCurrentUserId } from "@/lib/user";
import {
  DEFAULT_USER_MEDIA,
  mergeUserMedia,
  userMediaSelect,
  type UserMediaFields,
} from "@/lib/db/user-media";
import { LEAN_MEDIA_WITH_TAXONOMY_SELECT } from "@/lib/db/media-select";
import { sortMediaTitleRows, type SortDirection } from "@/lib/media-sort";
import { alpha } from "@mui/material/styles";
import {
  ACCENTS,
  mediaAccent,
  mediaTypeTabIndicatorColor,
  mediaTypeTabSx,
} from "@/lib/media-ui-helpers";
import { MediaPageNavigator } from "@/components/media/MediaPageNavigator";
import { LibraryFilters } from "@/components/media/LibraryFilters";
import {
  MediaRatingsList,
  type MediaRatingsListItem,
} from "@/components/media/MediaRatingsList";
import { PageAccentBackground } from "@/components/shared/PageAccentBackground";
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

  const selectedAccent =
    selectedType === ALL_MEDIA_TYPES ? ACCENTS.brand : mediaAccent(selectedType);

  return (
    <Stack spacing={3}>
      <PageAccentBackground
        mediaType={selectedType === ALL_MEDIA_TYPES ? null : selectedType}
      />
      <Box>
        <Typography variant="eyebrow" sx={{ display: "block", mb: 0.75 }}>
          Library
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontFamily:
              'var(--font-heading), "Satoshi", "General Sans", "Space Grotesk", "Inter", system-ui, sans-serif',
            fontSize: { xs: "2rem", md: "2.5rem" },
            fontWeight: 650,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
          }}
        >
          Everything,{" "}
          <Box
            component="span"
            sx={{
              color: selectedAccent,
              textShadow: `0 0 24px ${alpha(selectedAccent, 0.45)}`,
            }}
          >
            rated
          </Box>
          .
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }} variant="body2">
          Filter, rate inline, and sort by your personal score or the overall consensus.
        </Typography>
      </Box>
      <Card
        variant="outlined"
        sx={{
          borderLeft: `2px solid ${selectedAccent}`,
        }}
      >
        <CardContent>
          <Tabs
            allowScrollButtonsMobile
            scrollButtons="auto"
            sx={{ mb: 2 }}
            slotProps={{
              indicator: {
                sx: {
                  backgroundColor: mediaTypeTabIndicatorColor(
                    selectedType === ALL_MEDIA_TYPES ? null : selectedType,
                  ),
                },
              },
            }}
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
                sx={mediaTypeTabSx(type)}
                value={type}
              />
            ))}
          </Tabs>
          <Divider sx={{ mb: 2 }} />

          <LibraryFilters>
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
              <MenuItem value="pairwiseScore">Refined score</MenuItem>
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
            <Button sx={{ minHeight: 44 }} type="submit" variant="outlined">
              Apply
            </Button>
          </LibraryFilters>
        </CardContent>
      </Card>

      <Card sx={{ overflow: "hidden" }} variant="outlined">
        {items.length === 0 ? (
          <StatePanel
            action={{ href: "/media/new", label: "Add media" }}
            description="Adjust the filters or add a new movie, show, or game to start building your library."
            title="No media found"
          />
        ) : (
          <MediaRatingsList
            canRate={userId != null}
            items={items.map(toRatingsListItem)}
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
    </Stack>
  );
}

/** Flatten a Prisma row into the serializable shape the client list needs. */
function toRatingsListItem(item: MediaListItem): MediaRatingsListItem {
  return {
    id: item.id,
    title: item.title,
    mediaType: item.mediaType,
    status: item.status,
    personalRating: item.personalRating,
    computedPersonalScore: item.computedPersonalScore,
    computedConsensusScore: item.computedConsensusScore,
    isFavorite: item.isFavorite,
    isArchived: item.isArchived,
    posterUrl: item.posterUrl,
    genres: item.genres.map((entry) => entry.genre.name),
    tags: item.tags.map((entry) => entry.tag.name),
  };
}

type RawMediaListItem = Prisma.MediaItemGetPayload<{
  select: typeof LEAN_MEDIA_WITH_TAXONOMY_SELECT;
}> & { userMedia: UserMediaFields[] };

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
  const select = {
    ...LEAN_MEDIA_WITH_TAXONOMY_SELECT,
    ...userMediaSelect(userId),
  } satisfies Prisma.MediaItemSelect;

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
      select,
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
  // SQL via Prisma's relation orderBy, so the ranking happens in memory. Only
  // the sort key is loaded for the full match set — the taxonomy joins are then
  // hydrated for the one page being shown, the same two-step the title sort
  // above uses. (An `orderBy` on UserMedia wouldn't work here: items the user
  // has never touched have no row and would drop out of the list.)
  if (PER_USER_SORTS.has(sort)) {
    const keyRows = await prisma.mediaItem.findMany({
      where,
      select: {
        id: true,
        title: true,
        userMedia: {
          where: { userId: userId ?? "__anonymous__" },
          take: 1,
          select: {
            pairwiseScore: true,
            computedPersonalScore: true,
            personalRating: true,
          },
        },
      },
    });

    const ranked = keyRows
      .map((row) => ({
        id: row.id,
        title: row.title,
        pairwiseScore: row.userMedia[0]?.pairwiseScore ?? DEFAULT_USER_MEDIA.pairwiseScore,
        computedPersonalScore: row.userMedia[0]?.computedPersonalScore ?? null,
        personalRating: row.userMedia[0]?.personalRating ?? null,
      }))
      .sort((a, b) => compareByUserField(a, b, sort, direction));

    const pageIds = ranked.slice(skip, skip + PAGE_SIZE).map((row) => row.id);
    if (pageIds.length === 0) return { items: [], total: ranked.length };

    const pageItems = await prisma.mediaItem.findMany({
      select,
      where: { id: { in: pageIds } },
    });
    const itemsById = new Map(
      pageItems.map((item) => [item.id, mergeUserMedia(item)]),
    );

    return {
      items: pageIds
        .map((id) => itemsById.get(id))
        .filter((item): item is MediaListItem => Boolean(item)),
      total: ranked.length,
    };
  }

  const [total, items] = await Promise.all([
    prisma.mediaItem.count({ where }),
    prisma.mediaItem.findMany({
      select,
      orderBy: orderBy(sort, direction),
      skip,
      take: PAGE_SIZE,
      where,
    }),
  ]);

  return { items: items.map(mergeUserMedia), total };
}

/** The fields the per-user sorts rank on — all a sort key row needs to carry. */
type UserSortKey = {
  title: string;
  pairwiseScore: number;
  computedPersonalScore: number | null;
  personalRating: number | null;
};

function compareByUserField(
  a: UserSortKey,
  b: UserSortKey,
  sort: string,
  direction: SortDirection,
) {
  const valueOf = (item: UserSortKey) => {
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
  return query ? `/library?${query}` : "/library";
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
