import type { Metadata } from "next";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import BookmarkRoundedIcon from "@mui/icons-material/BookmarkRounded";
import CompareArrowsRoundedIcon from "@mui/icons-material/CompareArrowsRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  Box,
  Button,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Rating,
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
  unarchiveMediaItem,
  updateNote,
} from "@/app/media/actions";
import { ConfirmMediaAction } from "@/components/media/ConfirmMediaAction";
import { ActionToastButton } from "@/components/shared/Toasts";
import { CREDIT_ROLES_BY_MEDIA_TYPE, creditLabel } from "@/lib/credits";
import { formatMediaType, formatStatus } from "@/lib/format";
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
  const missingFields = [
    item.description ? null : "description",
    item.posterUrl ? null : "poster",
    item.releaseDate ? null : "release date",
    genres.length > 0 ? null : "genres",
    item.externalRatings.length > 0 ? null : "external ratings",
  ].filter((field): field is string => field !== null);
  const releaseLabel = item.releaseDate
    ? item.releaseDate.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const personalRatingStars =
    item.personalRating == null ? null : item.personalRating / 2;

  return (
    <Box sx={pageSx}>
      <Stack spacing={{ xs: 2, md: 2.5 }}>
        <Button
          href="/media"
          size="small"
          startIcon={<ArrowBackRoundedIcon />}
          sx={{
            alignSelf: "flex-start",
            color: "text.secondary",
            px: 0,
            "&:hover": {
              backgroundColor: "transparent",
              color: "text.primary",
            },
          }}
          variant="text"
        >
          Back to media
        </Button>

        <Box sx={heroGridSx}>
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

          <Stack spacing={2.15} sx={{ minWidth: 0 }}>
            <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1.5 }}>
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

            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
              <GlassChip label={formatMediaType(item.mediaType)} />
              <GlassChip label={formatStatus(item.status)} />
              {releaseLabel ? <GlassChip label={releaseLabel} /> : null}
              {item.isFavorite ? <GlassChip label="Favorite" /> : null}
              {item.isArchived ? <GlassChip label="Archived" /> : null}
            </Stack>

            {genres.length > 0 ? (
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.65 }}>
                {genres.map((genre) => (
                  <GlassChip key={genre} label={genre} muted />
                ))}
              </Stack>
            ) : null}

            <SectionBlock title="Synopsis">
              <Typography
                color={item.description ? "text.primary" : "text.secondary"}
                sx={bodyTextSx}
              >
                {item.description || "No description yet."}
              </Typography>
            </SectionBlock>

            <SectionBlock title="Tags">
              {item.tags.length > 0 ? (
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.65 }}>
                  {item.tags.map((entry) => (
                    <GlassChip key={entry.tagId} label={entry.tag.name} muted />
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary" sx={bodyTextSx}>
                  No tags yet.
                </Typography>
              )}
            </SectionBlock>

            <SectionBlock title="Credits">
              <Stack spacing={0.75}>
                {CREDIT_ROLES_BY_MEDIA_TYPE[item.mediaType].map((role) => {
                  const names = item.credits
                    .filter((credit) => credit.role === role)
                    .sort((first, second) => first.order - second.order)
                    .map((credit) => credit.contributor.name);
                  if (names.length === 0) return null;

                  return (
                    <Typography key={role} sx={bodyTextSx}>
                      <Typography
                        color="text.secondary"
                        component="span"
                        sx={{ fontWeight: 700 }}
                      >
                        {creditLabel(item.mediaType, role)}:{" "}
                      </Typography>
                      {names.join(", ")}
                    </Typography>
                  );
                })}
                {item.credits.length === 0 ? (
                  <Typography color="text.secondary" sx={bodyTextSx}>
                    No credits yet.
                  </Typography>
                ) : null}
              </Stack>
            </SectionBlock>
          </Stack>

          <Stack spacing={1.15} sx={rightRailSx}>
            <Stack direction="row" sx={actionGroupSx}>
              <Tooltip title="Edit">
                <IconButton
                  aria-label="Edit media"
                  href={`/media/${item.id}/edit`}
                  sx={iconActionSx}
                >
                  <EditRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Compare">
                <IconButton
                  aria-label="Compare media"
                  href={`/compare?focus=${item.id}`}
                  sx={iconActionSx}
                >
                  <CompareArrowsRoundedIcon />
                </IconButton>
              </Tooltip>
              {item.isFavorite ? (
                <Tooltip title="Favorite">
                  <IconButton
                    aria-label="Favorite media"
                    href={`/media/${item.id}/edit`}
                    sx={iconActionSx}
                  >
                    <FavoriteRoundedIcon />
                  </IconButton>
                </Tooltip>
              ) : null}
              {item.status === "WATCHLIST" ? (
                <Tooltip title="Watchlist">
                  <IconButton
                    aria-label="Watchlist media"
                    href={`/media/${item.id}/edit`}
                    sx={iconActionSx}
                  >
                    <BookmarkRoundedIcon />
                  </IconButton>
                </Tooltip>
              ) : null}
              <ConfirmMediaAction
                action={
                  item.isArchived
                    ? unarchiveMediaItem.bind(null, item.id)
                    : archiveMediaItem.bind(null, item.id)
                }
                actionLabel={item.isArchived ? "Unarchive" : "Archive"}
                buttonSx={iconActionSx}
                description={
                  item.isArchived
                    ? `${item.title} will return to active library views and comparison candidates.`
                    : `${item.title} will be hidden from active library views, recommendations, and comparison candidates.`
                }
                iconButton
                variant={item.isArchived ? "unarchive" : "archive"}
              />
              <ConfirmMediaAction
                action={deleteMediaItem.bind(null, item.id)}
                actionLabel="Delete"
                buttonSx={dangerIconActionSx}
                confirmLabel="Delete permanently"
                description={`${item.title} and its notes, taxonomy links, list entries, and friend ratings will be permanently deleted.`}
                iconButton
                tone="danger"
                variant="delete"
              />
            </Stack>

            <Box
              sx={{
                ...glassPanelSx(detailTokens.accent.purple),
                ...scorePanelSx,
              }}
            >
              <CardContent sx={panelContentSx}>
                <Stack spacing={1.1}>
                  <Typography sx={kickerSx}>Your rating</Typography>
                  <Stack
                    direction="row"
                    sx={{
                      alignItems: "center",
                      gap: 1.4,
                      justifyContent: "space-between",
                    }}
                  >
                    <Rating
                      max={5}
                      precision={0.5}
                      readOnly
                      size="large"
                      sx={ratingSx}
                      value={personalRatingStars ?? 0}
                    />
                    <Box sx={{ textAlign: "right" }}>
                      <Typography sx={ratingValueSx}>
                        {item.personalRating == null
                          ? "-"
                          : `${formatNumber(item.personalRating)} / 10`}
                      </Typography>
                      <Typography color="text.secondary" sx={metadataTextSx}>
                        {personalRatingStars == null
                          ? "Not rated"
                          : `${formatNumber(personalRatingStars)} / 5 stars`}
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>

                <Divider sx={panelDividerSx} />

                <ScoreLine
                  label="Your score"
                  meta={
                    item.computedPersonalScore == null
                      ? "No score yet"
                      : `${Math.round(item.personalScoreConfidence * 100)}% confidence`
                  }
                  value={formatOptionalScore(item.computedPersonalScore)}
                />
                <ScoreLine
                  label="Pairwise score"
                  meta={`${item.comparisonCount} ${item.comparisonCount === 1 ? "comparison" : "comparisons"}`}
                  value={formatNumber(Math.round(item.pairwiseScore))}
                />
                <ScoreLine
                  label="Consensus score"
                  meta={
                    item.computedConsensusScore == null
                      ? "Not enough data"
                      : `${Math.round(item.consensusConfidence * 100)}% confidence`
                  }
                  value={formatOptionalScore(item.computedConsensusScore)}
                />

                {item.externalRatings.length > 0 ? (
                  <>
                    <Divider sx={panelDividerSx} />
                    <Stack spacing={1}>
                      <Typography sx={kickerSx}>External ratings</Typography>
                      {item.externalRatings.map((rating) => (
                        <ScoreLine
                          key={rating.id}
                          label={formatRatingSource(rating.source)}
                          value={formatExternalRating(
                            rating.score,
                            rating.scale,
                          )}
                        />
                      ))}
                    </Stack>
                  </>
                ) : null}
              </CardContent>
            </Box>

            {missingFields.length > 0 ? (
              <Box sx={dataCalloutSx}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={calloutTitleSx}>
                    Help improve our data
                  </Typography>
                  <Typography color="text.secondary" sx={metadataTextSx}>
                    Missing {missingFields.join(", ")}.
                  </Typography>
                </Box>
                <Button
                  href={`/media/${item.id}/edit`}
                  size="small"
                  variant="text"
                >
                  Edit
                </Button>
              </Box>
            ) : null}
          </Stack>
        </Box>

        <Box sx={glassPanelSx(detailTokens.accent.emerald)}>
          <CardContent sx={widePanelContentSx}>
            <Typography component="h2" sx={panelTitleSx}>
              Notes
            </Typography>
            <Stack spacing={1.4}>
              {item.notes.map((note) => (
                <Box
                  action={updateNote.bind(null, note.id, item.id)}
                  component="form"
                  key={note.id}
                >
                  <Stack spacing={1}>
                    <TextField
                      defaultValue={note.body}
                      fullWidth
                      minRows={2}
                      multiline
                      name="body"
                      placeholder="Write your thoughts about this..."
                      sx={textareaSx}
                    />
                    <ActionToastButton
                      size="small"
                      successMessage="Note saved."
                      sx={{ alignSelf: "flex-start" }}
                      variant="outlined"
                    >
                      Save note
                    </ActionToastButton>
                  </Stack>
                </Box>
              ))}
              <Box action={addNote.bind(null, item.id)} component="form">
                <Stack spacing={1}>
                  <TextField
                    fullWidth
                    minRows={item.notes.length > 0 ? 2 : 3}
                    multiline
                    name="body"
                    placeholder="Write your thoughts about this..."
                    sx={textareaSx}
                  />
                  <ActionToastButton
                    size="small"
                    successMessage="Note added."
                    sx={{ alignSelf: "flex-start" }}
                    variant="contained"
                  >
                    Add note
                  </ActionToastButton>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Box>

        <Box sx={glassPanelSx(detailTokens.accent.cyan)}>
          <CardContent sx={widePanelContentSx}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              sx={{
                alignItems: { sm: "center" },
                gap: 1,
                justifyContent: "space-between",
                mb: 1.5,
              }}
            >
              <Typography component="h2" sx={panelTitleSx}>
                Comparison History
              </Typography>
              {comparisons.length > 0 ? (
                <Button
                  href={`/compare?focus=${item.id}`}
                  size="small"
                  startIcon={<CompareArrowsRoundedIcon />}
                  variant="outlined"
                >
                  Compare
                </Button>
              ) : null}
            </Stack>

            {comparisons.length > 0 ? (
              <Stack spacing={0.9}>
                {comparisons.map((entry) => (
                  <Box key={entry.id} sx={comparisonRowSx}>
                    <Typography sx={{ fontWeight: 800 }}>
                      {entry.result} {entry.opponent}
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                      {entry.createdAt.toLocaleDateString()}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Stack sx={emptyStateSx}>
                <Typography sx={{ fontSize: 18, fontWeight: 900 }}>
                  No comparisons yet
                </Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 430 }}>
                  Start comparing this media with others to see how it stacks
                  up.
                </Typography>
                <Button
                  href={`/compare?focus=${item.id}`}
                  size="small"
                  startIcon={<CompareArrowsRoundedIcon />}
                  variant="contained"
                >
                  Compare this media
                </Button>
              </Stack>
            )}
          </CardContent>
        </Box>
      </Stack>
    </Box>
  );
}

function GlassChip({
  label,
  muted = false,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        backgroundColor: alpha(
          muted ? detailTokens.text.frost : detailTokens.accent.cyan,
          muted ? 0.075 : 0.12,
        ),
        border: `1px solid ${alpha(detailTokens.text.frost, muted ? 0.11 : 0.16)}`,
        color: muted ? "text.secondary" : "text.primary",
        fontFamily: detailFonts.body,
        fontSize: "0.82rem",
        fontWeight: 500,
        letterSpacing: "0.02em",
      }}
    />
  );
}

function ScoreLine({
  label,
  meta,
  value,
}: {
  label: string;
  meta?: string;
  value: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      sx={{ alignItems: "baseline", gap: 1, justifyContent: "space-between" }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={kickerSx}>{label}</Typography>
        {meta ? (
          <Typography color="text.secondary" sx={metadataTextSx}>
            {meta}
          </Typography>
        ) : null}
      </Box>
      <Typography sx={scoreValueSx}>{value}</Typography>
    </Stack>
  );
}

function SectionBlock({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <Box>
      <Typography sx={{ ...sectionTitleSx, mb: 0.75 }}>{title}</Typography>
      {children}
    </Box>
  );
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
    cyan: "#5AE7FF",
    danger: "#F87171",
    emerald: "#00D6A3",
    purple: "#9A5CFF",
    violet: "#B76CFF",
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

const detailFonts = {
  body: "Inter, sans-serif",
  display: "Satoshi, Inter, sans-serif",
};

function glassPanelSx(accent: string) {
  return {
    background: `radial-gradient(circle at 18% 0%, ${alpha(accent, 0.13)}, transparent 22rem), radial-gradient(circle at 92% 12%, ${alpha(detailTokens.accent.cyan, 0.055)}, transparent 20rem), linear-gradient(155deg, rgba(17, 22, 39, 0.84) 0%, rgba(9, 13, 25, 0.92) 54%, rgba(5, 8, 18, 0.96) 100%)`,
    backdropFilter: "blur(20px)",
    borderRadius: "8px",
    boxShadow: [
      `0 22px 70px ${alpha("#000000", 0.38)}`,
      `inset 0 1px 0 ${alpha("#FFFFFF", 0.06)}`,
      `inset 0 0 0 1px ${alpha(detailTokens.text.frost, 0.045)}`,
      `0 0 48px ${alpha(accent, 0.06)}`,
    ].join(", "),
    overflow: "hidden",
    position: "relative",
    "&::before": {
      background: `linear-gradient(90deg, transparent, ${alpha(accent, 0.32)}, ${alpha(detailTokens.accent.cyan, 0.12)}, transparent)`,
      content: '""',
      height: 1,
      left: 18,
      opacity: 0.64,
      position: "absolute",
      right: 18,
      top: 0,
    },
    "&::after": {
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.028), transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.018), transparent 22%)",
      content: '""',
      inset: 0,
      pointerEvents: "none",
      position: "absolute",
    },
  } satisfies SxProps<Theme>;
}

const comparisonRowSx: SxProps<Theme> = {
  alignItems: { xs: "flex-start", sm: "center" },
  backgroundColor: alpha(detailTokens.text.frost, 0.055),
  border: `1px solid ${alpha(detailTokens.text.frost, 0.075)}`,
  borderRadius: "8px",
  display: "flex",
  flexDirection: { xs: "column", sm: "row" },
  gap: 0.75,
  justifyContent: "space-between",
  px: 1.25,
  py: 1,
};

const dangerIconActionSx: SxProps<Theme> = {
  backdropFilter: "blur(18px)",
  backgroundColor: alpha(detailTokens.accent.danger, 0.08),
  border: `1px solid ${alpha(detailTokens.accent.danger, 0.2)}`,
  borderRadius: "50%",
  boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.06)}, 0 10px 26px ${alpha("#000000", 0.2)}`,
  color: "#FDA4AF",
  height: 36,
  transition:
    "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
  width: 36,
  "&:hover": {
    backgroundColor: alpha(detailTokens.accent.danger, 0.15),
    borderColor: alpha(detailTokens.accent.danger, 0.32),
    boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.09)}, 0 14px 34px ${alpha("#000000", 0.26)}, 0 0 20px ${alpha(detailTokens.accent.danger, 0.1)}`,
    transform: "translateY(-1px)",
  },
  "& svg": {
    fontSize: 20,
  },
};

const dataCalloutSx: SxProps<Theme> = {
  alignItems: "center",
  background: `linear-gradient(145deg, ${alpha(detailTokens.accent.purple, 0.2)}, ${alpha(detailTokens.background.panel, 0.84)})`,
  border: `1px solid ${alpha(detailTokens.accent.violet, 0.18)}`,
  borderRadius: "8px",
  boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.06)}, 0 18px 44px ${alpha("#000000", 0.2)}`,
  display: "flex",
  gap: 1,
  justifyContent: "space-between",
  px: 1.35,
  py: 1,
};

const emptyStateSx: SxProps<Theme> = {
  alignItems: "center",
  gap: 1,
  minHeight: 150,
  py: 3,
  textAlign: "center",
};

const heroGridSx: SxProps<Theme> = {
  display: "grid",
  gap: { xs: 2, md: 3 },
  gridTemplateColumns: { xs: "1fr", lg: "minmax(240px, 300px) 1fr 300px" },
};

const iconActionSx: SxProps<Theme> = {
  backdropFilter: "blur(18px)",
  backgroundColor: alpha(detailTokens.text.frost, 0.065),
  border: `1px solid ${alpha(detailTokens.text.frost, 0.12)}`,
  borderRadius: "50%",
  boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.07)}, 0 10px 26px ${alpha("#000000", 0.2)}`,
  color: "text.primary",
  height: 36,
  transition:
    "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
  width: 36,
  "&:hover": {
    backgroundColor: alpha(detailTokens.accent.purple, 0.16),
    borderColor: alpha(detailTokens.accent.violet, 0.3),
    boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.1)}, 0 14px 34px ${alpha("#000000", 0.26)}, 0 0 22px ${alpha(detailTokens.accent.purple, 0.12)}`,
    transform: "translateY(-1px)",
  },
  "& svg": {
    fontSize: 20,
  },
};

const actionGroupSx: SxProps<Theme> = {
  alignItems: "center",
  alignSelf: { xs: "flex-start", lg: "flex-end" },
  backgroundColor: alpha(detailTokens.background.panelDeep, 0.5),
  border: `1px solid ${alpha(detailTokens.text.frost, 0.09)}`,
  borderRadius: "8px",
  boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.045)}`,
  flexShrink: 0,
  flexWrap: "wrap",
  gap: 0.6,
  justifyContent: "flex-end",
  maxWidth: { xs: "100%", sm: 260, lg: "100%" },
  p: 0.45,
};

const kickerSx: SxProps<Theme> = {
  color: "text.secondary",
  fontFamily: detailFonts.body,
  fontSize: "0.82rem",
  fontWeight: 500,
  letterSpacing: "0.02em",
  opacity: 0.72,
  textTransform: "uppercase",
};

const pageSx: SxProps<Theme> = {
  background:
    "radial-gradient(circle at 18% 8%, rgba(55, 120, 255, 0.12), transparent 34%), radial-gradient(circle at 82% 0%, rgba(154, 92, 255, 0.16), transparent 30%), radial-gradient(circle at 52% 22%, rgba(90, 231, 255, 0.055), transparent 34%), linear-gradient(180deg, #050816 0%, #070B18 46%, #050816 100%)",
  borderRadius: { xs: 0, md: "8px" },
  boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.04)}`,
  mx: { xs: -2, sm: -3 },
  my: { xs: -1, md: -2 },
  px: { xs: 2, sm: 3, md: 3.5 },
  py: { xs: 2, md: 3 },
};

const panelContentSx: SxProps<Theme> = {
  display: "flex",
  flexDirection: "column",
  gap: 1.5,
  p: 2,
  position: "relative",
  zIndex: 1,
  "&:last-child": { pb: 2 },
};

const panelDividerSx: SxProps<Theme> = {
  borderColor: alpha(detailTokens.text.frost, 0.1),
};

const panelTitleSx: SxProps<Theme> = {
  fontSize: 20,
  fontFamily: detailFonts.display,
  fontWeight: 600,
  letterSpacing: "-0.02em",
};

const bodyTextSx: SxProps<Theme> = {
  fontFamily: detailFonts.body,
  fontSize: { xs: 15, md: 16 },
  fontWeight: 500,
  lineHeight: 1.75,
};

const calloutTitleSx: SxProps<Theme> = {
  color: detailTokens.accent.violet,
  fontFamily: detailFonts.display,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "-0.02em",
};

const heroTitleSx: SxProps<Theme> = {
  fontFamily: detailFonts.display,
  fontSize: { xs: 34, md: 52 },
  fontWeight: 700,
  letterSpacing: "-0.04em",
  lineHeight: 0.95,
  textWrap: "balance",
};

const metadataTextSx: SxProps<Theme> = {
  fontFamily: detailFonts.body,
  fontSize: "0.82rem",
  fontWeight: 500,
  letterSpacing: "0.02em",
  opacity: 0.72,
};

const sectionTitleSx: SxProps<Theme> = {
  fontFamily: detailFonts.display,
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: "-0.02em",
};

const ratingSx: SxProps<Theme> = {
  color: detailTokens.accent.violet,
  "& .MuiRating-iconEmpty": {
    color: alpha(detailTokens.text.frost, 0.16),
  },
  "& .MuiRating-iconFilled": {
    filter: `drop-shadow(0 0 10px ${alpha(detailTokens.accent.violet, 0.28)})`,
  },
};

const ratingValueSx: SxProps<Theme> = {
  fontFamily: detailFonts.body,
  fontSize: 24,
  fontWeight: 700,
  lineHeight: 1.05,
};

const rightRailSx: SxProps<Theme> = {
  alignSelf: "start",
  minWidth: 0,
  width: "100%",
};

const scoreValueSx: SxProps<Theme> = {
  fontFamily: detailFonts.body,
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1,
};

const posterFrameSx: SxProps<Theme> = {
  aspectRatio: "2 / 3",
  borderRadius: { xs: "8px", md: "10px" },
  boxShadow: "0 28px 90px rgba(0,0,0,0.55), 0 0 42px rgba(124,92,255,0.22)",
  justifySelf: { xs: "center", lg: "stretch" },
  maxWidth: { xs: 270, sm: 320, lg: "none" },
  overflow: "hidden",
  position: "relative",
  width: "100%",
};

const posterPlaceholderSx: SxProps<Theme> = {
  alignItems: "center",
  background:
    "radial-gradient(circle at 32% 20%, rgba(85,216,255,0.24), transparent 34%), radial-gradient(circle at 72% 10%, rgba(155,124,255,0.26), transparent 32%), linear-gradient(145deg, #111827, #05070E)",
  height: "100%",
  justifyContent: "center",
  p: 2,
  textAlign: "center",
  width: "100%",
};

const scorePanelSx: SxProps<Theme> = {
  alignSelf: "start",
  width: "100%",
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

const widePanelContentSx: SxProps<Theme> = {
  p: { xs: 1.6, md: 2 },
  position: "relative",
  zIndex: 1,
  "&:last-child": { pb: { xs: 1.6, md: 2 } },
};
