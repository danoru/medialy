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
import type { MediaStatus, MediaType } from "@prisma/client";
import { clearReleaseDate } from "@/app/upcoming/actions";
import {
  approveMediaEditSuggestion,
  rejectMediaEditSuggestion,
} from "@/app/upcoming/suggestions/actions";
import { prisma } from "@/lib/prisma";
import { formatMediaType } from "@/lib/format";
import { statusLabel } from "@/lib/status-labels";
import {
  isVisibleMediaType,
  VISIBLE_MEDIA_TYPES,
} from "@/lib/media-types";
import {
  formatUpcomingRelativeLabel,
  groupUpcomingItems,
  startOfToday,
} from "@/lib/upcoming";
import { StatePanel } from "@/components/shared/StatePanel";
import { ActionToastButton } from "@/components/shared/Toasts";
import { getCurrentUser } from "@/lib/user";
import { mergeUserMedia, userMediaInclude } from "@/lib/db/user-media";
import {
  diffSnapshots,
  type EditSuggestionSnapshot,
  type SuggestionDiffField,
} from "@/lib/edit-suggestions";

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
  const user = await getCurrentUser();
  const userId = user?.id ?? null;
  const isAdmin = Boolean(user?.isAdmin);
  const isSignedIn = Boolean(userId);
  const archivedFilter =
    userId == null
      ? {}
      : {
          OR: [
            { userMedia: { none: { userId } } },
            { userMedia: { some: { userId, isArchived: false } } },
          ],
        };
  const rawItems = await prisma.mediaItem.findMany({
    where: {
      mediaType: selectedType,
      releaseDate: { gte: today },
      ...archivedFilter,
    },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
      ...userMediaInclude(userId),
    },
    orderBy: [{ releaseDate: "asc" }, { title: "asc" }],
  });

  const items = rawItems.map(mergeUserMedia);
  const groups = groupUpcomingItems(items, now);
  const futureCount = groups.next30Days.length + groups.later.length;

  const pendingSuggestions = isAdmin
    ? await prisma.mediaEditSuggestion.findMany({
        where: {
          status: "PENDING",
          OR: [
            { media: { mediaType: selectedType } },
            { mediaId: null },
          ],
        },
        include: {
          media: { select: { id: true, title: true, mediaType: true } },
          user: { select: { displayName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

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

      {isAdmin ? (
        <SuggestionQueue
          mediaType={selectedType}
          suggestions={pendingSuggestions}
        />
      ) : null}

      <ReleaseSection
        empty={<EmptyState />}
        isSignedIn={isSignedIn}
        items={groups.next30Days}
        now={now}
        title="Next 30 Days"
      />

      <ReleaseSection
        isSignedIn={isSignedIn}
        items={groups.later}
        now={now}
        title="Later"
      />

      <ReleaseSection
        description="These dates have passed. Set the release date, clear the stale date, or open edit for status changes."
        isSignedIn={isSignedIn}
        items={groups.needsReview}
        now={now}
        showReviewActions
        title="Needs Review"
      />
    </Stack>
  );
}

type SuggestionRowData = {
  id: string;
  mediaId: string | null;
  beforeJson: string | null;
  afterJson: string;
  createdAt: Date;
  note: string | null;
  media: { id: string; title: string; mediaType: MediaType } | null;
  user: { displayName: string; email: string | null };
};

function SuggestionQueue({
  mediaType,
  suggestions,
}: {
  mediaType: MediaType;
  suggestions: SuggestionRowData[];
}) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ mb: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 650 }} variant="h6">
              Pending edit suggestions
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Edits and additions proposed by signed-in users. Review the diff
              before applying — admin-only.
            </Typography>
          </Box>
          <Chip
            label={suggestions.length}
            size="small"
            sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
          />
        </Stack>
        {suggestions.length > 0 ? (
          <Stack spacing={1.25}>
            {suggestions.map((suggestion) => (
              <SuggestionRow key={suggestion.id} suggestion={suggestion} />
            ))}
          </Stack>
        ) : (
          <StatePanel
            description={`No pending ${formatMediaType(mediaType).toLowerCase()} edit suggestions right now.`}
            minHeight={140}
            title="Nothing to review"
          />
        )}
      </CardContent>
    </Card>
  );
}

function SuggestionRow({ suggestion }: { suggestion: SuggestionRowData }) {
  const before = suggestion.beforeJson
    ? (JSON.parse(suggestion.beforeJson) as EditSuggestionSnapshot)
    : null;
  const after = JSON.parse(suggestion.afterJson) as EditSuggestionSnapshot;
  const diff = diffSnapshots(before, after);
  const title = suggestion.media?.title ?? after.title;
  const isAddition = !suggestion.mediaId;
  const author =
    suggestion.user.displayName || suggestion.user.email || "Unknown user";

  return (
    <Stack
      spacing={1}
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        pb: 1.25,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ alignItems: { sm: "center" }, flexWrap: "wrap" }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {suggestion.media ? (
            <Link
              href={`/media/${suggestion.media.id}`}
              style={{ textDecoration: "none" }}
            >
              <Typography sx={{ color: "primary.main", fontWeight: 650 }}>
                {title}
              </Typography>
            </Link>
          ) : (
            <Typography sx={{ fontWeight: 650 }}>{title}</Typography>
          )}
          <Stack direction="row" spacing={0.6} sx={{ flexWrap: "wrap", mt: 0.5 }}>
            <Chip
              color={isAddition ? "secondary" : "default"}
              label={isAddition ? "New item" : "Edit"}
              size="small"
            />
            <Chip
              label={formatMediaType(after.mediaType as MediaType)}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`Suggested by ${author}`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={suggestion.createdAt.toLocaleDateString()}
              size="small"
              variant="outlined"
            />
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
          <form action={approveMediaEditSuggestion.bind(null, suggestion.id)}>
            <ActionToastButton
              color="success"
              size="small"
              successMessage="Suggestion applied."
              variant="contained"
            >
              Approve
            </ActionToastButton>
          </form>
          <form action={rejectMediaEditSuggestion.bind(null, suggestion.id)}>
            <ActionToastButton
              color="warning"
              size="small"
              successMessage="Suggestion rejected."
              variant="outlined"
            >
              Reject
            </ActionToastButton>
          </form>
        </Stack>
      </Stack>
      <SuggestionDiff diff={diff} isAddition={isAddition} />
    </Stack>
  );
}

function SuggestionDiff({
  diff,
  isAddition,
}: {
  diff: SuggestionDiffField[];
  isAddition: boolean;
}) {
  if (diff.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        No field changes detected.
      </Typography>
    );
  }
  return (
    <Stack spacing={0.5}>
      {diff.map((field) => (
        <Stack
          direction={{ xs: "column", md: "row" }}
          key={field.field}
          spacing={1}
          sx={{ alignItems: { md: "flex-start" } }}
        >
          <Typography
            sx={{ fontWeight: 600, minWidth: { md: 140 } }}
            variant="body2"
          >
            {field.label}
          </Typography>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{ flex: 1, minWidth: 0 }}
          >
            {!isAddition ? (
              <Box
                sx={{
                  borderLeft: "3px solid",
                  borderColor: "error.main",
                  borderRadius: 0.5,
                  flex: 1,
                  px: 1,
                  py: 0.5,
                }}
              >
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: 11, fontWeight: 600 }}
                >
                  Before
                </Typography>
                <Typography sx={{ whiteSpace: "pre-wrap" }} variant="body2">
                  {field.before || "—"}
                </Typography>
              </Box>
            ) : null}
            <Box
              sx={{
                borderLeft: "3px solid",
                borderColor: "success.main",
                borderRadius: 0.5,
                flex: 1,
                px: 1,
                py: 0.5,
              }}
            >
              <Typography
                color="text.secondary"
                sx={{ fontSize: 11, fontWeight: 600 }}
              >
                {isAddition ? "Proposed" : "After"}
              </Typography>
              <Typography sx={{ whiteSpace: "pre-wrap" }} variant="body2">
                {field.after || "—"}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

type ReleaseSectionItem = Awaited<
  ReturnType<typeof prisma.mediaItem.findMany>
>[number] & {
  genres: Array<{ genre: { name: string } }>;
  status: import("@prisma/client").MediaStatus;
};

function ReleaseSection({
  description,
  empty = null,
  isSignedIn,
  items,
  now,
  showReviewActions = false,
  title,
}: {
  description?: string;
  empty?: React.ReactNode;
  isSignedIn: boolean;
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
            <Typography sx={{ fontWeight: 650 }} variant="h6">
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
                isSignedIn={isSignedIn}
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
        <Typography color="text.secondary" variant="eyebrow">
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 650 }} variant="h5">
          {value.toLocaleString()}
        </Typography>
      </CardContent>
    </Card>
  );
}

function ReleaseRow({
  genres,
  id,
  isSignedIn,
  mediaType,
  now,
  showReviewActions = false,
  status,
  title,
  releaseDate,
}: {
  genres: string[];
  id: string;
  isSignedIn: boolean;
  mediaType: MediaType;
  now: Date;
  showReviewActions?: boolean;
  status: MediaStatus;
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
            <Typography noWrap sx={{ color: "primary.main", fontWeight: 650 }}>
              {title}
            </Typography>
          </Link>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.6, mt: 0.6 }}>
            <Chip label={formatMediaType(mediaType)} size="small" />
            <Chip
              label={statusLabel(status, mediaType)}
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
          {isSignedIn ? (
            <Button href={`/media/${id}/edit`} size="small" variant="contained">
              Edit
            </Button>
          ) : null}
          {showReviewActions && isSignedIn ? (
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
