import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { ReleaseCandidateStatus } from "@prisma/client";
import {
  approveReleaseCandidate,
  ignoreReleaseCandidate,
  importApprovedReleaseCandidate,
  rejectReleaseCandidate,
} from "@/app/upcoming/actions";
import { prisma } from "@/lib/prisma";
import { formatMediaType } from "@/lib/format";
import {
  isVisibleMediaType,
  VISIBLE_MEDIA_TYPES,
  visibleMediaTypeFilter,
} from "@/lib/media-types";
import { candidateReasons, parseList } from "@/lib/release-candidates";
import { StatePanel } from "@/components/shared/StatePanel";
import { ActionToastButton } from "@/components/shared/Toasts";
import { requireAdmin } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discovery Candidates" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin("/admin/candidates");
  const params = await searchParams;
  const requested = stringParam(params.type);
  const selectedType = isVisibleMediaType(requested)
    ? requested
    : VISIBLE_MEDIA_TYPES[0];

  const candidates = await prisma.releaseCandidate.findMany({
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
  });
  const visible = candidates.filter((c) => c.mediaType === selectedType);
  const counts = new Map(
    VISIBLE_MEDIA_TYPES.map((type) => [
      type,
      candidates.filter((c) => c.mediaType === type).length,
    ]),
  );

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.5}>
        <Typography variant="eyebrow">Admin</Typography>
        <Typography component="h1" sx={{ fontWeight: 650 }} variant="h4">
          Discovery Candidates
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Items fetched from external catalogs (TMDB, TVMAZE, IGDB, RAWG) staged
          before they enter recommendations. Admin-only.
        </Typography>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Tabs
            allowScrollButtonsMobile
            scrollButtons="auto"
            value={selectedType}
            variant="scrollable"
          >
            {VISIBLE_MEDIA_TYPES.map((type) => (
              <Tab
                component="a"
                href={`/admin/candidates?type=${type}`}
                key={type}
                label={`${formatMediaType(type)} (${counts.get(type) ?? 0})`}
                value={type}
              />
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Typography color="text.secondary" sx={{ mb: 1.5 }} variant="body2">
            {visible.length} staged{" "}
            {formatMediaType(selectedType).toLowerCase()} candidates
          </Typography>
          {visible.length > 0 ? (
            <Stack spacing={1.25}>
              {visible.map((candidate) => (
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
    </Stack>
  );
}

type ReleaseCandidateItem = Awaited<
  ReturnType<typeof prisma.releaseCandidate.findMany>
>[number];

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
              <Typography sx={{ color: "primary.main", fontWeight: 650 }}>
                {candidate.title}
              </Typography>
            </Link>
          ) : (
            <Typography sx={{ fontWeight: 650 }}>{candidate.title}</Typography>
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
          {genres.slice(0, 3).map((genre: string) => (
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

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
