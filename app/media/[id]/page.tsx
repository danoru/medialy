import type { Metadata } from "next";
import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import type { CreditRole } from "@prisma/client";
import type { ReactElement, ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import {
  addNote,
  archiveMediaItem,
  deleteMediaItem,
  toggleFavoriteMediaItem,
  unarchiveMediaItem,
  updateMediaRating,
  updateMediaStatus,
  updateNote,
} from "@/app/media/actions";
import { ConfirmMediaAction } from "@/components/media/ConfirmMediaAction";
import { MediaDetailActions } from "@/components/media/MediaDetailActions";
import { MediaRatingControl } from "@/components/media/MediaRatingControl";
import { ActionToastButton } from "@/components/shared/Toasts";
import { CREDIT_ROLES_BY_MEDIA_TYPE, creditLabel } from "@/lib/credits";
import { formatStatus } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await prisma.mediaItem.findUnique({
    select: { title: true },
    where: { id },
  });

  return { title: item?.title ?? "Media Details" };
}

export default async function MediaDetailPage({
  params,
}: {
  params: PageParams;
}) {
  const { id } = await params;
  const item = await prisma.mediaItem.findUnique({
    include: {
      comparisonsLost: {
        include: { winner: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      comparisonsWon: {
        include: { loser: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      externalRatings: { orderBy: [{ source: "asc" }] },
      genres: { include: { genre: true } },
      credits: { include: { contributor: true }, orderBy: { order: "asc" } },
      notes: { orderBy: { updatedAt: "desc" } },
      tags: { include: { tag: true } },
    },
    where: { id },
  });
  if (!item) notFound();

  const comparisons = [
    ...item.comparisonsWon.map((entry) => ({
      createdAt: entry.createdAt,
      id: entry.id,
      opponent: entry.loser.title,
      result: "Beat",
    })),
    ...item.comparisonsLost.map((entry) => ({
      createdAt: entry.createdAt,
      id: entry.id,
      opponent: entry.winner.title,
      result: "Lost to",
    })),
  ]
    .sort(
      (first, second) => second.createdAt.getTime() - first.createdAt.getTime(),
    )
    .slice(0, 10);
  const genres = item.genres.map((entry) => entry.genre.name);
  const tags = item.tags.map((entry) => entry.tag.name);
  const releaseLabel = item.releaseDate
    ? item.releaseDate.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const yearLabel = item.releaseDate
    ? String(item.releaseDate.getUTCFullYear())
    : null;
  const creditsByRole = CREDIT_ROLES_BY_MEDIA_TYPE[item.mediaType]
    .map((role) => ({
      names: namesForRole(item.credits, role),
      role,
    }))
    .filter((entry) => entry.names.length > 0);
  const primaryCredit = creditsByRole[0];
  const missingFields = [
    item.description ? null : "description",
    item.posterUrl ? null : "poster",
    item.releaseDate ? null : "release date",
    genres.length > 0 ? null : "genres",
    item.externalRatings.length > 0 ? null : "external ratings",
  ].filter((field): field is string => field !== null);
  return (
    <Box sx={pageSx}>
      <Stack spacing={2.5}>
        <Button
          href="/media"
          size="small"
          startIcon={<ArrowBackRoundedIcon />}
          sx={backButtonSx}
          variant="text"
        >
          Back to media
        </Button>

        <Box sx={detailGridSx}>
          <Box sx={posterColumnSx}>
            <Box sx={posterFrameSx}>
              {item.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={`${item.title} poster`}
                  src={item.posterUrl}
                  style={{
                    display: "block",
                    height: "100%",
                    objectFit: "cover",
                    width: "100%",
                  }}
                />
              ) : (
                <Stack sx={posterPlaceholderSx}>
                  <Typography sx={{ fontSize: 12, fontWeight: 800 }}>
                    Poster missing
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 11 }}>
                    Add artwork to improve this page.
                  </Typography>
                </Stack>
              )}
            </Box>
          </Box>

          <Stack spacing={3} sx={{ minWidth: 0 }}>
            <Stack spacing={1.35}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{
                  alignItems: { sm: "flex-start" },
                  gap: 1.5,
                  justifyContent: "space-between",
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="h1" sx={heroTitleSx}>
                    {item.title}
                  </Typography>
                  {item.originalTitle ? (
                    <Typography color="text.secondary" sx={metadataTextSx}>
                      {item.originalTitle}
                    </Typography>
                  ) : null}
                </Box>
                <Button
                  href={`/media/${item.id}/edit`}
                  size="small"
                  startIcon={<EditRoundedIcon />}
                  sx={{ flexShrink: 0 }}
                  variant="text"
                >
                  Edit Details
                </Button>
              </Stack>

              <Stack
                direction="row"
                sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
              >
                {yearLabel ? (
                  <Typography sx={metaPillSx}>{yearLabel}</Typography>
                ) : null}
                {primaryCredit ? (
                  <Typography sx={creditLineSx}>
                    {creditLabel(item.mediaType, primaryCredit.role)}{" "}
                    <Box
                      component="span"
                      sx={{ color: detailTokens.accent.cyan }}
                    >
                      {primaryCredit.names.join(", ")}
                    </Box>
                  </Typography>
                ) : (
                  <Typography color="text.secondary" sx={metadataTextSx}>
                    No primary credits yet.
                  </Typography>
                )}
                {releaseLabel ? (
                  <Typography color="text.secondary" sx={metadataTextSx}>
                    {releaseLabel}
                  </Typography>
                ) : null}
              </Stack>

              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.7 }}>
                <StatusChip status={item.status} />
                {item.isFavorite ? (
                  <GlassChip icon={<StarRoundedIcon />} label="Favorite" warm />
                ) : null}
                {item.isArchived ? (
                  <GlassChip
                    icon={<ArchiveRoundedIcon />}
                    label="Archived"
                    warning
                  />
                ) : null}
                {[...genres, ...tags].slice(0, 5).map((label) => (
                  <GlassChip key={label} label={label} muted />
                ))}
              </Stack>
            </Stack>

            <SectionBlock
              actionHref={`/media/${item.id}/edit`}
              actionLabel="Edit Details"
              title="Synopsis"
            >
              <Typography
                color={item.description ? "text.primary" : "text.secondary"}
                sx={bodyTextSx}
              >
                {item.description || "No description yet."}
              </Typography>
            </SectionBlock>

            {/* <SectionBlock
              actionHref={`/media/${item.id}/edit`}
              actionLabel="Edit Credits"
              title="Credits"
            >
              {creditsByRole.length > 0 ? (
                <Stack sx={creditRowsSx}>
                  {creditsByRole.map((entry, index) => (
                    <Box key={entry.role} sx={creditRowSx(index === 0)}>
                      <Typography sx={creditRoleSx}>
                        {creditLabel(item.mediaType, entry.role)}
                      </Typography>
                      <Stack
                        direction="row"
                        sx={{ flexWrap: "wrap", gap: 0.75 }}
                      >
                        {entry.names.map((name) => (
                          <Chip
                            key={name}
                            label={name}
                            size="small"
                            sx={personChipSx}
                          />
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary" sx={bodyTextSx}>
                  No credits yet.
                </Typography>
              )}
            </SectionBlock> */}

            <Box id="notes" sx={panelSx(detailTokens.accent.emerald)}>
              <SectionHeader title="Notes" />
              <Stack spacing={1.2}>
                <Box action={addNote.bind(null, item.id)} component="form">
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    sx={{ alignItems: { md: "flex-start" }, gap: 1 }}
                  >
                    <TextField
                      fullWidth
                      minRows={2}
                      multiline
                      name="body"
                      placeholder="Write a note..."
                      sx={textareaSx}
                    />
                    <ActionToastButton
                      size="small"
                      successMessage="Note added."
                      sx={{ minWidth: 112 }}
                      variant="contained"
                    >
                      Add note
                    </ActionToastButton>
                  </Stack>
                </Box>

                {item.notes.map((note) => (
                  <Box
                    action={updateNote.bind(null, note.id, item.id)}
                    component="form"
                    key={note.id}
                    sx={noteRowSx}
                  >
                    <TextField
                      defaultValue={note.body}
                      fullWidth
                      minRows={2}
                      multiline
                      name="body"
                      sx={textareaSx}
                    />
                    <Stack
                      direction="row"
                      sx={{
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography color="text.secondary" sx={metadataTextSx}>
                        Updated {note.updatedAt.toLocaleDateString()}
                      </Typography>
                      <ActionToastButton
                        size="small"
                        successMessage="Note saved."
                        variant="outlined"
                      >
                        Save note
                      </ActionToastButton>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box sx={panelSx(detailTokens.accent.cyan)}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{
                  alignItems: { sm: "center" },
                  gap: 1,
                  justifyContent: "space-between",
                  mb: 1.5,
                }}
              >
                <SectionHeader title="Comparison History" />
                <Button
                  href={`/compare?focus=${item.id}`}
                  size="small"
                  startIcon={<CompareArrowsRoundedIcon />}
                  variant="outlined"
                >
                  Compare
                </Button>
              </Stack>

              {comparisons.length > 0 ? (
                <Box sx={comparisonTableSx}>
                  <Box sx={comparisonHeaderSx}>
                    <Typography sx={comparisonHeaderCellSx}>
                      Compared With
                    </Typography>
                    <Typography sx={comparisonHeaderCellSx}>Date</Typography>
                    <Typography sx={comparisonHeaderCellSx}>Result</Typography>
                  </Box>
                  {comparisons.map((entry) => (
                    <Box key={entry.id} sx={comparisonRowSx}>
                      <Typography sx={comparisonOpponentSx}>
                        {entry.opponent}
                      </Typography>
                      <Typography sx={comparisonDateSx}>
                        {entry.createdAt.toLocaleDateString()}
                      </Typography>
                      <Typography sx={comparisonResultSx(entry.result)}>
                        {entry.result}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Stack sx={emptyStateSx}>
                  <Typography sx={{ fontSize: 18, fontWeight: 900 }}>
                    No comparisons yet
                  </Typography>
                  <Typography color="text.secondary" sx={{ maxWidth: 430 }}>
                    Start comparing this media with others to see how it stacks
                    up.
                  </Typography>
                </Stack>
              )}
            </Box>
          </Stack>

          <Stack spacing={1.25} sx={rightRailSx}>
            <MediaDetailActions
              favoriteAction={toggleFavoriteMediaItem.bind(null, item.id)}
              isFavorite={item.isFavorite}
              status={item.status}
              statusAction={updateMediaStatus.bind(null, item.id)}
            />

            <Box sx={scorePanelSx}>
              <Stack spacing={1.25}>
                <Typography sx={kickerSx}>Your rating</Typography>
                <MediaRatingControl
                  action={updateMediaRating.bind(null, item.id)}
                  personalRating={item.personalRating}
                />

                <Divider sx={panelDividerSx} />

                <Box sx={scoreGridSx}>
                  <ScoreLine
                    color={detailTokens.accent.purple}
                    info={`Based on ${item.comparisonCount} ${item.comparisonCount === 1 ? "comparison" : "comparisons"}.`}
                    label="Pairwise"
                    value={formatNumber(Math.round(item.pairwiseScore))}
                  />
                  <ScoreLine
                    color={detailTokens.accent.green}
                    info={
                      item.computedConsensusScore == null
                        ? "Not enough external rating data yet."
                        : `${Math.round(item.consensusConfidence * 100)}% confidence.`
                    }
                    label="Consensus"
                    value={formatOptionalScore(item.computedConsensusScore)}
                  />
                </Box>

                {item.externalRatings.length > 0 ? (
                  <>
                    <Divider sx={panelDividerSx} />
                    <Typography sx={kickerSx}>External Ratings</Typography>
                    <Box sx={externalRatingsSx}>
                      {item.externalRatings.map((rating) => (
                        <ExternalRatingTile
                          key={rating.id}
                          label={formatRatingSource(rating.source)}
                          scale={rating.scale}
                          score={rating.score}
                          source={rating.source}
                        />
                      ))}
                    </Box>
                  </>
                ) : null}
              </Stack>
            </Box>

            {missingFields.length > 0 ? (
              <Box sx={dataCalloutSx}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={calloutTitleSx}>Improve data</Typography>
                  <Typography color="text.secondary" sx={metadataTextSx}>
                    Missing {missingFields.join(", ")}.
                  </Typography>
                </Box>
                <Button
                  href={`/media/${item.id}/edit`}
                  size="small"
                  startIcon={<EditRoundedIcon />}
                  variant="text"
                >
                  Edit
                </Button>
              </Box>
            ) : null}

            {/* <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
              <ConfirmMediaAction
                action={
                  item.isArchived
                    ? unarchiveMediaItem.bind(null, item.id)
                    : archiveMediaItem.bind(null, item.id)
                }
                actionLabel={item.isArchived ? "Unarchive" : "Archive"}
                buttonSx={archiveButtonSx}
                description={
                  item.isArchived
                    ? `${item.title} will return to active library views and comparison candidates.`
                    : `${item.title} will be hidden from active library views, recommendations, and comparison candidates.`
                }
                variant={item.isArchived ? "unarchive" : "archive"}
              />
              <ConfirmMediaAction
                action={deleteMediaItem.bind(null, item.id)}
                actionLabel="Delete"
                buttonSx={deleteButtonSx}
                confirmLabel="Delete permanently"
                description={`${item.title} and its notes, taxonomy links, list entries, and friend ratings will be permanently deleted.`}
                tone="danger"
                variant="delete"
              />
            </Stack> */}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

function GlassChip({
  icon,
  label,
  muted = false,
  success = false,
  warm = false,
  warning = false,
}: {
  icon?: ReactElement;
  label: string;
  muted?: boolean;
  success?: boolean;
  warm?: boolean;
  warning?: boolean;
}) {
  const accent = success
    ? detailTokens.accent.green
    : warm || warning
      ? detailTokens.accent.amber
      : detailTokens.accent.cyan;
  return (
    <Chip
      icon={icon}
      label={label}
      size="small"
      sx={{
        backgroundColor: alpha(
          muted ? detailTokens.text.frost : accent,
          muted ? 0.075 : 0.13,
        ),
        border: `1px solid ${alpha(success || warm || warning ? accent : detailTokens.text.frost, muted ? 0.11 : 0.2)}`,
        color: success
          ? "#86EFAC"
          : warm || warning
            ? "#FDE68A"
            : muted
              ? "text.secondary"
              : "text.primary",
        fontSize: "0.82rem",
        fontWeight: 550,
        "& .MuiChip-icon": {
          color: "inherit",
          fontSize: 17,
        },
      }}
    />
  );
}

function StatusChip({ status }: { status: string }) {
  const isCompleted = status === "COMPLETED";
  return (
    <GlassChip
      icon={isCompleted ? <CheckCircleRoundedIcon /> : undefined}
      label={formatStatus(status)}
      success={isCompleted}
    />
  );
}

function ScoreLine({
  color,
  info,
  label,
  meta,
  value,
}: {
  color?: string;
  info?: string;
  label: string;
  meta?: string;
  value: ReactNode;
}) {
  return (
    <Stack spacing={0.75}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.45 }}>
        <Typography sx={metricLabelSx}>{label}</Typography>
        {info ? (
          <Tooltip title={info}>
            <InfoOutlinedIcon sx={metricInfoIconSx} />
          </Tooltip>
        ) : null}
      </Stack>
      <Typography sx={{ ...scoreValueSx, ...(color ? { color } : {}) }}>
        {value}
      </Typography>
      {meta ? (
        <Typography color="text.secondary" sx={metadataTextSx}>
          {meta}
        </Typography>
      ) : null}
    </Stack>
  );
}

function ExternalRatingTile({
  label,
  scale,
  score,
  source,
}: {
  label: string;
  scale: number;
  score: number;
  source: string;
}) {
  return (
    <Box sx={externalRatingTileSx}>
      <Box sx={externalLogoSx(source)}>
        {source === "METACRITIC" ? "M" : label.charAt(0)}
      </Box>
      <Typography sx={externalSourceLabelSx}>{label}</Typography>
      <Typography sx={externalScoreSx}>
        {formatExternalRating(score, scale)}
      </Typography>
    </Box>
  );
}

function SectionBlock({
  actionHref,
  actionLabel,
  children,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  title: string;
}) {
  return (
    <Box sx={panelSx(detailTokens.accent.cyan)}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.3 }}
      >
        <SectionHeader title={title} />
        {actionHref && actionLabel ? (
          <Button
            href={actionHref}
            size="small"
            startIcon={<EditRoundedIcon />}
            variant="text"
          >
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Typography component="h2" sx={panelTitleSx}>
      {title}
    </Typography>
  );
}

function namesForRole(
  credits: Array<{
    role: CreditRole;
    contributor: { name: string };
    order: number;
  }>,
  role: CreditRole,
) {
  return credits
    .filter((credit) => credit.role === role)
    .sort((first, second) => first.order - second.order)
    .map((credit) => credit.contributor.name);
}

function formatExternalRating(score: number, scale: number) {
  return `${formatNumber(score)}/${formatNumber(scale)}`;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatOptionalScore(value: number | null) {
  return value == null ? "-" : formatNumber(value);
}

function formatRatingSource(source: string) {
  if (source === "METACRITIC") return "Metacritic";
  return source
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const detailTokens = {
  accent: {
    amber: "#F59E0B",
    cyan: "#5AE7FF",
    danger: "#F87171",
    emerald: "#00D6A3",
    green: "#22C55E",
    purple: "#9A5CFF",
  },
  background: {
    base: "#050816",
    panel: "#101527",
    panelDeep: "#090D19",
  },
  text: {
    frost: "#D8E6FF",
  },
};

function panelSx(accent: string) {
  return {
    background: `linear-gradient(155deg, ${alpha(detailTokens.background.panel, 0.78)} 0%, ${alpha(detailTokens.background.panelDeep, 0.91)} 100%)`,
    border: `1px solid ${alpha(detailTokens.text.frost, 0.09)}`,
    borderRadius: "8px",
    boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.055)}, 0 18px 52px ${alpha("#000000", 0.24)}, 0 0 36px ${alpha(accent, 0.055)}`,
    p: { xs: 1.5, md: 1.75 },
  } satisfies SxProps<Theme>;
}

const backButtonSx: SxProps<Theme> = {
  alignSelf: "flex-start",
  color: "text.secondary",
  px: 0,
  "&:hover": {
    backgroundColor: "transparent",
    color: "text.primary",
  },
};

const bodyTextSx: SxProps<Theme> = {
  fontSize: { xs: 15, md: 16 },
  fontWeight: 500,
  lineHeight: 1.75,
};

const archiveButtonSx: SxProps<Theme> = {
  backgroundColor: alpha(detailTokens.accent.amber, 0.12),
  borderColor: alpha(detailTokens.accent.amber, 0.36),
  color: "#FDE68A",
  "&:hover": {
    backgroundColor: alpha(detailTokens.accent.amber, 0.1),
    borderColor: alpha(detailTokens.accent.amber, 0.52),
  },
};

const calloutTitleSx: SxProps<Theme> = {
  color: detailTokens.accent.purple,
  fontSize: 13,
  fontWeight: 700,
};

const comparisonDateSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: 13,
  fontWeight: 500,
};

const comparisonHeaderCellSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const comparisonHeaderSx: SxProps<Theme> = {
  backgroundColor: alpha(detailTokens.text.frost, 0.035),
  borderBottom: `1px solid ${alpha(detailTokens.text.frost, 0.08)}`,
  display: "grid",
  gap: 1,
  gridTemplateColumns: { xs: "1fr", sm: "1fr 112px 110px" },
  px: 1.15,
  py: 0.85,
};

const comparisonOpponentSx: SxProps<Theme> = {
  fontWeight: 650,
  minWidth: 0,
};

function comparisonResultSx(result: string): SxProps<Theme> {
  const won = result === "Beat";
  return {
    backgroundColor: alpha(
      won ? detailTokens.accent.green : detailTokens.accent.danger,
      0.1,
    ),
    border: `1px solid ${alpha(won ? detailTokens.accent.green : detailTokens.accent.danger, 0.26)}`,
    borderRadius: "999px",
    color: won ? "#86EFAC" : "#FCA5A5",
    fontSize: 12,
    fontWeight: 700,
    justifySelf: { sm: "start" },
    px: 0.9,
    py: 0.25,
  };
}

const comparisonRowSx: SxProps<Theme> = {
  alignItems: { xs: "flex-start", sm: "center" },
  borderBottom: `1px solid ${alpha(detailTokens.text.frost, 0.075)}`,
  display: "grid",
  gap: { xs: 0.65, sm: 1 },
  gridTemplateColumns: { xs: "1fr", sm: "1fr 112px 110px" },
  px: 1.15,
  py: 1,
  "&:last-child": {
    borderBottom: 0,
  },
};

const comparisonTableSx: SxProps<Theme> = {
  border: `1px solid ${alpha(detailTokens.text.frost, 0.075)}`,
  borderRadius: "8px",
  overflow: "hidden",
};

const creditLineSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: 15,
  fontWeight: 700,
};

const creditRoleSx: SxProps<Theme> = {
  color: "text.secondary",
  flexShrink: 0,
  fontSize: 14,
  fontWeight: 650,
  width: { xs: "100%", sm: 128 },
};

const creditRowsSx: SxProps<Theme> = {
  borderTop: `1px solid ${alpha(detailTokens.text.frost, 0.08)}`,
};

function creditRowSx(featured: boolean): SxProps<Theme> {
  return {
    alignItems: { xs: "flex-start", sm: "center" },
    borderBottom: `1px solid ${alpha(detailTokens.text.frost, 0.08)}`,
    display: "flex",
    gap: 1,
    py: 1,
    ...(featured
      ? {
          backgroundColor: alpha(detailTokens.accent.cyan, 0.04),
          mx: -1,
          px: 1,
        }
      : {}),
  };
}

const dataCalloutSx: SxProps<Theme> = {
  alignItems: "center",
  backgroundColor: alpha(detailTokens.accent.purple, 0.1),
  border: `1px solid ${alpha(detailTokens.accent.purple, 0.22)}`,
  borderRadius: "8px",
  display: "flex",
  gap: 1,
  justifyContent: "space-between",
  px: 1.25,
  py: 1,
};

const deleteButtonSx: SxProps<Theme> = {
  backgroundColor: alpha(detailTokens.accent.danger, 0.12),
  borderColor: alpha(detailTokens.accent.danger, 0.38),
  color: "#FCA5A5",
  "&:hover": {
    backgroundColor: alpha(detailTokens.accent.danger, 0.1),
    borderColor: alpha(detailTokens.accent.danger, 0.55),
  },
};

const detailGridSx: SxProps<Theme> = {
  display: "grid",
  gap: { xs: 2, md: 2.5, lg: 3 },
  gridTemplateColumns: {
    xs: "1fr",
    lg: "minmax(220px, 280px) minmax(0, 1fr) minmax(260px, 320px)",
  },
};

const emptyStateSx: SxProps<Theme> = {
  alignItems: "center",
  gap: 1,
  minHeight: 130,
  py: 2.5,
  textAlign: "center",
};

const externalRatingsSx: SxProps<Theme> = {
  display: "grid",
  gap: 1,
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2, minmax(0, 1fr))",
    lg: "1fr",
  },
};

function externalLogoSx(source: string): SxProps<Theme> {
  const isMetacritic = source === "METACRITIC";
  return {
    alignItems: "center",
    backgroundColor: isMetacritic
      ? detailTokens.accent.amber
      : alpha(detailTokens.accent.cyan, 0.16),
    borderRadius: "6px",
    color: isMetacritic ? "#111827" : detailTokens.accent.cyan,
    display: "flex",
    fontSize: 16,
    fontWeight: 800,
    height: 30,
    justifyContent: "center",
    lineHeight: 1,
    width: 30,
  };
}

const externalRatingTileSx: SxProps<Theme> = {
  alignItems: "center",
  backgroundColor: alpha(detailTokens.text.frost, 0.045),
  border: `1px solid ${alpha(detailTokens.text.frost, 0.075)}`,
  borderRadius: "8px",
  display: "flex",
  flexDirection: "column",
  gap: 0.55,
  minHeight: 112,
  p: 1.25,
  textAlign: "center",
};

const externalScoreSx: SxProps<Theme> = {
  color: "text.primary",
  fontSize: 15,
  fontWeight: 550,
};

const externalSourceLabelSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: 13,
  fontWeight: 550,
};

const heroTitleSx: SxProps<Theme> = {
  fontFamily: "Satoshi, Inter, sans-serif",
  fontSize: { xs: 42, md: 62 },
  fontWeight: 750,
  letterSpacing: 0,
  lineHeight: 0.95,
  textWrap: "balance",
};

const kickerSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.76rem",
  fontWeight: 650,
  letterSpacing: "0.08em",
  opacity: 0.78,
  textTransform: "uppercase",
};

const metaPillSx: SxProps<Theme> = {
  color: "text.primary",
  fontSize: 15,
  fontWeight: 650,
};

const metadataTextSx: SxProps<Theme> = {
  fontSize: "0.82rem",
  fontWeight: 500,
  opacity: 0.72,
};

const metricInfoIconSx: SxProps<Theme> = {
  color: alpha(detailTokens.text.frost, 0.58),
  cursor: "help",
  fontSize: 16,
};

const metricLabelSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: 12,
  fontWeight: 650,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
};

const noteRowSx: SxProps<Theme> = {
  backgroundColor: alpha(detailTokens.text.frost, 0.045),
  border: `1px solid ${alpha(detailTokens.text.frost, 0.075)}`,
  borderRadius: "8px",
  p: 1,
};

const pageSx: SxProps<Theme> = {
  background:
    "radial-gradient(circle at 18% 8%, rgba(55, 120, 255, 0.1), transparent 32%), radial-gradient(circle at 82% 0%, rgba(0, 214, 163, 0.08), transparent 28%), linear-gradient(180deg, #050816 0%, #07101B 48%, #050816 100%)",
  borderRadius: { xs: 0, md: "8px" },
  boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.04)}`,
  mx: { xs: -2, sm: -3 },
  my: { xs: -1, md: -2 },
  px: { xs: 2, sm: 3, md: 3.5 },
  py: { xs: 2, md: 3 },
};

const panelDividerSx: SxProps<Theme> = {
  borderColor: alpha(detailTokens.text.frost, 0.1),
};

const panelTitleSx: SxProps<Theme> = {
  fontFamily: "Satoshi, Inter, sans-serif",
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: 0,
};

const personChipSx: SxProps<Theme> = {
  backgroundColor: alpha(detailTokens.text.frost, 0.07),
  border: `1px solid ${alpha(detailTokens.text.frost, 0.1)}`,
  color: "text.primary",
  fontWeight: 600,
};

const posterColumnSx: SxProps<Theme> = {
  alignSelf: "start",
  display: "flex",
  flexDirection: "column",
  gap: 1.2,
};

const posterFrameSx: SxProps<Theme> = {
  aspectRatio: "2 / 3",
  borderRadius: "8px",
  boxShadow: "0 28px 90px rgba(0,0,0,0.56), 0 0 36px rgba(90,231,255,0.12)",
  justifySelf: { xs: "center", lg: "stretch" },
  maxWidth: { xs: 280, sm: 330, lg: "none" },
  overflow: "hidden",
  width: "100%",
};

const posterPlaceholderSx: SxProps<Theme> = {
  alignItems: "center",
  background:
    "radial-gradient(circle at 32% 20%, rgba(85,216,255,0.18), transparent 34%), linear-gradient(145deg, #111827, #05070E)",
  height: "100%",
  justifyContent: "center",
  p: 2,
  textAlign: "center",
  width: "100%",
};

const rightRailSx: SxProps<Theme> = {
  alignSelf: "start",
  minWidth: 0,
  width: "100%",
};

const scoreGridSx: SxProps<Theme> = {
  display: "grid",
  gap: 1,
  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr" },
  "& > *": {
    backgroundColor: alpha(detailTokens.text.frost, 0.045),
    border: `1px solid ${alpha(detailTokens.text.frost, 0.075)}`,
    borderRadius: "8px",
    p: 1.15,
  },
};

const scorePanelSx: SxProps<Theme> = {
  ...panelSx(detailTokens.accent.purple),
  background: `linear-gradient(155deg, ${alpha(detailTokens.background.panel, 0.82)} 0%, ${alpha(detailTokens.background.panelDeep, 0.94)} 100%)`,
};

const scoreValueSx: SxProps<Theme> = {
  fontSize: 27,
  fontWeight: 650,
  lineHeight: 1,
};

const textareaSx: SxProps<Theme> = {
  "& .MuiOutlinedInput-root": {
    backgroundColor: alpha("#020617", 0.48),
    borderRadius: "8px",
  },
  "& textarea": {
    lineHeight: 1.6,
  },
};
