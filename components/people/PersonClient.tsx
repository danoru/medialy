"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import { Box, Button, Stack, Typography } from "@mui/material";
import type { MediaType } from "@prisma/client";
import {
  DashboardSection,
  panelActionSx,
} from "@/components/cinematic/CinematicPrimitives";
import { MediaTypeTabs } from "@/components/dashboard/MediaTypeTabs";
import { MediaThumb, MediaTitleLink } from "@/components/media/MediaThumb";
import { PosterTile } from "@/components/media/PosterCard";
import { RankedPosterTile } from "@/components/media/RankedPosterTile";
import { ScoreBadge } from "@/components/media/ScoreDisplay";
import {
  BackdropMarquee,
  MARQUEE_MUTED,
  MarqueeFeature,
  MarqueeTitle,
} from "@/components/shared/BackdropMarquee";
import { EmptyHint, StatCount, StatCountDivider } from "@/components/shared/StatCount";
import type { PersonPageData } from "@/lib/db/people";
import { releaseYearLabel } from "@/lib/date-labels";
import { mediaAccent } from "@/lib/media-ui-helpers";
import { titleNoun } from "@/lib/people";
import { statusLabel } from "@/lib/status-labels";
import { formatDelta, PersonRow } from "./PersonParts";

/** Credits shown before "Show all". */
const CREDITS_SHOWN = 12;

export function PersonClient({
  basePath,
  data,
}: {
  basePath: string;
  data: PersonPageData;
}) {
  const [mediaType, setMediaType] = useState<MediaType>(data.defaultType);
  const section = useMemo(
    () => data.byType.find((entry) => entry.mediaType === mediaType) ?? data.byType[0],
    [data.byType, mediaType],
  );
  const [showAll, setShowAll] = useState(false);
  const accent = mediaAccent(section.mediaType);
  const nouns = titleNoun(section.mediaType);
  const verb = statusLabel("COMPLETED", section.mediaType);
  const credits = showAll ? section.credits : section.credits.slice(0, CREDITS_SHOWN);
  // Whole rows of four only: a lone poster on a second row reads as a mistake.
  // Anything cut here is still in the full list below.
  const unseen = section.unseen.slice(
    0,
    section.unseen.length >= 8 ? 8 : Math.min(4, section.unseen.length),
  );
  // Few ratings: "Your take" shares a row with "Still to watch" instead of
  // leaving a full-width panel mostly empty.
  const compact = section.rated.length <= 4;
  const feature = section.feature;
  const featureYear = feature ? releaseYearLabel(feature.tile.releaseDate) : null;

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ alignItems: { sm: "center" }, gap: 1.5, justifyContent: "space-between" }}
      >
        <Button
          component={Link}
          href={basePath}
          size="small"
          startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
          sx={{ ...panelActionSx, alignSelf: "flex-start" }}
        >
          People
        </Button>
        {data.byType.length > 1 ? (
          <MediaTypeTabs
            onChange={(next) => {
              setMediaType(next);
              setShowAll(false);
            }}
            types={data.byType.map((entry) => entry.mediaType)}
            value={section.mediaType}
          />
        ) : null}
      </Stack>

      <BackdropMarquee
        accent={accent}
        aside={
          feature ? (
            <MarqueeFeature
              accent={accent}
              eyebrow={feature.yours ? "Your favourite" : "Critics' pick"}
              item={feature.tile}
              meta={featureYear ? [featureYear] : undefined}
              score={feature.score}
            />
          ) : undefined
        }
        mediaType={section.mediaType}
        posterUrl={feature?.tile.posterUrl}
      >
        <Stack direction="row" sx={{ alignItems: "flex-end", gap: 2.5, minWidth: 0 }}>
          <Box sx={{ minWidth: 0 }}>
            <MarqueeTitle>{data.person.name}</MarqueeTitle>
            <Typography sx={{ color: MARQUEE_MUTED, fontSize: "0.875rem", mt: 0.75 }}>
              {section.roles} · {section.titleCount}{" "}
              {titleNoun(section.mediaType, section.titleCount)} on Medialy
            </Typography>
            <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 3, mt: 2.5 }}>
              <StatCount label={verb} value={`${section.seenCount}/${section.titleCount}`} />
              <StatCountDivider />
              <StatCount label="Rated" value={section.ratedCount} />
              <StatCountDivider />
              <StatCount label="Your average" value={section.average?.toFixed(1) ?? "—"} />
              <StatCountDivider />
              <StatCount
                label="Vs your usual"
                value={section.delta != null ? formatDelta(section.delta) : "—"}
              />
            </Stack>
          </Box>
        </Stack>
      </BackdropMarquee>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <Box sx={{ gridColumn: { lg: compact ? "auto" : "span 2" }, minWidth: 0 }}>
          <DashboardSection accent={accent} title="Your take" titleVariant="eyebrow">
            {section.rated.length ? (
              <Box
                sx={{
                  alignContent: "start",
                  display: "grid",
                  flex: 1,
                  gap: 1.5,
                  // Sized to what there is: a short list sits beside "Still to
                  // watch" as four across; a long one runs the full width.
                  gridTemplateColumns: compact
                    ? { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }
                    : {
                        xs: "repeat(2, minmax(0, 1fr))",
                        sm: "repeat(5, minmax(0, 1fr))",
                        lg: `repeat(${Math.min(10, Math.max(5, section.rated.length))}, minmax(0, 1fr))`,
                      },
                  mt: 0.5,
                }}
              >
                {section.rated.map((entry, index) => (
                  <RankedPosterTile
                    item={entry.tile}
                    key={entry.tile.id}
                    rank={index + 1}
                    score={entry.score}
                  />
                ))}
              </Box>
            ) : (
              <EmptyHint
                text={
                  data.signedIn
                    ? `Rate a couple of their ${nouns} to see how they land for you.`
                    : `Sign in and rate their ${nouns} to see how they land for you.`
                }
              />
            )}
          </DashboardSection>
        </Box>

        <DashboardSection
          accent={accent}
          action={
            section.unseen.length ? (
              <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                {section.unseenCount > unseen.length
                  ? `Top ${unseen.length} of ${section.unseenCount}`
                  : "Best reviewed first"}
              </Typography>
            ) : undefined
          }
          title={`Still to ${section.mediaType === "VIDEO_GAME" ? "play" : "watch"}`}
          titleVariant="eyebrow"
        >
          {section.unseen.length ? (
            <Box
              sx={{
                alignContent: "start",
                display: "grid",
                flex: 1,
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  sm: "repeat(4, minmax(0, 1fr))",
                },
              }}
            >
              {unseen.map((entry) => {
                const year = releaseYearLabel(entry.tile.releaseDate);
                return (
                  <Box key={entry.tile.id} sx={{ minWidth: 0, position: "relative" }}>
                    <PosterTile
                      item={entry.tile}
                      meta={year ? [year] : undefined}
                      scoreBadge={
                        entry.consensus != null ? <ScoreBadge score={entry.consensus} /> : undefined
                      }
                    />
                    {entry.watchlisted ? (
                      <Box
                        aria-label="On your watchlist"
                        sx={{
                          alignItems: "center",
                          backdropFilter: "blur(6px)",
                          bgcolor: "rgba(8,8,11,0.6)",
                          borderRadius: 1,
                          color: "primary.main",
                          display: "flex",
                          left: 8,
                          p: 0.35,
                          pointerEvents: "none",
                          position: "absolute",
                          top: 6,
                          zIndex: 3,
                        }}
                        title="On your watchlist"
                      >
                        <BookmarkIcon sx={{ fontSize: 16 }} />
                      </Box>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          ) : (
            <EmptyHint
              text={
                section.titleCount
                  ? `You've ${verb.toLowerCase()} every one of their ${nouns} we know about.`
                  : `No ${nouns} on Medialy yet.`
              }
            />
          )}
        </DashboardSection>

        <Box sx={{ gridColumn: { lg: compact ? "span 2" : "auto" }, minWidth: 0 }}>
          <DashboardSection accent={accent} title="Frequent collaborators" titleVariant="eyebrow">
            {section.collaborators.length ? (
              <Box
                sx={{
                  columnGap: 3,
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    lg: compact ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
                  },
                }}
              >
                {section.collaborators.map((person, index) => (
                  <PersonRow
                    basePath={basePath}
                    key={person.id}
                    last={
                      index === section.collaborators.length - 1 ||
                      (compact &&
                        index === section.collaborators.length - 2 &&
                        section.collaborators.length % 2 === 0)
                    }
                    mediaType={section.mediaType}
                    person={person}
                  />
                ))}
              </Box>
            ) : (
              <EmptyHint text={`No one shares two or more ${nouns} with them on Medialy yet.`} />
            )}
          </DashboardSection>
        </Box>

        <Box sx={{ gridColumn: { lg: "span 2" }, minWidth: 0 }}>
          <DashboardSection
            accent={accent}
            action={
              section.credits.length > CREDITS_SHOWN ? (
                <Button onClick={() => setShowAll((value) => !value)} size="small" sx={panelActionSx}>
                  {showAll ? "Show fewer" : `Show all ${section.credits.length}`}
                </Button>
              ) : undefined
            }
            title={`Every ${titleNoun(section.mediaType, 1)}`}
            titleVariant="eyebrow"
          >
            <Box
              sx={{
                columnGap: 3,
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
              }}
            >
              {credits.map((credit, index) => {
                const year = releaseYearLabel(credit.tile.releaseDate);
                const lastRow =
                  index === credits.length - 1 ||
                  (index === credits.length - 2 && credits.length % 2 === 0);
                return (
                  <Stack
                    direction="row"
                    key={credit.tile.id}
                    sx={{
                      alignItems: "center",
                      // Width only: a responsive `borderBottom` shorthand would
                      // reset the colour inside its media query.
                      borderBottomColor: "divider",
                      borderBottomStyle: "solid",
                      borderBottomWidth: {
                        xs: index === credits.length - 1 ? 0 : "1px",
                        lg: lastRow ? 0 : "1px",
                      },
                      gap: 1.5,
                      py: 0.875,
                      // Dim the content, not the row, so every divider matches.
                      "& > *": {
                        opacity: credit.seen ? 1 : 0.62,
                        transition: "opacity 160ms ease",
                      },
                      "&:hover > *": { opacity: 1 },
                    }}
                  >
                    <MediaThumb item={credit.tile} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: "0.9375rem", lineHeight: 1.35 }}>
                        <MediaTitleLink item={credit.tile} />
                      </Typography>
                      <Typography color="text.secondary" noWrap sx={{ fontSize: "0.875rem" }}>
                        {[year, credit.roles, credit.status].filter(Boolean).join(" · ")}
                      </Typography>
                    </Box>
                    {credit.score != null ? (
                      <Typography
                        sx={{
                          flexShrink: 0,
                          fontFamily: (theme) => theme.typography.statValue.fontFamily,
                          fontSize: "1.125rem",
                          fontWeight: 700,
                          letterSpacing: "-0.03em",
                        }}
                      >
                        {credit.score.toFixed(1)}
                      </Typography>
                    ) : null}
                  </Stack>
                );
              })}
            </Box>
          </DashboardSection>
        </Box>
      </Box>
    </Stack>
  );
}
