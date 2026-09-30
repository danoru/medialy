"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import type { MediaType } from "@prisma/client";
import {
  DashboardSection,
  panelActionSx,
} from "@/components/cinematic/CinematicPrimitives";
import {
  MediaTypeTabs,
  SWITCHER_MEDIA_TYPES,
} from "@/components/dashboard/MediaTypeTabs";
import {
  BackdropMarquee,
  MARQUEE_MUTED,
  MarqueeFeature,
  MarqueeTitle,
} from "@/components/shared/BackdropMarquee";
import { EmptyHint, StatCount, StatCountDivider } from "@/components/shared/StatCount";
import type { PeopleHubData, PeopleHubSection } from "@/lib/db/people";
import { releaseYearLabel } from "@/lib/date-labels";
import { mediaAccent } from "@/lib/media-ui-helpers";
import { titleNoun } from "@/lib/people";
import { statusLabel, unexperiencedWord } from "@/lib/status-labels";
import {
  formatDelta,
  PanelFilter,
  PeopleSearchField,
  PersonRow,
} from "./PersonParts";

export function PeopleClient({
  basePath,
  data,
}: {
  /** Where person pages live — `/people`, or the design study's own route. */
  basePath: string;
  data: PeopleHubData;
}) {
  // Open on the first type with someone to spotlight, like the profile opens
  // on the first type with a rated title.
  const [mediaType, setMediaType] = useState<MediaType>(
    () =>
      SWITCHER_MEDIA_TYPES.find((type) =>
        data.byType.some((section) => section.mediaType === type && section.spotlight),
      ) ?? "MOVIE",
  );
  const section = useMemo(
    () => data.byType.find((entry) => entry.mediaType === mediaType) ?? data.byType[0],
    [data.byType, mediaType],
  );
  const accent = mediaAccent(mediaType);

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ alignItems: { sm: "center" }, gap: 1.5, justifyContent: "space-between" }}
      >
        <Typography variant="eyebrow">People</Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ alignItems: { xs: "stretch", sm: "center" }, gap: 1.5, minWidth: 0 }}
        >
          <PeopleSearchField action={basePath} defaultValue={data.query} />
          <MediaTypeTabs onChange={setMediaType} value={mediaType} />
        </Stack>
      </Stack>

      {data.results ? (
        <DashboardSection
          action={
            <Button component={Link} href={basePath} size="small" sx={panelActionSx}>
              Clear search
            </Button>
          }
          title={`${data.results.length === 30 ? "Top 30" : data.results.length} ${
            data.results.length === 1 ? "match" : "matches"
          } for “${data.query}”`}
          titleVariant="eyebrow"
        >
          {data.results.length ? (
            <Box
              sx={{
                columnGap: 3,
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
              }}
            >
              {data.results.map((person, index) => (
                <PersonRow
                  basePath={basePath}
                  key={person.id}
                  last={
                    index === data.results!.length - 1 ||
                    (index === data.results!.length - 2 && data.results!.length % 2 === 0)
                  }
                  person={person}
                  trailing="types"
                />
              ))}
            </Box>
          ) : (
            <EmptyHint text="No one in the catalog goes by that name. Try a surname, or end with * to match the start of a name." />
          )}
        </DashboardSection>
      ) : null}

      <Spotlight
        accent={accent}
        basePath={basePath}
        mediaType={mediaType}
        section={section}
        signedIn={data.signedIn}
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <YourPeople
          accent={accent}
          basePath={basePath}
          key={`people-${mediaType}`}
          section={section}
          signedIn={data.signedIn}
        />

        <DashboardSection
          accent={accent}
          action={
            section.unfinished.length ? (
              <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                People you rate above your usual
              </Typography>
            ) : undefined
          }
          title="Unfinished business"
          titleVariant="eyebrow"
        >
          {section.unfinished.length ? (
            <Stack sx={{ flex: 1 }}>
              {section.unfinished.map((person, index) => (
                <PersonRow
                  basePath={basePath}
                  key={person.id}
                  last={index === section.unfinished.length - 1}
                  mediaType={mediaType}
                  person={person}
                />
              ))}
            </Stack>
          ) : (
            <EmptyHint
              text={
                !data.signedIn
                  ? "Sign in and rate a few titles to see who you've been missing."
                  : section.groups.some((group) => group.people.length)
                    ? `You're caught up: no one you rate well above your usual has ${titleNoun(mediaType)} you haven't ${statusLabel("COMPLETED", mediaType).toLowerCase()}.`
                    : `Once you rate a few ${titleNoun(mediaType)} by the same people, the ones you've missed show up here.`
              }
            />
          )}
        </DashboardSection>

        <Box sx={{ gridColumn: { lg: "span 2" }, minWidth: 0 }}>
          <DashboardSection
            accent={accent}
            title={`Behind what you've ${statusLabel("COMPLETED", mediaType).toLowerCase()} lately`}
            titleVariant="eyebrow"
          >
            {section.recent.length ? (
              <Box
                sx={{
                  columnGap: 3,
                  display: "grid",
                  gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
                }}
              >
                {section.recent.map((person, index) => (
                  <PersonRow
                    basePath={basePath}
                    key={person.id}
                    last={
                      index === section.recent.length - 1 ||
                      (index === section.recent.length - 2 && section.recent.length % 2 === 0)
                    }
                    mediaType={mediaType}
                    person={person}
                  />
                ))}
              </Box>
            ) : (
              <EmptyHint
                text={`Mark ${titleNoun(mediaType)} as ${statusLabel("COMPLETED", mediaType).toLowerCase()} with a date and the people behind them collect here.`}
              />
            )}
          </DashboardSection>
        </Box>
      </Box>
    </Stack>
  );
}

/**
 * The marquee: the person you trust most for this type, painted with the
 * poster of their title you rate highest.
 */
function Spotlight({
  accent,
  basePath,
  mediaType,
  section,
  signedIn,
}: {
  accent: string;
  basePath: string;
  mediaType: MediaType;
  section: PeopleHubSection;
  signedIn: boolean;
}) {
  const spotlight = section.spotlight;
  if (!spotlight) {
    return (
      <BackdropMarquee accent={accent} mediaType={mediaType} posterUrl={null}>
        <Box sx={{ maxWidth: 560 }}>
          <MarqueeTitle>The people behind what you love</MarqueeTitle>
          <Typography sx={{ color: MARQUEE_MUTED, fontSize: "0.9375rem", mt: 1.25 }}>
            {signedIn
              ? `Rate a few ${titleNoun(mediaType)} and the directors, cast and studios you trust most take over this banner.`
              : "Sign in and rate a few titles to see whose work you rate highest."}
          </Typography>
        </Box>
      </BackdropMarquee>
    );
  }
  const { person, feature } = spotlight;
  const role = spotlight.group.replace(/s$/, "").toLowerCase();
  const year = releaseYearLabel(feature.tile.releaseDate);
  return (
    <BackdropMarquee
      accent={accent}
      aside={
        <MarqueeFeature
          accent={accent}
          eyebrow="Your favourite"
          item={feature.tile}
          meta={year ? [year] : undefined}
          score={feature.score}
        />
      }
      mediaType={mediaType}
      posterUrl={feature.tile.posterUrl}
    >
      <Stack direction="row" sx={{ alignItems: "flex-end", gap: 2.5, minWidth: 0 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="eyebrow" sx={{ color: accent, display: "block", mb: 0.75 }}>
            Your most trusted {role === "cast" ? "cast member" : role}
          </Typography>
          <MarqueeTitle>{person.name}</MarqueeTitle>
          <Typography sx={{ color: MARQUEE_MUTED, fontSize: "0.875rem", mt: 0.75 }}>
            {person.roles} · {person.titleCount}{" "}
            {titleNoun(mediaType, person.titleCount)} on Medialy ·{" "}
            <Box
              component={Link}
              href={`${basePath}/${person.id}`}
              sx={{
                color: "primary.main",
                fontWeight: 600,
                textDecoration: "none",
                "&:hover": { color: "primary.light" },
              }}
            >
              See everything
            </Box>
          </Typography>
          <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 3, mt: 2.5 }}>
            <StatCount label="Your average" value={person.average?.toFixed(1) ?? "—"} />
            <StatCountDivider />
            <StatCount
              label="Vs your usual"
              value={person.delta != null ? formatDelta(person.delta) : "—"}
            />
            <StatCountDivider />
            <StatCount label="Rated" value={person.ratedCount} />
            <StatCountDivider />
            <StatCount
              label={unexperiencedWord(mediaType)}
              value={person.titleCount - person.seenCount}
            />
          </Stack>
        </Box>
      </Stack>
    </BackdropMarquee>
  );
}

function YourPeople({
  accent,
  basePath,
  section,
  signedIn,
}: {
  accent: string;
  basePath: string;
  section: PeopleHubSection;
  signedIn: boolean;
}) {
  // Start on the first role group with anyone in it (games often have
  // developers rated before publishers, film the reverse is rare).
  const [groupKey, setGroupKey] = useState(
    () => section.groups.find((group) => group.people.length)?.key ?? section.groups[0]?.key ?? "",
  );
  const group = section.groups.find((entry) => entry.key === groupKey) ?? section.groups[0];
  return (
    <DashboardSection
      accent={accent}
      action={
        <PanelFilter
          onChange={setGroupKey}
          options={section.groups.map((entry) => ({ key: entry.key, label: entry.label }))}
          value={groupKey}
        />
      }
      title="Your people"
      titleVariant="eyebrow"
    >
      {group?.people.length ? (
        <Stack sx={{ flex: 1 }}>
          {group.people.map((person, index) => (
            <PersonRow
              basePath={basePath}
              key={person.id}
              last={index === group.people.length - 1}
              mediaType={section.mediaType}
              person={person}
            />
          ))}
        </Stack>
      ) : (
        <EmptyHint
          text={
            signedIn
              ? `Rate two or more ${titleNoun(section.mediaType)} by the same ${
                  group?.label.toLowerCase().replace(/s$/, "") ?? "person"
                } to rank them here.`
              : "Sign in and rate titles to rank the people behind them."
          }
        />
      )}
    </DashboardSection>
  );
}
