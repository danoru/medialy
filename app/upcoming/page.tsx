import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { ReleaseCandidateStatus, type MediaType } from "@prisma/client";
import {
  approveReleaseCandidate,
  clearReleaseDate,
  ignoreReleaseCandidate,
  importApprovedReleaseCandidate,
  rejectReleaseCandidate,
} from "@/app/upcoming/actions";
import { prisma } from "@/lib/prisma";
import { formatMediaType, formatStatus } from "@/lib/format";
import {
  isVisibleMediaType,
  VISIBLE_MEDIA_TYPES,
  visibleMediaTypeFilter,
} from "@/lib/media-types";
import { candidateReasons, parseList } from "@/lib/release-candidates";
import {
  formatUpcomingRelativeLabel,
  groupUpcomingItems,
  startOfToday,
} from "@/lib/upcoming";
import { StatePanel } from "@/components/shared/StatePanel";
import { ActionToastButton } from "@/components/shared/Toasts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upcoming" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedType = stringParam(params.type);
  const selectedType = isVisibleMediaType(requestedType)
    ? requestedType
    : VISIBLE_MEDIA_TYPES[0];
  const now = new Date();
  const today = startOfToday(now);
  const [items, candidates] = await Promise.all([
    prisma.mediaItem.findMany({
      where: {
        isArchived: false,
        mediaType: selectedType,
        releaseDate: { gte: today },
      },
      include: {
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
      },
      orderBy: [{ releaseDate: "asc" }, { title: "asc" }],
    }),
    prisma.releaseCandidate.findMany({
      where: {
        mediaType: visibleMediaTypeFilter(),
        status: {
          in: [
            ReleaseCandidateStatus.PENDING,
            ReleaseCandidateStatus.APPROVED,
            ReleaseCandidateStatus.IGNORED,
          ],
        },
      },
      orderBy: [
        { status: "asc" },
        { finalScore: "desc" },
        { releaseDate: "asc" },
        { title: "asc" },
      ],
    }),
  ]);

  const groups = groupUpcomingItems(items, now);
  const futureCount = groups.next30Days.length + groups.later.length;
  const visibleCandidates = candidates.filter(
    (candidate) => candidate.mediaType === selectedType,
  );
  const candidateCounts = new Map(
    VISIBLE_MEDIA_TYPES.map((type) => [
      type,
      candidates.filter((candidate) => candidate.mediaType === type).length,
    ]),
  );

  return (
    <Stack spacing={2.5}>
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
                href={`/upcoming?type=${type}`}
                key={type}
                label={formatMediaType(type)}
                value={type}
              />
            ))}
          </Tabs>
          <Divider />
        </CardContent>
      </Card>

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard label="Future releases" value={futureCount} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard label="Needs review" value={groups.needsReview.length} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard label="Total dated items" value={items.length} />
        </Grid>
      </Grid>

      <CandidateQueue
        candidates={visibleCandidates}
        counts={candidateCounts}
        selectedType={selectedType}
      />

      <ReleaseSection
        empty={<EmptyState />}
        items={groups.next30Days}
        now={now}
        title="Next 30 Days"
      />

      <ReleaseSection items={groups.later} now={now} title="Later" />

      <ReleaseSection
        description="These dates have passed. Set the release date, clear the stale date, or open edit for status changes."
        items={groups.needsReview}
        now={now}
        showReviewActions
        title="Needs Review"
      />
    </Stack>
  );
}

type ReleaseCandidateItem = Awaited<
  ReturnType<typeof prisma.releaseCandidate.findMany>
>[number];

function CandidateQueue({
  candidates,
  counts,
  selectedType,
}: {
  candidates: ReleaseCandidateItem[];
  counts: Map<MediaType, number>;
  selectedType: MediaType;
}) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ mb: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800 }} variant="h6">
              Discovery Candidates
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Fetched catalog items staged or auto-muted before they enter
              recommendations.
            </Typography>
          </Box>
          <Chip
            label={candidates.length}
            size="small"
            sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
          />
        </Stack>
        <Typography color="text.secondary" sx={{ mb: 1.5 }} variant="body2">
          {counts.get(selectedType) ?? 0} staged{" "}
          {formatMediaType(selectedType).toLowerCase()} candidates
        </Typography>
        {candidates.length > 0 ? (
          <Stack spacing={1.25}>
            {candidates.map((candidate) => (
              <CandidateRow candidate={candidate} key={candidate.id} />
            ))}
          </Stack>
        ) : (
          <StatePanel
            description={`Fetched ${formatMediaType(selectedType).toLowerCase()} candidates will appear here before they enter recommendations.`}
            minHeight={170}
            title={`No staged ${formatMediaType(selectedType).toLowerCase()} candidates`}
          />
        )}
      </CardContent>
    </Card>
  );
}

function CandidateRow({ candidate }: { candidate: ReleaseCandidateItem }) {
  const genres = parseList(candidate.genresJson);
  const reasons = candidateReasons(candidate);

  return (
    <Stack
      direction={{ xs: "column", lg: "row" }}
      spacing={1.5}
      sx={{
        alignItems: { lg: "center" },
        borderBottom: "1px solid",
        borderColor: "divider",
        pb: 1.25,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          {candidate.externalUrl ? (
            <Link
              href={candidate.externalUrl}
              style={{ textDecoration: "none" }}
              target="_blank"
            >
              <Typography sx={{ color: "primary.main", fontWeight: 800 }}>
                {candidate.title}
              </Typography>
            </Link>
          ) : (
            <Typography sx={{ fontWeight: 800 }}>{candidate.title}</Typography>
          )}
          <Chip
            color={
              candidate.status === ReleaseCandidateStatus.APPROVED
                ? "success"
                : "default"
            }
            label={candidate.status.toLowerCase()}
            size="small"
          />
          <Chip
            label={candidate.externalSource}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`Score ${Math.round(candidate.finalScore)}`}
            size="small"
            variant="outlined"
          />
        </Stack>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.6, mt: 0.8 }}>
          <Chip
            label={
              candidate.releaseDate?.toLocaleDateString() ?? "Date unknown"
            }
            size="small"
          />
          {genres.slice(0, 3).map((genre) => (
            <Chip key={genre} label={genre} size="small" variant="outlined" />
          ))}
          {reasons.slice(0, 4).map((reason) => (
            <Chip
              key={reason.label}
              label={`${reason.label} ${reason.value > 0 ? "+" : ""}${reason.value}`}
              size="small"
              variant="outlined"
            />
          ))}
        </Stack>
      </Box>
      <Stack
        direction="row"
        sx={{ flexWrap: "wrap", gap: 0.75, justifyContent: { lg: "flex-end" } }}
      >
        {candidate.status !== ReleaseCandidateStatus.APPROVED ? (
          <form action={approveReleaseCandidate.bind(null, candidate.id)}>
            <ActionToastButton
              size="small"
              successMessage="Candidate approved."
              variant="outlined"
            >
              Approve
            </ActionToastButton>
          </form>
        ) : null}
        <form action={importApprovedReleaseCandidate.bind(null, candidate.id)}>
          <ActionToastButton
            color="success"
            size="small"
            successMessage="Candidate imported."
            variant="contained"
          >
            Import
          </ActionToastButton>
        </form>
        <form action={rejectReleaseCandidate.bind(null, candidate.id)}>
          <ActionToastButton
            color="warning"
            size="small"
            successMessage="Candidate rejected."
            variant="outlined"
          >
            Reject
          </ActionToastButton>
        </form>
        <form action={ignoreReleaseCandidate.bind(null, candidate.id)}>
          <ActionToastButton
            size="small"
            successMessage="Candidate ignored."
            variant="text"
          >
            Ignore
          </ActionToastButton>
        </form>
      </Stack>
    </Stack>
  );
}

type ReleaseSectionItem = Awaited<
  ReturnType<typeof prisma.mediaItem.findMany>
>[number] & {
  genres: Array<{ genre: { name: string } }>;
};

function ReleaseSection({
  description,
  empty = null,
  items,
  now,
  showReviewActions = false,
  title,
}: {
  description?: string;
  empty?: React.ReactNode;
  items: ReleaseSectionItem[];
  now: Date;
  showReviewActions?: boolean;
  title: string;
}) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ mb: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800 }} variant="h6">
              {title}
            </Typography>
            {description ? (
              <Typography color="text.secondary" variant="body2">
                {description}
              </Typography>
            ) : null}
          </Box>
          <Chip
            label={items.length}
            size="small"
            sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
          />
        </Stack>
        {items.length > 0 ? (
          <Stack spacing={1.25}>
            {items.map((item) => (
              <ReleaseRow
                genres={item.genres.map((entry) => entry.genre.name)}
                id={item.id}
                key={item.id}
                mediaType={item.mediaType}
                now={now}
                showReviewActions={showReviewActions}
                status={item.status}
                title={item.title}
                releaseDate={item.releaseDate}
              />
            ))}
          </Stack>
        ) : (
          empty
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Typography
          color="text.secondary"
          sx={{ fontWeight: 700, textTransform: "uppercase" }}
          variant="caption"
        >
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 800 }} variant="h5">
          {value.toLocaleString()}
        </Typography>
      </CardContent>
    </Card>
  );
}

function ReleaseRow({
  genres,
  id,
  mediaType,
  now,
  showReviewActions = false,
  status,
  title,
  releaseDate,
}: {
  genres: string[];
  id: string;
  mediaType: string;
  now: Date;
  showReviewActions?: boolean;
  status: string;
  title: string;
  releaseDate: Date | null;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      sx={{
        alignItems: { sm: "center" },
        borderBottom: "1px solid",
        borderColor: "divider",
        pb: 1.25,
      }}
    >
      <Stack
        direction="row"
        spacing={1.25}
        sx={{ alignItems: "center", flex: 1, minWidth: 0 }}
      >
        <CalendarMonthIcon color="primary" />
        <Box sx={{ minWidth: 0 }}>
          <Link href={`/media/${id}`} style={{ textDecoration: "none" }}>
            <Typography noWrap sx={{ color: "primary.main", fontWeight: 800 }}>
              {title}
            </Typography>
          </Link>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.6, mt: 0.6 }}>
            <Chip label={formatMediaType(mediaType)} size="small" />
            <Chip
              label={formatStatus(status)}
              size="small"
              variant="outlined"
            />
            {genres.slice(0, 3).map((genre) => (
              <Chip key={genre} label={genre} size="small" variant="outlined" />
            ))}
          </Stack>
        </Box>
      </Stack>
      <Stack
        direction={{ xs: "row", sm: "row" }}
        spacing={1}
        sx={{
          alignItems: "center",
          justifyContent: { xs: "space-between", sm: "flex-end" },
        }}
      >
        <Box sx={{ minWidth: { sm: 112 }, textAlign: { sm: "right" } }}>
          <Typography
            color="text.secondary"
            sx={{ whiteSpace: "nowrap" }}
            variant="body2"
          >
            {releaseDate ? releaseDate.toLocaleDateString() : "-"}
          </Typography>
          {releaseDate ? (
            <Typography
              color="text.secondary"
              sx={{ whiteSpace: "nowrap" }}
              variant="caption"
            >
              {formatUpcomingRelativeLabel(releaseDate, now)}
            </Typography>
          ) : null}
        </Box>
        <Stack
          direction="row"
          sx={{ flexWrap: "wrap", gap: 0.75, justifyContent: "flex-end" }}
        >
          <Button href={`/media/${id}`} size="small" variant="outlined">
            Open
          </Button>
          <Button href={`/media/${id}/edit`} size="small" variant="contained">
            Edit
          </Button>
          {showReviewActions ? (
            <form action={clearReleaseDate.bind(null, id)}>
              <ActionToastButton
                color="warning"
                size="small"
                successMessage="Release date cleared."
                variant="outlined"
              >
                Clear date
              </ActionToastButton>
            </form>
          ) : null}
        </Stack>
      </Stack>
    </Stack>
  );
}

function EmptyState() {
  return (
    <StatePanel
      action={{ href: "/media/new", label: "Add one" }}
      description="Future-dated media will appear here once release dates are added."
      icon={<CalendarMonthIcon />}
      title="No releases in the next 30 days"
    />
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
