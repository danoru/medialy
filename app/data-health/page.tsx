import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import type { CreditRole, MediaType } from "@prisma/client";
import Link from "next/link";
import {
  getDuplicateCandidates,
  getMetadataGapCounts,
  getMetadataGapItems,
  isMetadataGapKey,
  metadataGapChecks,
  type DuplicateCandidateGroup,
  type MetadataGapCheck,
  type MetadataGapKey,
  type MetadataGapRow,
} from "@/lib/db/metadata-gaps";
import { formatMediaType } from "@/lib/format";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import {
  mediaTypeTabIndicatorColor,
  mediaTypeTabSx,
} from "@/lib/media-ui-helpers";
import { StatePanel } from "@/components/shared/StatePanel";
import { requireAdmin } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data health" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const GROUPS: Array<{ key: MetadataGapCheck["group"]; label: string }> = [
  { key: "genres", label: "Genres" },
  { key: "credits", label: "Credits" },
  { key: "details", label: "Details" },
];

const ROLE_LABEL: Record<CreditRole, string> = {
  DIRECTOR: "Director",
  CREATOR: "Creator",
  DEVELOPER: "Developer",
  PUBLISHER: "Publisher",
  ACTOR: "Cast",
};

export default async function DataHealthPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin("/data-health");
  const params = await searchParams;
  const requestedType = stringParam(params.type);
  const selectedType = isVisibleMediaType(requestedType)
    ? requestedType
    : VISIBLE_MEDIA_TYPES[0];
  const checks = metadataGapChecks(selectedType);
  const requestedCheck = stringParam(params.check);
  const requestedPage = Number.parseInt(stringParam(params.page) ?? "", 10);

  // The default check depends on the counts, so they run first; the page of
  // rows and the duplicate scan then run side by side.
  const counts = await getMetadataGapCounts(selectedType);
  const selectedKey: MetadataGapKey | undefined = isMetadataGapKey(
    selectedType,
    requestedCheck,
  )
    ? requestedCheck
    : (checks.find((check) => counts[check.key] > 0) ?? checks[0])?.key;
  const selectedCheck = checks.find((check) => check.key === selectedKey);

  const [result, duplicates] = await Promise.all([
    selectedKey
      ? getMetadataGapItems(
          selectedType,
          selectedKey,
          Number.isFinite(requestedPage) ? requestedPage : 1,
        )
      : null,
    getDuplicateCandidates(selectedType),
  ]);

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="eyebrow">Admin</Typography>
        <Typography component="h1" sx={{ fontWeight: 650 }} variant="h4">
          Data health
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Titles with missing or suspect metadata, most-tracked first. Fix them
          from the title&apos;s edit page.
        </Typography>
        <Typography variant="body2">
          <Link href="/data-health/recommendations">
            Compare recommendation algorithms
          </Link>
        </Typography>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Tabs
            allowScrollButtonsMobile
            scrollButtons="auto"
            sx={{ mb: 2 }}
            slotProps={{
              indicator: {
                sx: { backgroundColor: mediaTypeTabIndicatorColor(selectedType) },
              },
            }}
            value={selectedType}
            variant="scrollable"
          >
            {VISIBLE_MEDIA_TYPES.map((type) => (
              <Tab
                component="a"
                href={`/data-health?type=${type}`}
                key={type}
                label={formatMediaType(type)}
                sx={mediaTypeTabSx(type)}
                value={type}
              />
            ))}
          </Tabs>
          <Divider />
        </CardContent>
      </Card>

      <Box
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "280px minmax(0, 1fr)",
          },
        }}
      >
        <Checklist
          checks={checks}
          counts={counts}
          selectedKey={selectedKey}
          type={selectedType}
        />
        <Card variant="outlined">
          <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
            {selectedCheck && result ? (
              <Results
                check={selectedCheck}
                page={result.page}
                pageCount={result.pageCount}
                rows={result.items}
                total={result.total}
                type={selectedType}
              />
            ) : (
              <StatePanel
                description="There are no checks for this media type."
                minHeight={140}
                title="Nothing to check"
              />
            )}
          </CardContent>
        </Card>
      </Box>

      <DuplicateCandidates groups={duplicates} />
    </Stack>
  );
}

function Checklist({
  checks,
  counts,
  selectedKey,
  type,
}: {
  checks: MetadataGapCheck[];
  counts: Record<string, number>;
  selectedKey: MetadataGapKey | undefined;
  type: MediaType;
}) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
        {GROUPS.map((group) => {
          const groupChecks = checks.filter(
            (check) => check.group === group.key,
          );
          if (groupChecks.length === 0) return null;
          return (
            <Box key={group.key} sx={{ pb: 1 }}>
              <Typography
                color="text.secondary"
                sx={{ display: "block", fontWeight: 650, px: 1, py: 0.75 }}
                variant="caption"
              >
                {group.label}
              </Typography>
              {groupChecks.map((check) => {
                const count = counts[check.key] ?? 0;
                const selected = check.key === selectedKey;
                return (
                  <Box
                    component="a"
                    href={`/data-health?type=${type}&check=${check.key}`}
                    key={check.key}
                    sx={{
                      alignItems: "center",
                      bgcolor: selected ? "action.selected" : "transparent",
                      borderLeft: "3px solid",
                      borderLeftColor: selected
                        ? "primary.main"
                        : "transparent",
                      borderRadius: 1,
                      color: selected ? "primary.main" : "text.primary",
                      display: "flex",
                      fontWeight: selected ? 650 : 400,
                      gap: 1,
                      justifyContent: "space-between",
                      px: 1,
                      py: 0.75,
                      textDecoration: "none",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <Typography
                      component="span"
                      sx={{ font: "inherit" }}
                      variant="body2"
                    >
                      {check.label}
                    </Typography>
                    <Typography
                      color={count > 0 ? "warning.main" : "text.secondary"}
                      component="span"
                      sx={{ fontWeight: 650 }}
                      variant="body2"
                    >
                      {count}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Results({
  check,
  page,
  pageCount,
  rows,
  total,
  type,
}: {
  check: MetadataGapCheck;
  page: number;
  pageCount: number;
  rows: MetadataGapRow[];
  total: number;
  type: MediaType;
}) {
  const base = `/data-health?type=${type}&check=${check.key}`;
  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.25}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography sx={{ flex: 1, fontWeight: 650 }} variant="h6">
            {check.label}
          </Typography>
          <Chip
            color={total > 0 ? "warning" : "default"}
            label={total}
            size="small"
          />
        </Stack>
        <Typography color="text.secondary" variant="body2">
          {check.description}
        </Typography>
      </Stack>
      {rows.length > 0 ? (
        <>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Year</TableCell>
                  <TableCell>Genres</TableCell>
                  <TableCell>Credits</TableCell>
                  <TableCell align="right">Tracked by</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <GapRow key={row.id} row={row} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Button
              disabled={page <= 1}
              href={`${base}&page=${page - 1}`}
              size="small"
              variant="outlined"
            >
              Previous
            </Button>
            <Typography color="text.secondary" variant="body2">
              Page {page} of {pageCount}
            </Typography>
            <Button
              disabled={page >= pageCount}
              href={`${base}&page=${page + 1}`}
              size="small"
              variant="outlined"
            >
              Next
            </Button>
          </Stack>
        </>
      ) : (
        <StatePanel
          description="Every title of this type passes this check."
          minHeight={140}
          title="No issues"
        />
      )}
    </Stack>
  );
}

function GapRow({ row }: { row: MetadataGapRow }) {
  const year = row.releaseDate?.getUTCFullYear();
  const genres = row.genres.map((entry) => entry.genre.name);
  return (
    <TableRow hover>
      <TableCell>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          {row.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              src={row.posterUrl}
              style={{
                aspectRatio: "2/3",
                borderRadius: 4,
                flexShrink: 0,
                objectFit: "cover",
                width: 32,
              }}
            />
          ) : (
            <Box sx={{ flexShrink: 0, width: 32 }} />
          )}
          <Link href={`/media/${row.id}`} style={{ textDecoration: "none" }}>
            <Typography
              sx={{ color: "primary.main", fontWeight: 650 }}
              variant="body2"
            >
              {row.title}
            </Typography>
          </Link>
        </Stack>
      </TableCell>
      <TableCell>{year ?? "—"}</TableCell>
      <TableCell>{genres.length > 0 ? genres.join(", ") : "—"}</TableCell>
      <TableCell>{summarizeCredits(row.credits)}</TableCell>
      <TableCell align="right">{row._count.userMedia}</TableCell>
      <TableCell align="right">
        <Button href={`/media/${row.id}/edit`} size="small" variant="outlined">
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
}

function DuplicateCandidates({
  groups,
}: {
  groups: DuplicateCandidateGroup[];
}) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", mb: 1.5 }}
        >
          <Typography sx={{ flex: 1, fontWeight: 650 }} variant="h6">
            Duplicate candidates
          </Typography>
          <Chip
            color={groups.length > 0 ? "warning" : "default"}
            label={groups.length}
            size="small"
          />
        </Stack>
        {groups.length > 0 ? (
          <Stack spacing={1.25}>
            {groups.map((group) => (
              <Box key={group.key}>
                <Typography color="text.secondary" variant="body2">
                  {group.title} · {group.year ?? "Unknown year"}
                </Typography>
                <Stack
                  direction="row"
                  sx={{ flexWrap: "wrap", gap: 1, mt: 0.5 }}
                >
                  {group.items.map((item) => (
                    <Chip
                      clickable
                      component="a"
                      href={`/media/${item.id}`}
                      key={item.id}
                      label={item.title}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <StatePanel
            description="No same-title, same-year titles for this media type."
            minHeight={120}
            title="No duplicate candidates"
          />
        )}
      </CardContent>
    </Card>
  );
}

function summarizeCredits(credits: MetadataGapRow["credits"]) {
  const byRole = new Map<CreditRole, string[]>();
  for (const credit of credits) {
    byRole.set(credit.role, [
      ...(byRole.get(credit.role) ?? []),
      credit.contributor.name,
    ]);
  }
  if (byRole.size === 0) return "—";
  return [...byRole.entries()]
    .map(([role, names]) => `${ROLE_LABEL[role]}: ${names.join(", ")}`)
    .join(" · ");
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
