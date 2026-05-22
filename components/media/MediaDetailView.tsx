"use client";

import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import type { CreditRole, MediaStatus, MediaType } from "@prisma/client";
import Image from "next/image";
import type { ReactElement, ReactNode } from "react";
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
  toggleFavoriteMediaItem,
  updateMediaRating,
  updateMediaStatus,
  updateNote,
} from "@/app/media/actions";
import { MediaDetailActions } from "@/components/media/MediaDetailActions";
import { MediaRatingControl } from "@/components/media/MediaRatingControl";
import { ActionToastButton } from "@/components/shared/Toasts";
import { Sparkline } from "@/components/shared/Sparkline";
import { CREDIT_ROLES_BY_MEDIA_TYPE, creditLabel } from "@/lib/credits";
import { ACCENTS } from "@/lib/media-ui-helpers";
import { statusLabel } from "@/lib/status-labels";
import type { UserMediaFields } from "@/lib/db/user-media";

/**
 * Client-side view for the media detail page. Lives in a client component so
 * that MUI's `sx` callbacks (`(theme) => ...`) — which reach across theme
 * tokens including light/dark palettes — don't have to serialize across the
 * RSC boundary. The server page (`app/media/[id]/page.tsx`) handles data
 * fetching and passes a plain JSON-serializable `item` down.
 */

type ContributorLite = { name: string };
type CreditLite = {
  role: CreditRole;
  order: number;
  contributor: ContributorLite;
};
type ComparisonLite = {
  id: string;
  createdAt: Date;
  winnerDelta: number | null;
  loserDelta: number | null;
  winnerScoreAfter: number | null;
  loserScoreAfter: number | null;
  expectedWinnerWinProb: number | null;
};

export type MediaDetailViewItem = UserMediaFields & {
  id: string;
  title: string;
  originalTitle: string | null;
  description: string | null;
  posterUrl: string | null;
  releaseDate: Date | null;
  mediaType: MediaType;
  comparisonsLost: Array<ComparisonLite & { winner: { title: string } }>;
  comparisonsWon: Array<ComparisonLite & { loser: { title: string } }>;
  externalRatings: Array<{
    id: string;
    source: string;
    score: number;
    scale: number;
  }>;
  genres: Array<{ genre: { name: string } }>;
  credits: CreditLite[];
  notes: Array<{ id: string; body: string; updatedAt: Date }>;
  tags: Array<{ tag: { name: string } }>;
  computedConsensusScore: number | null;
  consensusConfidence: number;
  consensusAgreement: number;
  consensusUsedSourceCount: number;
  communityScore: number | null;
  communityRaterCount: number;
};

export function MediaDetailView({
  item,
  userId,
}: {
  item: MediaDetailViewItem;
  userId: string | null;
}) {
  const comparisons = [
    ...item.comparisonsWon.map((entry) => ({
      createdAt: entry.createdAt,
      id: entry.id,
      opponent: entry.loser.title,
      result: "Beat" as const,
      delta: entry.winnerDelta,
      scoreAfter: entry.winnerScoreAfter,
      expectedWinProb: entry.expectedWinnerWinProb,
    })),
    ...item.comparisonsLost.map((entry) => ({
      createdAt: entry.createdAt,
      id: entry.id,
      opponent: entry.winner.title,
      result: "Lost to" as const,
      delta: entry.loserDelta,
      scoreAfter: entry.loserScoreAfter,
      expectedWinProb:
        entry.expectedWinnerWinProb == null
          ? null
          : 1 - entry.expectedWinnerWinProb,
    })),
  ]
    .sort(
      (first, second) => second.createdAt.getTime() - first.createdAt.getTime(),
    )
    .slice(0, 10);

  // Sparkline data: walk the persisted scoreAfter timeline (oldest → newest).
  const eloTimelineSource = [
    ...item.comparisonsWon.map((entry) => ({
      at: entry.createdAt,
      scoreAfter: entry.winnerScoreAfter,
    })),
    ...item.comparisonsLost.map((entry) => ({
      at: entry.createdAt,
      scoreAfter: entry.loserScoreAfter,
    })),
  ]
    .filter(
      (entry): entry is { at: Date; scoreAfter: number } =>
        entry.scoreAfter != null,
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const eloTimeline = eloTimelineSource.map((entry) => entry.scoreAfter);
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
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                    Poster missing
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ fontSize: "0.75rem" }}
                  >
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
                      sx={{ color: "text.primary", fontWeight: 600 }}
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
                {userId ? (
                  <StatusChip mediaType={item.mediaType} status={item.status} />
                ) : null}
                {userId && item.isFavorite ? (
                  <GlassChip icon={<StarRoundedIcon />} label="Favorite" warm />
                ) : null}
                {userId && item.isArchived ? (
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

            {userId ? (
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
            ) : null}

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

              {eloTimeline.length >= 2 && (
                <Tooltip
                  title={`Pairwise score trajectory across ${eloTimeline.length} comparisons. Baseline = ${1000} (starting Elo).`}
                  arrow
                  placement="top"
                >
                  <Stack
                    direction="row"
                    sx={{
                      alignItems: "center",
                      gap: 1.5,
                      mb: 1.5,
                      px: 1,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: "surface.1",
                    }}
                  >
                    <Sparkline
                      values={eloTimeline}
                      width={200}
                      height={40}
                      baseline={1000}
                      ariaLabel="Pairwise score over time"
                    />
                    <Stack>
                      <Typography
                        sx={{ fontSize: "0.6875rem", color: "text.secondary" }}
                      >
                        Pairwise trajectory
                      </Typography>
                      <Typography
                        sx={{ fontSize: "0.8125rem", fontWeight: 600 }}
                      >
                        {Math.round(eloTimeline[0])} →{" "}
                        {Math.round(eloTimeline[eloTimeline.length - 1])}
                      </Typography>
                    </Stack>
                  </Stack>
                </Tooltip>
              )}

              {comparisons.length > 0 ? (
                <Box sx={comparisonTableSx}>
                  <Box sx={comparisonHeaderSx}>
                    <Typography sx={comparisonHeaderCellSx}>
                      Compared With
                    </Typography>
                    <Typography sx={comparisonHeaderCellSx}>Date</Typography>
                    <Typography sx={comparisonHeaderCellSx}>Result</Typography>
                  </Box>
                  {comparisons.map((entry) => {
                    const deltaLabel =
                      entry.delta == null
                        ? null
                        : `${entry.delta >= 0 ? "+" : ""}${Math.round(entry.delta)}`;
                    const upsetTooltip =
                      entry.expectedWinProb == null
                        ? `${entry.result} ${entry.opponent}`
                        : `Expected win ${(entry.expectedWinProb * 100).toFixed(0)}%. ${deltaLabel ? `Pairwise moved ${deltaLabel}.` : ""}`;
                    return (
                      <Box key={entry.id} sx={comparisonRowSx}>
                        <Typography sx={comparisonOpponentSx}>
                          {entry.opponent}
                        </Typography>
                        <Typography sx={comparisonDateSx}>
                          {entry.createdAt.toLocaleDateString()}
                        </Typography>
                        <Tooltip title={upsetTooltip} arrow placement="left">
                          <Typography sx={comparisonResultSx(entry.result)}>
                            {entry.result}
                            {deltaLabel ? ` (${deltaLabel})` : ""}
                          </Typography>
                        </Tooltip>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Stack sx={emptyStateSx}>
                  <Typography sx={{ fontSize: "1.125rem", fontWeight: 650 }}>
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
            {userId ? (
              <MediaDetailActions
                favoriteAction={toggleFavoriteMediaItem.bind(null, item.id)}
                isFavorite={item.isFavorite}
                mediaType={item.mediaType}
                status={item.status}
                statusAction={updateMediaStatus.bind(null, item.id)}
              />
            ) : (
              <Box sx={scorePanelSx}>
                <Stack spacing={1}>
                  <Typography sx={kickerSx}>Track this</Typography>
                  <Typography color="text.secondary" sx={metadataTextSx}>
                    Sign in to rate, track status, favorite, and take notes.
                  </Typography>
                  <Button
                    href={`/signin?callbackUrl=${encodeURIComponent(`/media/${item.id}`)}`}
                    size="small"
                    variant="contained"
                  >
                    Sign in
                  </Button>
                </Stack>
              </Box>
            )}

            <Box sx={scorePanelSx}>
              <Stack spacing={1.25}>
                {userId ? (
                  <>
                    <Stack spacing={0.75}>
                      <Typography sx={{ ...kickerSx, textAlign: "center" }}>
                        Your rating
                      </Typography>
                      <MediaRatingControl
                        action={updateMediaRating.bind(null, item.id)}
                        mediaType={item.mediaType}
                        personalRating={item.personalRating}
                        status={item.status}
                        statusAction={updateMediaStatus.bind(null, item.id)}
                      />
                    </Stack>

                    <Divider sx={panelDividerSx} />
                  </>
                ) : null}

                <Box sx={scoreGridSx}>
                  <ScoreLine
                    color={detailTokens.accent.purple}
                    info={refinedTooltip(
                      item.personalRating,
                      item.computedPersonalScore,
                      item.comparisonCount,
                    )}
                    label="Refined"
                    value={formatOptionalScore(item.computedPersonalScore)}
                  />
                  <ScoreLine
                    color={detailTokens.accent.cyan}
                    info={communityTooltip(
                      item.communityScore,
                      item.communityRaterCount,
                    )}
                    label="Community"
                    value={formatOptionalScore(item.communityScore)}
                  />
                </Box>

                {item.externalRatings.length > 0 ||
                item.computedConsensusScore != null ? (
                  <>
                    <Divider sx={panelDividerSx} />
                    <ScoreLine
                      centered
                      color={detailTokens.accent.green}
                      info={consensusTooltip(
                        item.computedConsensusScore,
                        item.consensusUsedSourceCount,
                        item.consensusAgreement,
                      )}
                      label="Consensus"
                      value={formatOptionalScore(item.computedConsensusScore)}
                    />
                    {item.externalRatings.length > 0 ? (
                      <Divider sx={panelDividerSx} />
                    ) : null}
                    {item.externalRatings.length > 0 ? (
                      <Box sx={externalRatingsRowSx}>
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
                    ) : null}
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
  const tone: "success" | "warning" | "neutral" | "muted" = success
    ? "success"
    : warm || warning
      ? "warning"
      : muted
        ? "muted"
        : "neutral";
  return (
    <Chip
      icon={icon}
      label={label}
      size="small"
      variant={tone === "muted" ? "outlined" : "filled"}
      sx={{
        ...(tone === "success" && {
          bgcolor: (theme) => alpha(theme.palette.success.main, 0.14),
          color: "success.main",
        }),
        ...(tone === "warning" && {
          bgcolor: (theme) => alpha(theme.palette.warning.main, 0.14),
          color: "warning.main",
        }),
        ...(tone === "neutral" && {
          bgcolor: "surface.2",
          color: "text.primary",
        }),
        ...(tone === "muted" && { color: "text.secondary" }),
        fontWeight: 550,
        "& .MuiChip-icon": { color: "inherit", fontSize: 16 },
      }}
    />
  );
}

function StatusChip({
  mediaType,
  status,
}: {
  mediaType: MediaType;
  status: MediaStatus;
}) {
  const isCompleted = status === "COMPLETED";
  return (
    <GlassChip
      icon={isCompleted ? <CheckCircleRoundedIcon /> : undefined}
      label={statusLabel(status, mediaType)}
      success={isCompleted}
    />
  );
}

function ScoreLine({
  centered = false,
  color,
  info,
  label,
  meta,
  value,
}: {
  centered?: boolean;
  color?: string;
  info?: string;
  label: string;
  meta?: string;
  value: ReactNode;
}) {
  return (
    <Stack
      spacing={0.75}
      sx={centered ? { alignItems: "center", textAlign: "center" } : undefined}
    >
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
  const logoSrc = externalLogoSrc(source);
  return (
    <Box sx={externalRatingTileSx}>
      <Box sx={externalLogoSx(source)}>
        {logoSrc ? (
          <Image alt="" height={22} src={logoSrc} width={22} unoptimized />
        ) : (
          label.charAt(0)
        )}
      </Box>
      <Typography sx={externalSourceLabelSx}>{label}</Typography>
      <Typography sx={externalScoreSx}>
        {formatExternalRating(score, scale)}
      </Typography>
    </Box>
  );
}

function externalLogoSrc(source: string): string | null {
  if (source === "METACRITIC") return "/images/metacritic.png";
  if (
    source === "ROTTEN_TOMATOES_CRITICS" ||
    source === "ROTTEN_TOMATOES_AUDIENCE"
  ) {
    return "/images/tomato.png";
  }
  return null;
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

function refinedTooltip(
  personalRating: number | null,
  computedPersonalScore: number | null,
  comparisonCount: number,
) {
  if (computedPersonalScore == null) {
    return "Rate this item or run pairwise comparisons to refine a score.";
  }
  const comparisonsLabel = `${comparisonCount} ${comparisonCount === 1 ? "comparison" : "comparisons"}`;
  if (personalRating == null) {
    return `Derived from ${comparisonsLabel} (no manual rating yet).`;
  }
  return `Your ${formatNumber(personalRating)}/10, refined by ${comparisonsLabel}.`;
}

function communityTooltip(score: number | null, raterCount: number) {
  if (score == null || raterCount === 0) {
    return "Not yet rated by other Medialy users.";
  }
  const raterLabel = `${raterCount} other ${raterCount === 1 ? "Medialy user" : "Medialy users"}`;
  return `Average of ${raterLabel}.`;
}

function consensusTooltip(
  score: number | null,
  sourceCount: number,
  agreement: number,
) {
  if (score == null || sourceCount === 0) {
    return "Not enough external rating data yet.";
  }
  const sourcesLabel = `${sourceCount} external ${sourceCount === 1 ? "rating" : "ratings"}`;
  return `Based on ${sourcesLabel}; ${Math.round(agreement * 100)}% source agreement.`;
}

function formatRatingSource(source: string) {
  if (source === "METACRITIC") return "Metacritic";
  return source
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Local aliases mapping the semantic role used in this view to the central
// vaporwave palette. Everything routes through `ACCENTS` so there are no
// hardcoded hex values at the call sites below.
const detailTokens = {
  accent: {
    amber: ACCENTS.yellow,
    cyan: ACCENTS.teal,
    danger: ACCENTS.pink,
    emerald: ACCENTS.mint,
    green: ACCENTS.mint,
    purple: ACCENTS.lavender,
  },
  text: {
    frost: "#D8E6FF",
  },
};

function panelSx(_accent?: string) {
  return {
    bgcolor: "background.paper",
    border: "1px solid",
    borderColor: "border.subtle",
    borderRadius: 3,
    boxShadow: (theme: Theme) => theme.shadows[1],
    p: { xs: 2, md: 2.5 },
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
  fontSize: "0.9375rem",
  lineHeight: 1.7,
};

const calloutTitleSx: SxProps<Theme> = {
  color: "primary.main",
  fontSize: "0.8125rem",
  fontWeight: 600,
};

const comparisonDateSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.8125rem",
};

const comparisonHeaderCellSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const comparisonHeaderSx: SxProps<Theme> = {
  bgcolor: "surface.1",
  borderBottom: "1px solid",
  borderBottomColor: "border.subtle",
  display: "grid",
  gap: 1,
  gridTemplateColumns: { xs: "1fr", sm: "1fr 112px 110px" },
  px: 1.5,
  py: 1,
};

const comparisonOpponentSx: SxProps<Theme> = {
  fontWeight: 550,
  minWidth: 0,
};

function comparisonResultSx(result: string): SxProps<Theme> {
  const won = result === "Beat";
  return {
    bgcolor: (theme) =>
      alpha(won ? theme.palette.success.main : theme.palette.error.main, 0.12),
    borderRadius: 999,
    color: won ? "success.main" : "error.main",
    fontSize: "0.75rem",
    fontWeight: 600,
    justifySelf: { sm: "start" },
    px: 1,
    py: 0.25,
  };
}

const comparisonRowSx: SxProps<Theme> = {
  alignItems: { xs: "flex-start", sm: "center" },
  borderBottom: "1px solid",
  borderBottomColor: "border.subtle",
  display: "grid",
  gap: { xs: 0.65, sm: 1 },
  gridTemplateColumns: { xs: "1fr", sm: "1fr 112px 110px" },
  px: 1.5,
  py: 1.15,
  "&:last-child": { borderBottom: 0 },
};

const comparisonTableSx: SxProps<Theme> = {
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 2,
  overflow: "hidden",
};

const creditLineSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.9375rem",
  fontWeight: 550,
};

const dataCalloutSx: SxProps<Theme> = {
  alignItems: "center",
  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
  border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
  borderRadius: 2,
  display: "flex",
  gap: 1,
  justifyContent: "space-between",
  px: 1.5,
  py: 1.25,
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

const externalRatingsRowSx: SxProps<Theme> = {
  display: "grid",
  gap: 1,
  gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
};

function externalLogoSx(source: string): SxProps<Theme> {
  const hasImage = externalLogoSrc(source) != null;
  return {
    alignItems: "center",
    bgcolor: (theme) =>
      hasImage ? "transparent" : alpha(theme.palette.primary.main, 0.16),
    borderRadius: 1.5,
    color: "primary.main",
    display: "flex",
    fontSize: "0.9375rem",
    fontWeight: 700,
    height: 30,
    justifyContent: "center",
    lineHeight: 1,
    width: 30,
  };
}

const externalRatingTileSx: SxProps<Theme> = {
  alignItems: "center",
  bgcolor: "surface.1",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 2,
  display: "flex",
  flexDirection: "column",
  gap: 0.65,
  minHeight: 112,
  p: 1.5,
  textAlign: "center",
};

const externalScoreSx: SxProps<Theme> = {
  color: "text.primary",
  fontSize: "0.9375rem",
  fontWeight: 600,
};

const externalSourceLabelSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.8125rem",
};

const heroTitleSx: SxProps<Theme> = {
  fontFamily: (theme) => theme.typography.displayHero.fontFamily,
  fontSize: { xs: "2rem", md: "3rem" },
  fontWeight: 700,
  letterSpacing: "-0.03em",
  lineHeight: 1.05,
  textWrap: "balance",
};

const kickerSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const metaPillSx: SxProps<Theme> = {
  color: "text.primary",
  fontSize: "0.9375rem",
  fontWeight: 600,
};

const metadataTextSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.8125rem",
};

const metricInfoIconSx: SxProps<Theme> = {
  color: "text.disabled",
  cursor: "help",
  fontSize: 16,
};

const metricLabelSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.6875rem",
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
};

const noteRowSx: SxProps<Theme> = {
  bgcolor: "surface.1",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 2,
  p: 1.25,
};

const pageSx: SxProps<Theme> = {};

const panelDividerSx: SxProps<Theme> = {
  borderColor: "border.subtle",
};

const panelTitleSx: SxProps<Theme> = {
  fontFamily: (theme) => theme.typography.h5.fontFamily,
  fontSize: "1.0625rem",
  fontWeight: 650,
  letterSpacing: "-0.02em",
};

const posterColumnSx: SxProps<Theme> = {
  alignSelf: "start",
  display: "flex",
  flexDirection: "column",
  gap: 1.5,
};

const posterFrameSx: SxProps<Theme> = {
  aspectRatio: "2 / 3",
  bgcolor: "surface.2",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 3,
  boxShadow: (theme) => theme.shadows[6],
  justifySelf: { xs: "center", lg: "stretch" },
  maxWidth: { xs: 280, sm: 330, lg: "none" },
  overflow: "hidden",
  width: "100%",
};

const posterPlaceholderSx: SxProps<Theme> = {
  alignItems: "center",
  bgcolor: "surface.2",
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
    bgcolor: "surface.1",
    border: "1px solid",
    borderColor: "border.subtle",
    borderRadius: 2,
    p: 1.25,
  },
};

const scorePanelSx: SxProps<Theme> = {
  ...panelSx(),
};

const scoreValueSx: SxProps<Theme> = {
  fontFamily: (theme) => theme.typography.statValue.fontFamily,
  fontSize: "1.625rem",
  fontWeight: 700,
  letterSpacing: "-0.03em",
  lineHeight: 1,
};

const textareaSx: SxProps<Theme> = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "surface.1",
    borderRadius: 2,
  },
  "& textarea": {
    lineHeight: 1.6,
  },
};
