"use client";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import type { MediaType } from "@prisma/client";
import Link from "next/link";
import { DashboardSection } from "@/components/cinematic/CinematicPrimitives";
import { ReleaseRadar } from "@/components/dashboard/ReleaseRadar";
import { formatMediaType } from "@/lib/format";
import type { MediaItemDTO } from "@/lib/types";
import { releaseYearLabel } from "@/lib/date-labels";
import {
  mediaAccent,
  mediaTypeIcon,
  posterFallback,
  shortMediaTypeLabel,
} from "@/lib/media-ui-helpers";
import { PosterTile } from "@/components/media/PosterCard";
import { ScoreBadge as PosterScoreBadge } from "@/components/media/ScoreDisplay";
import CollectionsBookmarkIcon from "@mui/icons-material/CollectionsBookmark";
import type { CollectionSummary } from "@/lib/db/collections";

type DashboardData = {
  userName: string | null;
  recommendations: Array<{
    media: MediaItemDTO;
    score: number;
    confidence: number;
  }>;
  tonightPicksByMediaType: Array<{
    mediaType: MediaType;
    recommendations: Array<{
      media: MediaItemDTO;
      score: number;
      confidence: number;
    }>;
  }>;
  topItemsByMediaType: Array<{
    mediaType: MediaType;
    items: Array<{
      media: MediaItemDTO;
      score: number;
    }>;
  }>;
  upcomingItemsByMediaType: Array<{
    mediaType: MediaType;
    items: MediaItemDTO[];
  }>;
};

const dashboardMediaTypes: MediaType[] = ["MOVIE", "TV_SHOW", "VIDEO_GAME"];

/** Featured collections fill a 2×2 grid; extras live behind "Browse all". */
const FEATURED_COLLECTION_COUNT = 4;

// 1b's header link: peach, arrowed, sitting at the end of the hairline rule.
// The `.MuiButton-text` qualifier out-specifies the theme's text-button
// override, which would otherwise pin these to text.primary.
const panelActionSx: SxProps<Theme> = {
  flexShrink: 0,
  fontSize: "0.875rem",
  fontWeight: 550,
  minHeight: 44,
  px: 1,
  "&.MuiButton-text": {
    color: "primary.main",
    "&:hover": { bgcolor: "transparent", color: "primary.light" },
  },
};

export function DashboardClient({
  collections,
  data,
  isAuthenticated,
}: {
  collections: CollectionSummary[];
  data: DashboardData;
  isAuthenticated: boolean;
}) {
  // Anonymous viewers see public quality signals only — match % and confidence %
  // both read off a user's taste graph, so they're hidden when no one is signed in.
  const showPersonalSignals = isAuthenticated;
  // One switcher drives the whole page. It starts on the first type that has a
  // pick to headline, so a library with no rated movies doesn't open on an
  // empty hero.
  const [mediaType, setMediaType] = useState<MediaType>(
    () =>
      dashboardMediaTypes.find((candidate) =>
        data.tonightPicksByMediaType.some(
          (entry) => entry.mediaType === candidate && entry.recommendations[0],
        ),
      ) ?? "MOVIE",
  );

  const topItems = useMemo(
    () =>
      (
        data.topItemsByMediaType.find((entry) => entry.mediaType === mediaType)
          ?.items ?? []
      ).slice(0, 10),
    [data.topItemsByMediaType, mediaType],
  );

  const upcomingItems = useMemo(
    () =>
      data.upcomingItemsByMediaType.find(
        (entry) => entry.mediaType === mediaType,
      )?.items ?? [],
    [data.upcomingItemsByMediaType, mediaType],
  );

  const tonightRecommendations =
    data.tonightPicksByMediaType.find((entry) => entry.mediaType === mediaType)
      ?.recommendations ?? [];
  const heroRecommendation = tonightRecommendations[0];
  const recommendationRailItems = tonightRecommendations.slice(1, 6);
  // Panels whose contents follow the switcher wear the selected type's color —
  // border, glow, and header. Featured collections is type-agnostic, so it
  // stays on the default peach.
  const typeAccent = mediaAccent(mediaType);

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        sx={{ alignItems: { lg: "flex-end" }, gap: 2 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="eyebrow" sx={{ display: "block", mb: 0.75 }}>
            Dashboard
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: (theme) => theme.typography.h3.fontFamily,
              fontSize: { xs: "1.5rem", md: "1.875rem" },
              fontWeight: 650,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
            }}
          >
            {data.userName
              ? `Welcome back, ${data.userName}`
              : "Welcome to Medialy"}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
            Tonight&apos;s pick, your rankings, and what&apos;s on the way.
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: { xs: "flex-start", lg: "flex-end" },
          }}
        >
          <MediaTypeTabs onChange={setMediaType} value={mediaType} />
        </Box>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateAreas: {
            xs: `"tonight"\n"top"\n"collections"\n"upcoming"`,
            lg: [
              `"tonight tonight tonight tonight tonight tonight tonight tonight tonight tonight tonight tonight"`,
              `"top top top top top top top top top top top top"`,
              `"collections collections collections collections collections collections upcoming upcoming upcoming upcoming upcoming upcoming"`,
            ].join("\n"),
          },
          gridTemplateColumns: { xs: "1fr", lg: "repeat(12, minmax(0, 1fr))" },
        }}
      >
        <Box sx={{ gridArea: "tonight", minWidth: 0 }}>
          {heroRecommendation ? (
            <DiagonalPickStrip
              confidence={heroRecommendation.confidence}
              hero={heroRecommendation.media}
              heroScore={heroRecommendation.score}
              showMatch={showPersonalSignals}
              upNext={recommendationRailItems.map((r) => ({
                media: r.media,
                score: r.score,
              }))}
            />
          ) : (
            <DashboardSection
              accent={typeAccent}
              title="Tonight's pick"
              titleVariant="eyebrow"
            >
              <EmptyPanel
                icon={<AutoAwesomeIcon />}
                label="Add ratings to unlock a featured recommendation."
              />
            </DashboardSection>
          )}
        </Box>

        <Box sx={{ gridArea: "top", minWidth: 0 }}>
          <DashboardSection
            accent={typeAccent}
            action={
              <Button
                endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                href={`/canon?type=${mediaType}`}
                size="small"
                sx={panelActionSx}
              >
                Open Canon
              </Button>
            }
            title="Medialy Top 10"
            titleVariant="eyebrow"
          >
            {topItems.length > 0 ? (
              <Box
                sx={{
                  alignContent: "center",
                  display: "grid",
                  flex: 1,
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    sm: "repeat(5, minmax(0, 1fr))",
                    lg: "repeat(10, minmax(0, 1fr))",
                  },
                  mt: 0.5,
                }}
              >
                {topItems.map((entry, index) => (
                  <RankedPosterTile
                    key={entry.media.id}
                    item={entry.media}
                    rank={index + 1}
                    score={entry.score}
                  />
                ))}
              </Box>
            ) : (
              <EmptyPanel
                icon={<PlaylistAddCheckIcon />}
                label={`No ${formatMediaType(mediaType).toLowerCase()} items yet.`}
              />
            )}
          </DashboardSection>
        </Box>

        <Box sx={{ gridArea: "collections", minWidth: 0 }}>
          <DashboardSection
            action={
              <Button
                endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                href="/discover/collections"
                size="small"
                sx={panelActionSx}
              >
                Browse all
              </Button>
            }
            title="Featured collections"
            titleVariant="eyebrow"
          >
            <FeaturedCollectionsPanel collections={collections} />
          </DashboardSection>
        </Box>

        <Box sx={{ gridArea: "upcoming", minWidth: 0 }}>
          <DashboardSection
            accent={typeAccent}
            action={
              <Button
                endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                href="/upcoming"
                size="small"
                sx={panelActionSx}
              >
                Full calendar
              </Button>
            }
            title="Release Radar"
            titleVariant="eyebrow"
          >
            <ReleaseRadar items={upcomingItems} mediaType={mediaType} />
          </DashboardSection>
        </Box>
      </Box>
    </Stack>
  );
}

// Diagonal skew offset (px) applied to each slice's clip-path. Larger = more
// dramatic angle. Slices after the featured one are pulled back by this same
// amount so adjacent diagonals share an edge exactly.
const DIAG_SKEW = 40;

function DiagonalPickStrip({
  confidence,
  hero,
  heroScore,
  showMatch,
  upNext,
}: {
  confidence: number;
  hero: MediaItemDTO;
  heroScore: number;
  showMatch: boolean;
  upNext: Array<{ media: MediaItemDTO; score: number }>;
}) {
  const heroYear = releaseYearLabel(hero.releaseDate);
  const heroMeta = [
    formatMediaType(hero.mediaType),
    heroYear,
    ...hero.genres.slice(0, 1),
  ].filter((v): v is string => Boolean(v));

  // Clip paths: featured has a straight left edge + diagonal right; up-next
  // slices are parallelograms; the final slice has a diagonal left + straight
  // right. Slice height is `100%` so the offset is purely horizontal.
  const featuredClip = `polygon(0 0, 100% 0, calc(100% - ${DIAG_SKEW}px) 100%, 0 100%)`;
  const middleClip = `polygon(${DIAG_SKEW}px 0, 100% 0, calc(100% - ${DIAG_SKEW}px) 100%, 0 100%)`;
  const lastClip = `polygon(${DIAG_SKEW}px 0, 100% 0, 100% 100%, 0 100%)`;

  const heroAccent = mediaAccent(hero.mediaType);
  return (
    <Box
      component="section"
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "border.subtle",
        borderLeft: `2px solid ${heroAccent}`,
        borderRadius: 3,
        boxShadow: `0 14px 40px rgba(0,0,0,0.5), 0 1px 0 ${alpha("#FFFFFF", 0.04)} inset, -14px 0 56px -22px ${alpha(heroAccent, 0.6)}`,
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        height: { xs: "auto", md: 468 },
        // No `minHeight` floor at xs: the slices stack vertically on a phone, so
        // a 720px floor plus five 200px slices meant ~1,360px — three and a half
        // screens of "Tonight's pick" before anything else on the dashboard.
        minHeight: { md: 468 },
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Featured slice */}
      <Box
        sx={{
          flex: { xs: "1 1 auto", md: "2.4 1 0" },
          height: { xs: 360, md: "100%" },
          minWidth: 0,
          position: "relative",
          clipPath: { xs: "none", md: featuredClip },
          "&:hover .pick-backdrop": { transform: "scale(1.03)" },
        }}
      >
        <SliceBackdrop item={hero} className="pick-backdrop" />
        {/* Dark gradient skewed left so the copy stays legible */}
        <Box
          sx={{
            background:
              "linear-gradient(90deg, rgba(8,8,11,0.92) 0%, rgba(8,8,11,0.72) 45%, rgba(8,8,11,0.18) 80%, rgba(8,8,11,0.45) 100%), linear-gradient(0deg, rgba(8,8,11,0.95) 0%, rgba(8,8,11,0.35) 45%, rgba(8,8,11,0) 100%)",
            inset: 0,
            position: "absolute",
            zIndex: 1,
          }}
        />
        {showMatch ? (
          <ScoreBadge
            label="Match"
            sx={{
              position: "absolute",
              right: { xs: 16, sm: 64 },
              top: { xs: 16, sm: 18 },
              zIndex: 5,
            }}
            value={`${Math.round(heroScore)}%`}
          />
        ) : null}
        {/* Copy */}
        <Stack
          spacing={1.25}
          sx={{
            bottom: { xs: 20, md: 26 },
            left: { xs: 20, md: 26 },
            maxWidth: { xs: "calc(100% - 40px)", sm: 480 },
            position: "absolute",
            right: { xs: 20, sm: "auto" },
            zIndex: 4,
          }}
        >
          <Typography
            sx={{
              color: heroAccent,
              fontSize: "0.875rem",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textShadow: "0 1px 10px rgba(0,0,0,0.8)",
              textTransform: "uppercase",
            }}
          >
            Tonight&apos;s pick
          </Typography>
          <Typography
            component="h2"
            sx={{
              color: "#FFFFFF",
              fontFamily: (theme) => theme.typography.displayHero.fontFamily,
              fontSize: "clamp(1.75rem, 3.8vw, 3.1rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.02,
            }}
          >
            {hero.title}
          </Typography>
          <Box
            sx={{
              background: `linear-gradient(90deg, ${heroAccent}, ${alpha(heroAccent, 0)})`,
              borderRadius: 1,
              boxShadow: `0 0 16px ${alpha(heroAccent, 0.55)}`,
              height: 3,
              mt: -0.5,
              width: 72,
            }}
          />
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, pt: 0.25 }}>
            {heroMeta.map((entry) => (
              <OnDarkChip key={entry}>{entry}</OnDarkChip>
            ))}
            {showMatch ? (
              <OnDarkChip>{`${Math.round(confidence * 100)}% confidence`}</OnDarkChip>
            ) : null}
          </Stack>
          <Typography
            sx={{
              color: "rgba(255,255,255,0.82)",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              maxWidth: 420,
            }}
          >
            {pickReason(hero)}
          </Typography>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, pt: 0.5 }}>
            <Button
              component={Link}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
              href={`/media/${hero.id}`}
              size="small"
              variant="contained"
            >
              View details
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Up-next slices. On a phone these stack, so we show at most two —
          five of them buried the rest of the dashboard below three screens of
          scroll. The full set is still there at md+, where they sit side by
          side as intended. */}
      {upNext.map((rec, i) => {
        const isLast = i === upNext.length - 1;
        const clip = isLast ? lastClip : middleClip;
        const sliceAccent = mediaAccent(rec.media.mediaType);
        return (
          <Box
            component={Link}
            href={`/media/${rec.media.id}`}
            key={rec.media.id}
            sx={{
              color: "inherit",
              // Hide everything past the first two once they're stacked.
              display: { xs: i < 2 ? "block" : "none", md: "block" },
              flex: { xs: "1 1 auto", md: "1 1 0" },
              height: { xs: 200, md: "100%" },
              marginLeft: { xs: 0, md: `-${DIAG_SKEW}px` },
              minWidth: 0,
              position: "relative",
              textDecoration: "none",
              clipPath: { xs: "none", md: clip },
              transition: "filter 200ms ease",
              "&:hover .upnext-backdrop": { transform: "scale(1.04)" },
              "&:hover .upnext-title-bar": { width: 56 },
              "&:hover": { filter: "brightness(1.08)" },
            }}
          >
            <SliceBackdrop item={rec.media} className="upnext-backdrop" />
            <Box
              sx={{
                background:
                  "linear-gradient(0deg, rgba(8,8,11,0.92) 0%, rgba(8,8,11,0.30) 55%, rgba(8,8,11,0.10) 100%)",
                inset: 0,
                position: "absolute",
                zIndex: 1,
              }}
            />
            {/* Diagonal seam line — sits on the slice's left edge, visible only
                on md+ where the clip-path is active. Slants from (40,0) to (0,h)
                matching the polygon's left edge exactly. */}
            <Box
              aria-hidden
              sx={{
                clipPath: {
                  xs: "none",
                  md: `polygon(${DIAG_SKEW}px 0, ${DIAG_SKEW + 1.5}px 0, 1.5px 100%, 0 100%)`,
                },
                background: `linear-gradient(180deg, ${alpha(sliceAccent, 0.55)} 0%, ${alpha("#FFFFFF", 0.18)} 50%, ${alpha(sliceAccent, 0.55)} 100%)`,
                display: { xs: "none", md: "block" },
                inset: 0,
                position: "absolute",
                zIndex: 2,
              }}
            />
            {showMatch ? (
              <ScoreBadge
                label="Match"
                sx={{
                  position: "absolute",
                  right: 18 + DIAG_SKEW / 2,
                  top: 16,
                  zIndex: 3,
                  height: 44,
                  width: 44,
                }}
                value={`${Math.round(rec.score)}%`}
              />
            ) : null}
            <Stack
              spacing={0.5}
              sx={{
                bottom: 18,
                left: 18 + DIAG_SKEW / 2,
                position: "absolute",
                right: 16,
                zIndex: 3,
              }}
            >
              <Typography
                sx={{
                  color: "#FFFFFF",
                  fontFamily: (theme) =>
                    theme.typography.displayHero.fontFamily,
                  fontSize: "clamp(1rem, 1.5vw, 1.5rem)",
                  fontWeight: 650,
                  letterSpacing: "-0.015em",
                  lineHeight: 1.1,
                  textShadow: "0 2px 12px rgba(0,0,0,0.6)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {rec.media.title}
              </Typography>
              <Box
                className="upnext-title-bar"
                sx={{
                  background: `linear-gradient(90deg, ${sliceAccent}, ${alpha(sliceAccent, 0)})`,
                  borderRadius: 1,
                  boxShadow: `0 0 12px ${alpha(sliceAccent, 0.6)}`,
                  height: 2.5,
                  mt: 0.4,
                  transition: "width 250ms cubic-bezier(.2,.8,.2,1)",
                  width: 36,
                }}
              />
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

function SliceBackdrop({
  item,
  className,
}: {
  item: MediaItemDTO;
  className?: string;
}) {
  return (
    <Box
      className={className}
      sx={{
        backgroundImage: item.posterUrl
          ? `url(${item.posterUrl})`
          : posterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        inset: 0,
        position: "absolute",
        transition: "transform 700ms cubic-bezier(.2,.8,.2,1)",
        zIndex: 0,
      }}
    />
  );
}

function ScoreBadge({
  label,
  sx,
  value,
}: {
  label: string;
  sx?: SxProps<Theme>;
  value: string;
}) {
  return (
    <Box
      sx={{
        alignItems: "center",
        bgcolor: "rgba(8,8,11,0.55)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.16)",
        borderRadius: 2,
        color: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        height: { xs: 52, sm: 56 },
        justifyContent: "center",
        width: { xs: 52, sm: 56 },
        ...sx,
      }}
    >
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, lineHeight: 1 }}>
        {value}
      </Typography>
      <Typography
        sx={{
          color: "rgba(255,255,255,0.7)",
          fontSize: "0.875rem",
          fontWeight: 550,
          lineHeight: 1,
          mt: 0.25,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function OnDarkChip({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: "rgba(255,255,255,0.12)",
        borderRadius: 1.5,
        color: "rgba(255,255,255,0.92)",
        fontSize: "0.875rem",
        fontWeight: 550,
        lineHeight: 1,
        px: 1,
        py: 0.6,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * A top-10 poster with its rank set in display type above the artwork —
 * №1 in the brand accent, the chasing pack in muted neutral so the shape of
 * the ranking reads before any title does.
 */
function RankedPosterTile({
  item,
  rank,
  score,
}: {
  item: MediaItemDTO;
  rank: number;
  score: number;
}) {
  // The page is already filtered to one media type, so the year alone carries
  // the caption — repeating "Movie" ten times says nothing.
  const releaseYear = releaseYearLabel(item.releaseDate);
  return (
    <Box sx={{ minWidth: 0, position: "relative", pt: 2.75 }}>
      <Typography
        component="span"
        sx={{
          color: (theme) =>
            rank === 1
              ? theme.palette.primary.main
              : alpha(theme.palette.text.primary, 0.32),
          fontFamily: (theme) => theme.typography.displayHero.fontFamily,
          fontSize: "2.125rem",
          fontWeight: 700,
          left: 2,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          position: "absolute",
          top: 0,
          zIndex: 2,
        }}
      >
        {rank}
      </Typography>
      <PosterTile
        item={item}
        meta={releaseYear ? [releaseYear] : undefined}
        scoreBadge={
          typeof score === "number" ? (
            <PosterScoreBadge score={score} />
          ) : undefined
        }
      />
    </Box>
  );
}

function FeaturedCollectionsPanel({
  collections,
}: {
  collections: CollectionSummary[];
}) {
  if (collections.length === 0) {
    return (
      <EmptyPanel
        icon={<CollectionsBookmarkIcon />}
        label="No published collections yet."
      />
    );
  }

  const featured = collections.slice(0, FEATURED_COLLECTION_COUNT);
  return (
    <Box
      sx={{
        display: "grid",
        flex: 1,
        gap: 1.5,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
        },
        gridTemplateRows: { sm: "repeat(2, minmax(0, 1fr))" },
        minHeight: 316,
        mt: 0.5,
      }}
    >
      {featured.map((collection) => (
        <CollectionCoverCard
          collection={collection}
          key={collection.id}
          // A lone collection has no grid to balance against, so it takes the
          // full width rather than sitting in a half-empty row.
          fullWidth={featured.length === 1}
        />
      ))}
    </Box>
  );
}

function CollectionCoverCard({
  collection,
  fullWidth,
}: {
  collection: CollectionSummary;
  fullWidth: boolean;
}) {
  const blurb = collection.subtitle ?? collection.description;
  const meta = [
    `${collection.itemCount} ${collection.itemCount === 1 ? "item" : "items"}`,
    blurb,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");

  return (
    <Box
      component={Link}
      href={`/discover/collections/${collection.id}`}
      sx={{
        backgroundColor: "surface.2",
        backgroundImage: collection.coverUrl
          ? `linear-gradient(180deg, rgba(8,8,11,0.15) 0%, rgba(8,8,11,0.55) 55%, rgba(8,8,11,0.92) 100%), url(${collection.coverUrl})`
          : "linear-gradient(140deg, rgba(90,120,200,0.35), rgba(8,8,11,0.92))",
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 2,
        color: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        gridColumn: fullWidth ? "1 / -1" : undefined,
        justifyContent: "flex-end",
        minHeight: 150,
        overflow: "hidden",
        p: 1.5,
        position: "relative",
        textDecoration: "none",
        transition: "border-color 160ms ease, transform 160ms ease",
        "&:hover": {
          borderColor: "border.strong",
          transform: "translateY(-2px)",
        },
      }}
    >
      {collection.featuredMonth ? (
        <Typography
          variant="eyebrow"
          sx={{
            color: "primary.main",
            display: "block",
            mb: "auto",
            textShadow: "0 1px 8px rgba(0,0,0,0.7)",
          }}
        >
          {`Featured · ${collection.featuredMonth}`}
        </Typography>
      ) : null}
      <Typography
        sx={{
          fontFamily: (t) => t.typography.h5.fontFamily,
          fontSize: "1.05rem",
          fontWeight: 700,
          letterSpacing: "-0.015em",
          lineHeight: 1.2,
          textShadow: "0 2px 12px rgba(0,0,0,0.6)",
        }}
      >
        {collection.name}
      </Typography>
      <Typography
        sx={{
          color: "rgba(255,255,255,0.82)",
          display: "-webkit-box",
          fontSize: "0.875rem",
          lineHeight: 1.35,
          mt: 0.5,
          overflow: "hidden",
          textShadow: "0 1px 8px rgba(0,0,0,0.6)",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {meta}
      </Typography>
    </Box>
  );
}

function MediaTypeTabs({
  onChange,
  value,
}: {
  onChange: (value: MediaType) => void;
  value: MediaType;
}) {
  return (
    <ToggleButtonGroup
      aria-label="Media type"
      exclusive
      onChange={(_, nextValue: MediaType | null) => {
        if (nextValue) onChange(nextValue);
      }}
      size="small"
      sx={{
        bgcolor: "surface.1",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 2,
        display: "inline-flex",
        gap: 0.25,
        p: 0.35,
        width: "max-content",
        "& .MuiToggleButton-root": {
          border: 0,
          borderRadius: 1.5,
          color: "text.secondary",
          gap: 0.6,
          minHeight: 44,
          px: 1,
          py: 0.4,
          textTransform: "none",
          whiteSpace: "nowrap",
          "&.Mui-selected": {
            bgcolor: "background.paper",
            color: "text.primary",
            boxShadow: (theme) => theme.shadows[1],
            "&:hover": { bgcolor: "background.paper" },
          },
        },
      }}
      value={value}
    >
      {dashboardMediaTypes.map((mediaType) => {
        const accent = mediaAccent(mediaType);
        return (
          <ToggleButton
            key={mediaType}
            value={mediaType}
            sx={{
              borderLeft: `2px solid ${alpha(accent, 0.35)} !important`,
              "& svg": { color: accent },
              "&.Mui-selected": {
                bgcolor: `${alpha(accent, 0.18)} !important`,
                borderLeft: `2px solid ${accent} !important`,
                color: `${accent} !important`,
              },
            }}
          >
            {mediaTypeIcon(mediaType)}
            <Typography
              component="span"
              sx={{ fontSize: "0.875rem", fontWeight: 550 }}
            >
              {shortMediaTypeLabel(mediaType)}
            </Typography>
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}

function EmptyPanel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Stack
      spacing={1}
      sx={{
        alignItems: "center",
        bgcolor: "surface.1",
        border: "1px dashed",
        borderColor: "border.default",
        borderRadius: 2,
        color: "text.secondary",
        flex: 1,
        justifyContent: "center",
        mt: 1,
        py: 3,
      }}
    >
      {icon}
      <Typography sx={{ fontSize: "0.875rem" }}>{label}</Typography>
    </Stack>
  );
}

function pickReason(item: MediaItemDTO) {
  const genre = item.genres[0];
  if (genre) {
    return `Because you've rated ${genre.toLowerCase()} highly in your library.`;
  }
  return "Because your ratings and rankings make this stand out tonight.";
}
