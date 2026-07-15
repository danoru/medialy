"use client";

import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import DevicesOtherRoundedIcon from "@mui/icons-material/DevicesOtherRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PhoneAndroidRoundedIcon from "@mui/icons-material/PhoneAndroidRounded";
import SportsEsportsRoundedIcon from "@mui/icons-material/SportsEsportsRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import type { CreditRole, MediaStatus, MediaType } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import {
  addNote,
  setMediaWatched,
  toggleFavoriteMediaItem,
  updateMediaRating,
  updateMediaStatus,
  updateNote,
  type RateResult,
} from "@/app/media/actions";
import { ActionToastButton } from "@/components/shared/Toasts";
import { StarRating } from "@/components/media/StarRating";
import { Sparkline } from "@/components/shared/Sparkline";
import { CREDIT_ROLES_BY_MEDIA_TYPE, creditLabel } from "@/lib/credits";
import { ACCENTS, mediaAccent } from "@/lib/media-ui-helpers";
import { formatMediaType, mediaTypeNoun } from "@/lib/format";
import {
  RELATION_FORWARD_LABEL,
  RELATION_INVERSE_LABEL,
  RELEASE_KIND_LABEL,
} from "@/lib/media-relations";
import type {
  RelationView,
  ReleaseEventView,
} from "@/components/media/MediaConnectionsPanel";
import { availableStatuses, statusLabel } from "@/lib/status-labels";
import { useRef, useState, useTransition } from "react";
import type { UserMediaFields } from "@/lib/db/user-media";
import type { WatchAvailability } from "@/lib/tmdb";

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

export type MediaDetailMatchSummary = {
  score: number;
  similarTitleGroups: Array<{
    facet: string;
    facetKind: "subgenre" | "genre";
    titles: string[];
  }>;
  contributorReason: string | null;
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
  matchSummary: MediaDetailMatchSummary | null;
  /** Streaming availability for movies/TV (US, free + subscription). */
  watchProviders?: WatchAvailability | null;
  /** Playable platforms for video games (e.g. "PlayStation 5", "PC"). */
  platforms?: string[];
};

export function MediaDetailView({
  item,
  relations,
  releaseEvents,
  userId,
}: {
  item: MediaDetailViewItem;
  relations: RelationView[];
  releaseEvents: ReleaseEventView[];
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
  const primaryCredit = creditsByRole.find((entry) => entry.role !== "ACTOR");
  const missingFields = [
    item.description ? null : "description",
    item.posterUrl ? null : "poster",
    item.releaseDate ? null : "release date",
    genres.length > 0 ? null : "genres",
    item.externalRatings.length > 0 ? null : "external ratings",
  ].filter((field): field is string => field !== null);

  const inlineMatchReasons = buildInlineMatchReasons(
    item.matchSummary,
    item.mediaType,
  );

  return (
    <Box sx={pageSx}>
      <Stack spacing={3.5}>
        <Button
          href="/library"
          size="small"
          startIcon={<ArrowBackRoundedIcon />}
          sx={backButtonSx}
          variant="text"
        >
          Back to media
        </Button>

        {/* HERO ---------------------------------------------------------- */}
        <Box sx={heroGridSx}>
          <Box sx={posterFrameSx(item.mediaType)}>
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
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  Poster missing
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                  Add artwork to improve this page.
                </Typography>
              </Stack>
            )}
          </Box>

          <Stack spacing={2.5} sx={{ minWidth: 0 }}>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.7 }}>
              <MediaTypeChip mediaType={item.mediaType} />
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
            </Stack>

            <Box sx={{ minWidth: 0 }}>
              <Typography component="h1" sx={heroTitleSx}>
                {item.title}
              </Typography>
              {item.originalTitle ? (
                <Typography color="text.secondary" sx={originalTitleSx}>
                  {item.originalTitle}
                </Typography>
              ) : null}
            </Box>

            <Stack
              direction="row"
              sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.25 }}
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
              ) : null}
              {releaseLabel ? (
                <Typography color="text.secondary" sx={metadataTextSx}>
                  {releaseLabel}
                </Typography>
              ) : null}
            </Stack>

            {item.matchSummary && userId ? (
              <Box sx={matchPanelSx}>
                <Tooltip
                  arrow
                  placement="top"
                  title="How well this matches your taste, based on the genres, tags, and items you've already rated."
                >
                  <Stack spacing={0.5} sx={{ cursor: "help" }}>
                    <Typography sx={kickerSx}>Medialy Match</Typography>
                    <Typography sx={matchScoreSx}>
                      {item.matchSummary.score}
                      <Box component="span" sx={matchPercentSx}>
                        %
                      </Box>
                    </Typography>
                  </Stack>
                </Tooltip>
                {inlineMatchReasons.length > 0 ? (
                  <>
                    <Divider flexItem orientation="vertical" sx={matchDividerSx} />
                    <Stack spacing={0.5}>
                      {inlineMatchReasons.map((line) => (
                        <Typography key={line} sx={matchReasonSx}>
                          {line}
                        </Typography>
                      ))}
                    </Stack>
                  </>
                ) : null}
              </Box>
            ) : null}

            {userId ? (
              <ActionRow
                editHref={`/media/${item.id}/edit`}
                favoriteAction={toggleFavoriteMediaItem.bind(null, item.id)}
                isFavorite={item.isFavorite}
                mediaId={item.id}
                mediaType={item.mediaType}
                personalRating={item.personalRating}
                ratingAction={updateMediaRating.bind(null, item.id)}
                status={item.status}
                statusAction={updateMediaStatus.bind(null, item.id)}
                title={item.title}
              />
            ) : (
              <Box sx={panelSx()}>
                <Stack spacing={1}>
                  <Typography sx={kickerSx}>Track this</Typography>
                  <Typography color="text.secondary" sx={metadataTextSx}>
                    Sign in to rate, track status, favorite, and take notes.
                  </Typography>
                  <Button
                    href={`/signin?callbackUrl=${encodeURIComponent(`/media/${item.id}`)}`}
                    size="small"
                    sx={{ alignSelf: "flex-start" }}
                    variant="contained"
                  >
                    Sign in
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </Box>

        {/* GENRES + TAGS ------------------------------------------------- */}
        {genres.length > 0 || tags.length > 0 ? (
          <Box sx={taxonomyGridSx}>
            {genres.length > 0 ? (
              <Box>
                <SectionTitle>Genres</SectionTitle>
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.7 }}>
                  {genres.map((genre) => (
                    <GlassChip key={genre} label={genre} />
                  ))}
                </Stack>
              </Box>
            ) : null}
            {tags.length > 0 ? (
              <Box>
                <SectionTitle>Tags</SectionTitle>
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.7 }}>
                  {tags.map((tag) => (
                    <GlassChip key={tag} label={tag} muted />
                  ))}
                </Stack>
              </Box>
            ) : null}
          </Box>
        ) : null}

        {/* SCORE BREAKDOWN ---------------------------------------------- */}
        <Box>
          <SectionTitle>Score breakdown</SectionTitle>
          <Box sx={scoreTileGridSx}>
            <ScoreTile
              color={detailTokens.accent.purple}
              info={refinedTooltip(
                item.personalRating,
                item.computedPersonalScore,
                item.comparisonCount,
              )}
              label="Refined"
              sub="Your blended personal score"
              value={formatOptionalScore(item.computedPersonalScore)}
            />
            <ScoreTile
              color={detailTokens.accent.cyan}
              info={communityTooltip(
                item.communityScore,
                item.communityRaterCount,
              )}
              label="Community"
              sub={
                item.communityRaterCount > 0
                  ? `Averaged across ${item.communityRaterCount} Medialy ${item.communityRaterCount === 1 ? "user" : "users"}`
                  : "Not yet rated by others"
              }
              value={formatOptionalScore(item.communityScore)}
            />
            <ScoreTile
              color={detailTokens.accent.green}
              info={consensusTooltip(
                item.computedConsensusScore,
                item.consensusUsedSourceCount,
                item.consensusAgreement,
              )}
              label="Consensus"
              sub={
                item.consensusUsedSourceCount > 0
                  ? `${item.consensusUsedSourceCount} external ${item.consensusUsedSourceCount === 1 ? "source" : "sources"}, weighted`
                  : "Not enough external ratings yet"
              }
              value={formatOptionalScore(item.computedConsensusScore)}
            />
          </Box>
        </Box>

        {/* EXTERNAL RATINGS --------------------------------------------- */}
        {item.externalRatings.length > 0 ? (
          <Box>
            <SectionTitle>External ratings</SectionTitle>
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
          </Box>
        ) : null}

        {/* WHERE TO WATCH (movies/TV) / PLATFORMS (games) --------------- */}
        <AvailabilitySection item={item} />

        {/* CONNECTIONS (read-only) -------------------------------------- */}
        {relations.length > 0 || releaseEvents.length > 0 ? (
          <Box sx={connectionsGridSx}>
            {relations.length > 0 ? (
              <Box>
                <SectionTitle>Related titles</SectionTitle>
                <Stack spacing={1}>
                  {relations.map((relation) => (
                    <Box key={relation.id} sx={connectionRowSx}>
                      <Chip
                        label={
                          relation.direction === "forward"
                            ? RELATION_FORWARD_LABEL[relation.kind]
                            : RELATION_INVERSE_LABEL[relation.kind]
                        }
                        size="small"
                        sx={connectionKindChipSx}
                      />
                      <Link
                        href={`/media/${relation.other.id}`}
                        style={{ textDecoration: "none", minWidth: 0 }}
                      >
                        <Typography noWrap sx={connectionLinkSx}>
                          {relation.other.title}
                        </Typography>
                      </Link>
                      <Chip
                        label={formatMediaType(relation.other.mediaType)}
                        size="small"
                        sx={{ ml: "auto" }}
                        variant="outlined"
                      />
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}
            {releaseEvents.length > 0 ? (
              <Box>
                <SectionTitle>Re-releases &amp; editions</SectionTitle>
                <Stack spacing={1}>
                  {releaseEvents.map((event) => (
                    <Box key={event.id} sx={connectionRowSx}>
                      <Chip
                        color="secondary"
                        label={RELEASE_KIND_LABEL[event.kind]}
                        size="small"
                        sx={connectionKindChipSx}
                      />
                      <Typography noWrap sx={connectionTitleSx}>
                        {event.title ?? item.title}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        sx={{ ml: "auto", whiteSpace: "nowrap" }}
                        variant="body2"
                      >
                        {new Date(event.date).toLocaleDateString()}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}
          </Box>
        ) : null}

        {/* SYNOPSIS + NOTES + COMPARISON HISTORY ------------------------ */}
        <Box sx={threeColGridSx}>
          <SectionBlock title="Synopsis">
            <Typography
              color={item.description ? "text.primary" : "text.secondary"}
              sx={bodyTextSx}
            >
              {item.description || "No description yet."}
            </Typography>
          </SectionBlock>

          {userId ? (
            <Box id="notes" sx={panelSx()}>
              <SectionHeader title="Notes" />
              <Stack spacing={1.2} sx={{ mt: 1.2 }}>
                <Box action={addNote.bind(null, item.id)} component="form">
                  <Stack spacing={1}>
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
                      sx={{ alignSelf: "flex-end" }}
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
                        mt: 0.75,
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

          <Box sx={panelSx()}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{
                alignItems: { sm: "center" },
                gap: 1,
                justifyContent: "space-between",
                mb: 1.5,
              }}
            >
              <SectionHeader title="Comparison history" />
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
                title={`Refined score across ${eloTimeline.length} comparisons. Every item starts at 1000 and shifts with each head-to-head pick.`}
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
                    ariaLabel="Refined score over time"
                  />
                  <Stack>
                    <Typography
                      sx={{ fontSize: "0.875rem", color: "text.secondary" }}
                    >
                      Refined score trajectory
                    </Typography>
                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
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
                    Compared with
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
                      : `Expected win ${(entry.expectedWinProb * 100).toFixed(0)}%. ${deltaLabel ? `Refined score moved ${deltaLabel}.` : ""}`;
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
        </Box>

        {/* CREDITS ------------------------------------------------------ */}
        {item.credits.length > 0 ? (
          <Box>
            <SectionTitle>Credits</SectionTitle>
            <Box sx={creditsGridSx}>
              {creditsByRole
                .flatMap((entry) =>
                  entry.names.map((name) => ({
                    name,
                    role: creditLabel(item.mediaType, entry.role),
                  })),
                )
                .map((credit, index) => (
                  <Box key={`${credit.name}-${index}`} sx={creditCardSx}>
                    <Box sx={creditAvatarSx}>
                      {credit.name
                        .split(" ")
                        .map((word) => word[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={creditNameSx}>{credit.name}</Typography>
                      <Typography sx={creditRoleSx}>{credit.role}</Typography>
                    </Box>
                  </Box>
                ))}
            </Box>
          </Box>
        ) : null}

        {/* IMPROVE DATA CALLOUT ----------------------------------------- */}
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
  );
}

// ─── Action row (Watched + stars + Favorite + status + Edit) ─────────
//
// Letterboxd-style: the two things you actually came to do — say you watched it
// and say how much you liked it — are always visible, one tap each. No dialog.
// The status select is the escape hatch for everything that isn't "watched".
function ActionRow({
  editHref,
  favoriteAction,
  isFavorite,
  mediaId,
  mediaType,
  personalRating,
  ratingAction,
  status,
  statusAction,
  title,
}: {
  editHref: string;
  favoriteAction: () => void | Promise<void>;
  isFavorite: boolean;
  mediaId: string;
  mediaType: MediaType;
  personalRating: number | null;
  ratingAction: (formData: FormData) => Promise<RateResult>;
  status: MediaStatus;
  statusAction: (formData: FormData) => void | Promise<void>;
  title: string;
}) {
  const [, startTransition] = useTransition();
  const [watched, setWatched] = useState(status === "COMPLETED");
  const [selectedStatus, setSelectedStatus] = useState<MediaStatus>(status);
  const statusFormRef = useRef<HTMLFormElement>(null);

  const watchedLabel = statusLabel("COMPLETED", mediaType);

  const toggleWatched = () => {
    const next = !watched;
    setWatched(next);
    setSelectedStatus(next ? "COMPLETED" : "UNTRACKED");
    startTransition(async () => {
      await setMediaWatched(mediaId, next);
    });
  };

  return (
    <Stack spacing={1.5}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
      >
        <Button
          aria-pressed={watched}
          onClick={toggleWatched}
          startIcon={<CheckCircleRoundedIcon />}
          sx={{ minHeight: 44 }}
          variant={watched ? "contained" : "outlined"}
        >
          {watchedLabel}
        </Button>

        <Box action={favoriteAction} component="form">
          <Button
            aria-pressed={isFavorite}
            startIcon={<FavoriteRoundedIcon />}
            sx={{
              minHeight: 44,
              ...(isFavorite
                ? { color: "warning.main", borderColor: "warning.main" }
                : {}),
            }}
            type="submit"
            variant="outlined"
          >
            Favorite
          </Button>
        </Box>

        <Button
          href={editHref}
          startIcon={<EditRoundedIcon />}
          sx={{ minHeight: 44 }}
          variant="outlined"
        >
          Edit
        </Button>
      </Stack>

      <StarRating
        mediaId={mediaId}
        mediaType={mediaType}
        personalRating={personalRating}
        rateAction={ratingAction}
        title={title}
      />

      <Box action={statusAction} component="form" ref={statusFormRef}>
        <TextField
          fullWidth
          label="Status"
          name="status"
          onChange={(event) => {
            const next = event.target.value as MediaStatus;
            setSelectedStatus(next);
            setWatched(next === "COMPLETED");
            window.requestAnimationFrame(() => {
              statusFormRef.current?.requestSubmit();
            });
          }}
          select
          size="small"
          sx={{ maxWidth: 260 }}
          value={selectedStatus}
        >
          {availableStatuses(mediaType).map((value) => (
            <MenuItem key={value} value={value}>
              {statusLabel(value, mediaType)}
            </MenuItem>
          ))}
        </TextField>
      </Box>
    </Stack>
  );
}

function MediaTypeChip({ mediaType }: { mediaType: MediaType }) {
  const color = mediaAccent(mediaType);
  return (
    <Chip
      label={formatMediaType(mediaType)}
      size="small"
      sx={{
        bgcolor: alpha(color, 0.16),
        color,
        fontWeight: 600,
      }}
    />
  );
}

function buildInlineMatchReasons(
  summary: MediaDetailMatchSummary | null,
  mediaType: MediaType,
): string[] {
  if (!summary) return [];
  const lines: string[] = [];
  for (const group of summary.similarTitleGroups) {
    if (group.titles.length === 1) {
      const singular = mediaTypeNoun(mediaType, 1);
      lines.push(
        `You loved the ${group.facet} ${singular} ${group.titles[0]}.`,
      );
    } else {
      const plural = mediaTypeNoun(mediaType, 2);
      lines.push(
        `You loved ${group.facet} ${plural} like ${joinWithAnd(group.titles)}.`,
      );
    }
  }
  if (summary.contributorReason) {
    lines.push(`${summary.contributorReason}.`);
  }
  return lines;
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
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

function ScoreTile({
  color,
  info,
  label,
  sub,
  value,
}: {
  color?: string;
  info?: string;
  label: string;
  sub: string;
  value: ReactNode;
}) {
  return (
    <Box sx={scoreTileSx(color)}>
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
      <Typography color="text.secondary" sx={scoreTileSubSx}>
        {sub}
      </Typography>
    </Box>
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
    <Box sx={panelSx()}>
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

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography component="h2" sx={sectionTitleSx}>
      {children}
    </Typography>
  );
}

/**
 * "Where to watch" for movies/TV (live TMDB/JustWatch streaming availability)
 * and "Platforms" for games (stored console/platform list). Renders nothing
 * when there's no data, so titles without availability stay clean.
 */
function AvailabilitySection({ item }: { item: MediaDetailViewItem }) {
  const isWatchable =
    item.mediaType === "MOVIE" || item.mediaType === "TV_SHOW";

  if (isWatchable) {
    const providers = item.watchProviders?.stream ?? [];
    if (providers.length === 0) return null;
    const link = item.watchProviders?.link ?? null;
    return (
      <Box>
        <SectionTitle>Where to watch</SectionTitle>
        <Box sx={providerRowSx}>
          {providers.map((provider) => {
            const logo = (
              <Box
                component="img"
                alt={provider.name}
                src={provider.logoUrl}
                title={provider.name}
                sx={providerLogoSx}
              />
            );
            return link ? (
              <a
                key={provider.name}
                href={link}
                target="_blank"
                rel="noreferrer"
                aria-label={provider.name}
                style={{ display: "inline-flex", lineHeight: 0 }}
              >
                {logo}
              </a>
            ) : (
              <Box key={provider.name} sx={{ display: "inline-flex" }}>
                {logo}
              </Box>
            );
          })}
        </Box>
        <Typography sx={availabilityAttributionSx}>
          US streaming &amp; subscription availability from JustWatch via TMDB.
        </Typography>
      </Box>
    );
  }

  if (item.mediaType === "VIDEO_GAME") {
    const platforms = item.platforms ?? [];
    if (platforms.length === 0) return null;
    return (
      <Box>
        <SectionTitle>Platforms</SectionTitle>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          {platforms.map((platform) => (
            <GlassChip
              key={platform}
              icon={platformIcon(platform)}
              label={platform}
            />
          ))}
        </Stack>
      </Box>
    );
  }

  return null;
}

/** Map a platform name to a representative MUI icon by family. */
/**
 * Small monogram badge for a platform family. MUI ships only generic icons
 * (no console/service brand marks), so recognized families get a compact,
 * brand-colored initial instead — distinguishable at a glance without
 * reproducing trademarked logo artwork. Unrecognized platforms fall back to
 * a generic icon.
 */
function platformBadge(label: string, bg: string): ReactElement {
  return (
    <Box
      component="span"
      sx={{
        width: 16,
        height: 16,
        borderRadius: "4px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: bg,
        color: "#fff",
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "-0.2px",
        lineHeight: 1,
      }}
    >
      {label}
    </Box>
  );
}

function platformIcon(name: string): ReactElement {
  const value = name.toLowerCase();
  if (value.includes("playstation") || /(^|[^a-z])ps\d?([^a-z]|$)/.test(value)) {
    return platformBadge("PS", "#0072CE");
  }
  if (value.includes("xbox")) {
    return platformBadge("X", "#107C10");
  }
  if (
    value.includes("nintendo") ||
    value.includes("switch") ||
    value.includes("wii")
  ) {
    return platformBadge("N", "#E60012");
  }
  if (value.includes("steam")) {
    return platformBadge("S", "#1B2838");
  }
  if (value.includes("sega")) {
    return <SportsEsportsRoundedIcon />;
  }
  if (
    value.includes("pc") ||
    value.includes("windows") ||
    value.includes("mac") ||
    value.includes("linux")
  ) {
    return <ComputerRoundedIcon />;
  }
  if (
    value.includes("ios") ||
    value.includes("android") ||
    value.includes("mobile") ||
    value.includes("phone")
  ) {
    return <PhoneAndroidRoundedIcon />;
  }
  if (value.includes("web") || value.includes("browser") || value.includes("tv")) {
    return <TvRoundedIcon />;
  }
  return <DevicesOtherRoundedIcon />;
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
    return "Rate this item or run head-to-head comparisons to refine a score.";
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

const detailTokens = {
  accent: {
    cyan: ACCENTS.teal,
    green: ACCENTS.mint,
    purple: ACCENTS.lavender,
  },
};

function panelSx(): SxProps<Theme> {
  return {
    bgcolor: "background.paper",
    border: "1px solid",
    borderColor: "border.subtle",
    borderRadius: 3,
    boxShadow: (theme: Theme) => theme.shadows[1],
    p: { xs: 2, md: 2.5 },
  };
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
  fontSize: "0.875rem",
  fontWeight: 600,
};

const comparisonDateSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.875rem",
};

const comparisonHeaderCellSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.875rem",
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
    fontSize: "0.875rem",
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

const heroGridSx: SxProps<Theme> = {
  display: "grid",
  gap: { xs: 2.5, md: 4 },
  gridTemplateColumns: {
    xs: "1fr",
    md: "minmax(240px, 300px) minmax(0, 1fr)",
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
  gridTemplateColumns: {
    xs: "repeat(2, minmax(0, 1fr))",
    sm: "repeat(auto-fit, minmax(160px, 1fr))",
  },
};

const providerRowSx: SxProps<Theme> = {
  display: "flex",
  flexWrap: "wrap",
  gap: 1.2,
  alignItems: "center",
};

const providerLogoSx: SxProps<Theme> = {
  width: 44,
  height: 44,
  borderRadius: 1.5,
  display: "block",
  objectFit: "cover",
  boxShadow: (theme) => `0 0 0 1px ${alpha(theme.palette.divider, 0.6)}`,
};

const availabilityAttributionSx: SxProps<Theme> = {
  mt: 1,
  color: "text.secondary",
  fontSize: 14,
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
  fontSize: "0.875rem",
};

const heroTitleSx: SxProps<Theme> = {
  fontFamily: (theme) => theme.typography.displayHero.fontFamily,
  fontSize: { xs: "2rem", md: "3rem" },
  fontWeight: 700,
  letterSpacing: "-0.03em",
  lineHeight: 1.05,
  textWrap: "balance",
};

const originalTitleSx: SxProps<Theme> = {
  fontSize: "0.9375rem",
  mt: 0.5,
};

const kickerSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.875rem",
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const matchPanelSx: SxProps<Theme> = {
  alignItems: "center",
  bgcolor: "surface.1",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 3,
  borderLeft: (theme) => `2px solid ${theme.palette.primary.main}`,
  display: "flex",
  flexWrap: "wrap",
  gap: { xs: 1.5, md: 3 },
  px: { xs: 2, md: 3 },
  py: 2,
};

const matchScoreSx: SxProps<Theme> = {
  color: "primary.main",
  fontFamily: (theme) => theme.typography.statValue.fontFamily,
  fontSize: { xs: "2.5rem", md: "3rem" },
  fontWeight: 700,
  letterSpacing: "-0.03em",
  lineHeight: 1,
};

const matchPercentSx: SxProps<Theme> = {
  fontSize: "0.7em",
  fontWeight: 600,
  ml: 0.25,
};

const matchDividerSx: SxProps<Theme> = {
  borderColor: "border.subtle",
  display: { xs: "none", md: "block" },
};

const matchReasonSx: SxProps<Theme> = {
  color: "text.secondary",
  flex: 1,
  fontSize: "0.9375rem",
  lineHeight: 1.5,
  minWidth: 240,
};

const metaPillSx: SxProps<Theme> = {
  color: "text.primary",
  fontSize: "0.9375rem",
  fontWeight: 600,
};

const metadataTextSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.875rem",
};

const metricInfoIconSx: SxProps<Theme> = {
  color: "text.disabled",
  cursor: "help",
  fontSize: 16,
};

const metricLabelSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.875rem",
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

const panelTitleSx: SxProps<Theme> = {
  fontFamily: (theme) => theme.typography.h5.fontFamily,
  fontSize: "1.0625rem",
  fontWeight: 650,
  letterSpacing: "-0.02em",
};

const sectionTitleSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.875rem",
  fontWeight: 600,
  letterSpacing: "0.18em",
  mb: 1.25,
  textTransform: "uppercase",
};

function posterFrameSx(mediaType: MediaType): SxProps<Theme> {
  return {
    aspectRatio: "2 / 3",
    bgcolor: "surface.2",
    border: "1px solid",
    borderColor: "border.subtle",
    borderLeft: `2px solid ${mediaAccent(mediaType)}`,
    borderRadius: 3,
    boxShadow: (theme) => theme.shadows[6],
    justifySelf: { xs: "center", md: "stretch" },
    maxWidth: { xs: 280, sm: 330, md: "none" },
    overflow: "hidden",
    width: "100%",
  };
}

const posterPlaceholderSx: SxProps<Theme> = {
  alignItems: "center",
  bgcolor: "surface.2",
  height: "100%",
  justifyContent: "center",
  p: 2,
  textAlign: "center",
  width: "100%",
};

const scoreTileGridSx: SxProps<Theme> = {
  display: "grid",
  gap: 1.5,
  gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
};

function scoreTileSx(accent?: string): SxProps<Theme> {
  return {
    bgcolor: "background.paper",
    border: "1px solid",
    borderColor: "border.subtle",
    borderLeft: accent ? `2px solid ${accent}` : undefined,
    borderRadius: 3,
    boxShadow: (theme: Theme) => theme.shadows[1],
    display: "flex",
    flexDirection: "column",
    gap: 0.75,
    p: { xs: 2, md: 2.25 },
  };
}

const scoreTileSubSx: SxProps<Theme> = {
  fontSize: "0.875rem",
  mt: 0.25,
};

const scoreValueSx: SxProps<Theme> = {
  fontFamily: (theme) => theme.typography.statValue.fontFamily,
  fontSize: "2.25rem",
  fontWeight: 700,
  letterSpacing: "-0.03em",
  lineHeight: 1,
};

const taxonomyGridSx: SxProps<Theme> = {
  display: "grid",
  gap: 2,
  gridTemplateColumns: { xs: "1fr", md: "1fr 1.6fr" },
};

const connectionsGridSx: SxProps<Theme> = {
  display: "grid",
  gap: { xs: 2.5, md: 2 },
  gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
};

const connectionRowSx: SxProps<Theme> = {
  alignItems: "center",
  bgcolor: "surface.1",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 2,
  display: "flex",
  gap: 1,
  px: 1.5,
  py: 1,
};

const connectionKindChipSx: SxProps<Theme> = {
  flexShrink: 0,
  fontWeight: 600,
};

const connectionLinkSx: SxProps<Theme> = {
  color: "primary.main",
  fontWeight: 600,
};

const connectionTitleSx: SxProps<Theme> = {
  fontWeight: 600,
  minWidth: 0,
};

const threeColGridSx: SxProps<Theme> = {
  display: "grid",
  gap: 2,
  gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
};

const creditsGridSx: SxProps<Theme> = {
  display: "grid",
  gap: 1.25,
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2, minmax(0, 1fr))",
    md: "repeat(4, minmax(0, 1fr))",
  },
};

const creditCardSx: SxProps<Theme> = {
  alignItems: "center",
  bgcolor: "surface.1",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 2,
  display: "flex",
  gap: 1.5,
  p: 1.5,
};

const creditAvatarSx: SxProps<Theme> = {
  alignItems: "center",
  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
  borderRadius: "50%",
  color: "primary.main",
  display: "flex",
  flexShrink: 0,
  fontSize: "0.875rem",
  fontWeight: 700,
  height: 36,
  justifyContent: "center",
  width: 36,
};

const creditNameSx: SxProps<Theme> = {
  fontSize: "0.9375rem",
  fontWeight: 550,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const creditRoleSx: SxProps<Theme> = {
  color: "text.secondary",
  fontSize: "0.875rem",
  letterSpacing: "0.05em",
  mt: 0.25,
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
