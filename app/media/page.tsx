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
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 50;

export default async function MediaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const filter = stringParam(params.filter);
  const sort = stringParam(params.sort) || "title";
  const requestedType = stringParam(params.type);
  const selectedType = isVisibleMediaType(requestedType)
    ? requestedType
    : VISIBLE_MEDIA_TYPES[0];
  const page = Math.max(1, intParam(params.page) ?? 1);
  const where: Prisma.MediaItemWhereInput = { mediaType: selectedType };

  if (stringParam(params.status))
    where.status = stringParam(params.status) as MediaStatus;
  if (stringParam(params.favorite) === "true") where.isFavorite = true;
  if (stringParam(params.archived) !== "true") where.isArchived = false;
  if (filter) {
    where.OR = [
      { genres: { some: { genre: { name: { contains: filter } } } } },
      { tags: { some: { tag: { name: { contains: filter } } } } },
      { title: { contains: filter } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.mediaItem.count({ where }),
    prisma.mediaItem.findMany({
      where,
      include: {
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
      },
      orderBy: orderBy(sort),
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

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between" }}
      >
        <Box>
          <Typography component="h1" sx={{ fontWeight: 700 }} variant="h4">
            Media Library
          </Typography>
          <Typography color="text.secondary">
            Browse, filter, add, and edit local media.
          </Typography>
        </Box>
        <Button href="/media/new" variant="contained">
          Add media
        </Button>
      </Stack>

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
            />
            <TextField
              defaultValue={stringParam(params.status) ?? ""}
              label="Status"
              name="status"
              select
              size="small"
              sx={{ minWidth: 170 }}
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
              sx={{ minWidth: 140 }}
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
              sx={{ minWidth: 140 }}
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
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="title">Title</MenuItem>
              <MenuItem value="releaseDate">Release date</MenuItem>
              <MenuItem value="pairwiseScore">Pairwise score</MenuItem>
              <MenuItem value="personalRating">Personal rating</MenuItem>
              <MenuItem value="updatedAt">Updated</MenuItem>
            </TextField>
            <Button type="submit" variant="outlined">
              Apply
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Genres</TableCell>
              <TableCell align="right">Score</TableCell>
              <TableCell align="right">Rating</TableCell>
              <TableCell>Updated</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow hover key={item.id}>
                <TableCell>
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
                  {Math.round(item.pairwiseScore)}
                </TableCell>
                <TableCell align="right">
                  {item.personalRating ?? "-"}
                </TableCell>
                <TableCell>{item.updatedAt.toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <CardContent>
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
        </CardContent>
      </Card>
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

function orderBy(sort: string): Prisma.MediaItemOrderByWithRelationInput[] {
  if (sort === "releaseDate")
    return [{ releaseDate: "desc" }, { title: "asc" }];
  if (sort === "pairwiseScore")
    return [{ pairwiseScore: "desc" }, { title: "asc" }];
  if (sort === "personalRating")
    return [{ personalRating: "desc" }, { title: "asc" }];
  if (sort === "updatedAt") return [{ updatedAt: "desc" }, { title: "asc" }];
  return [{ title: "asc" }];
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
      "filter" | "type" | "status" | "favorite" | "archived" | "sort" | "page",
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
    "page",
  ] as const) {
    const nextValue =
      key in overrides ? overrides[key] : stringParam(params[key]);
    if (nextValue) searchParams.set(key, nextValue);
  }

  const query = searchParams.toString();
  return query ? `/media?${query}` : "/media";
}
