"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { MediaType } from "@prisma/client";
import {
  DashboardSection,
  panelActionSx,
} from "@/components/cinematic/CinematicPrimitives";
import {
  MediaTypeTabs,
  SWITCHER_MEDIA_TYPES,
} from "@/components/dashboard/MediaTypeTabs";
import { PosterTile } from "@/components/media/PosterCard";
import { RankedPosterTile } from "@/components/media/RankedPosterTile";
import { ScoreBadge } from "@/components/media/ScoreDisplay";
import { UserAvatar } from "@/components/social/UserAvatar";
import { releaseYearLabel } from "@/lib/date-labels";
import { formatMediaType } from "@/lib/format";
import {
  mediaAccent,
  posterFallback,
  shortMediaTypeLabel,
} from "@/lib/media-ui-helpers";
import { relativeLabel, type ProfileActivity, type ProfileTile } from "@/lib/profile";
import type { ProfileData, ProfileTypeSection } from "@/lib/db/profile";

const NUMBER_FONT = (theme: { typography: { statValue: { fontFamily?: string } } }) =>
  theme.typography.statValue.fontFamily;

export function ProfileClient({ data }: { data: ProfileData }) {
  // One switcher drives every panel that shows titles: the banner, Favorites,
  // Recent activity, Your Top 10 and Your ratings. Start on the first type
  // with a rated title so the marquee never opens empty.
  const [mediaType, setMediaType] = useState<MediaType>(
    () =>
      SWITCHER_MEDIA_TYPES.find((candidate) =>
        data.byType.some(
          (section) => section.mediaType === candidate && section.hero,
        ),
      ) ?? "MOVIE",
  );
  const section = useMemo(
    () =>
      data.byType.find((entry) => entry.mediaType === mediaType) ??
      data.byType[0],
    [data.byType, mediaType],
  );
  const typeAccent = mediaAccent(mediaType);
  const typePlural = shortMediaTypeLabel(mediaType).toLowerCase();
  const typeNoun = typePlural.replace(/s$/, "");

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ alignItems: { sm: "center" }, gap: 1.5, justifyContent: "space-between" }}
      >
        <Typography variant="eyebrow">Profile</Typography>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
          <Button component={Link} href="/settings" variant="outlined">
            Edit profile
          </Button>
          <MediaTypeTabs onChange={setMediaType} value={mediaType} />
        </Stack>
      </Stack>

      <Marquee
        accent={typeAccent}
        counts={data.counts}
        friends={data.friends}
        mediaType={mediaType}
        section={section}
        user={data.user}
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <DashboardSection
          accent={typeAccent}
          title="Favorites"
          titleVariant="eyebrow"
        >
          {section.favorites.length ? (
            <Box
              sx={{
                alignContent: "center",
                display: "grid",
                flex: 1,
                gap: 1.5,
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              }}
            >
              {section.favorites.map((item) => (
                <PosterTile
                  item={item}
                  key={item.id}
                  meta={yearMeta(item)}
                />
              ))}
            </Box>
          ) : (
            <EmptyHint
              text={`Favorite a ${typeNoun} from its detail page to pin it here.`}
            />
          )}
        </DashboardSection>

        <DashboardSection
          accent={typeAccent}
          action={
            <Button
              component={Link}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
              href={`/library?type=${mediaType}`}
              size="small"
              sx={panelActionSx}
            >
              Open Library
            </Button>
          }
          title="Recent activity"
          titleVariant="eyebrow"
        >
          {section.recentActivity.length ? (
            <Stack sx={{ flex: 1, justifyContent: "center" }}>
              {section.recentActivity.map((event, index) => (
                <ActivityRow
                  event={event}
                  key={event.id}
                  last={index === section.recentActivity.length - 1}
                />
              ))}
            </Stack>
          ) : (
            <EmptyHint
              text={`Rate, finish or compare ${typePlural} and they show up here.`}
            />
          )}
        </DashboardSection>

        <Box sx={{ gridColumn: { lg: "span 2" }, minWidth: 0 }}>
          <DashboardSection
            accent={typeAccent}
            action={
              <Button
                component={Link}
                endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                href={`/compare?type=${mediaType}`}
                size="small"
                sx={panelActionSx}
              >
                Keep ranking
              </Button>
            }
            title="Your Top 10"
            titleVariant="eyebrow"
          >
            {section.topItems.length ? (
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    sm: "repeat(5, minmax(0, 1fr))",
                    lg: "repeat(10, minmax(0, 1fr))",
                  },
                  mt: 0.5,
                }}
              >
                {section.topItems.map((entry, index) => (
                  <RankedPosterTile
                    item={entry.media}
                    key={entry.media.id}
                    rank={index + 1}
                    score={entry.score}
                  />
                ))}
              </Box>
            ) : (
              <EmptyHint
                text={`Rate ${typePlural} to build your ranking.`}
              />
            )}
          </DashboardSection>
        </Box>

        <DashboardSection
          accent={typeAccent}
          action={
            <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
              {section.ratings.count} rated{" "}
              {shortMediaTypeLabel(mediaType).toLowerCase()}
            </Typography>
          }
          title="Your ratings"
          titleVariant="eyebrow"
        >
          {section.ratings.count ? (
            <RatingHistogram accent={typeAccent} ratings={section.ratings} />
          ) : (
            <EmptyHint text="Rate titles to see how your scores spread." />
          )}
        </DashboardSection>

        <DashboardSection
          action={
            <Button
              component={Link}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
              href="/insights"
              size="small"
              sx={panelActionSx}
            >
              Open Insights
            </Button>
          }
          title="Taste"
          titleVariant="eyebrow"
        >
          <TastePanel taste={data.taste} />
        </DashboardSection>

        <DashboardSection
          action={
            <Button
              component={Link}
              endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
              href="/friends"
              size="small"
              sx={panelActionSx}
            >
              Open Friends
            </Button>
          }
          title="Friends"
          titleVariant="eyebrow"
        >
          <FriendsPanel friends={data.friends} />
        </DashboardSection>

        <DashboardSection
          action={
            <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
              {data.notes.total} {data.notes.total === 1 ? "note" : "notes"}
            </Typography>
          }
          title="Recent notes"
          titleVariant="eyebrow"
        >
          {data.notes.recent.length ? (
            <Stack sx={{ flex: 1, justifyContent: "center" }}>
              {data.notes.recent.map((note, index) => (
                <Stack
                  direction="row"
                  key={note.id}
                  sx={{
                    alignItems: "flex-start",
                    borderBottom:
                      index === data.notes.recent.length - 1 ? 0 : "1px solid",
                    borderColor: "divider",
                    gap: 1.5,
                    py: 1,
                  }}
                >
                  <Thumb item={note.media} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.875rem", lineHeight: 1.4 }}>
                      <MediaLink item={note.media} />{" "}
                      <Box component="span" sx={{ color: "text.secondary" }}>
                        · {relativeLabel(note.updatedAt)}
                      </Box>
                    </Typography>
                    <Typography
                      color="text.secondary"
                      sx={{
                        display: "-webkit-box",
                        fontSize: "0.875rem",
                        overflow: "hidden",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 2,
                      }}
                    >
                      {note.body}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          ) : (
            <EmptyHint text="Notes you leave on titles collect here." />
          )}
        </DashboardSection>
      </Box>
    </Stack>
  );
}

/**
 * The backdrop marquee. The top-ranked title's poster is painted twice: zoomed
 * and blurred behind everything as a colour wash, and sharp at its real 2:3
 * shape on the right — so a portrait poster never gets stretched into a
 * banner. This is the page's one featured glow.
 */
function Marquee({
  accent,
  counts,
  friends,
  mediaType,
  section,
  user,
}: {
  accent: string;
  counts: ProfileData["counts"];
  friends: ProfileData["friends"];
  mediaType: MediaType;
  section: ProfileTypeSection;
  user: ProfileData["user"];
}) {
  const hero = section.hero;
  const wash = hero?.media.posterUrl
    ? `url(${hero.media.posterUrl})`
    : posterFallback(mediaType);
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "border.default",
        borderRadius: `${12}px`,
        boxShadow: `0 24px 60px rgba(0, 0, 0, 0.45), 0 0 48px -12px ${alpha(accent, 0.45)}, 0 1px 0 ${alpha("#FFFFFF", 0.04)} inset`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/*
        The poster painted twice: soft and zoomed here as the backdrop, sharp
        at its real 2:3 shape on the right. The blur is light enough that the
        art still reads as art, and the overlay only darkens where text sits.
      */}
      <Box
        aria-hidden
        sx={{
          backgroundImage: wash,
          backgroundPosition: "center 25%",
          backgroundSize: "cover",
          filter: "blur(18px) saturate(1.25)",
          inset: -40,
          position: "absolute",
          transform: "scale(1.12)",
        }}
      />
      <Box
        aria-hidden
        sx={{
          background:
            "linear-gradient(90deg, rgba(10,8,16,0.9) 0%, rgba(10,8,16,0.72) 40%, rgba(10,8,16,0.28) 72%, rgba(10,8,16,0.12) 100%), linear-gradient(180deg, rgba(10,8,16,0.05) 0%, rgba(10,8,16,0.45) 100%)",
          inset: 0,
          position: "absolute",
        }}
      />
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={{
          alignItems: { md: "flex-end" },
          gap: 3,
          justifyContent: "space-between",
          minHeight: { md: 320 },
          p: { xs: 2, md: 3.5 },
          position: "relative",
        }}
      >
        <Stack direction="row" sx={{ alignItems: "flex-end", gap: 2.5, minWidth: 0 }}>
          <UserAvatar
            avatarColor={user.avatarColor}
            displayName={user.displayName}
            image={user.image}
            size={72}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              component="h1"
              sx={{
                fontFamily: (theme) => theme.typography.h2.fontFamily,
                fontSize: { xs: "2rem", md: "2.75rem" },
                fontWeight: 700,
                letterSpacing: "-0.035em",
                lineHeight: 1.02,
              }}
            >
              {user.displayName}
            </Typography>
            <Typography
              sx={{ color: alpha("#F4EEFA", 0.72), fontSize: "0.875rem", mt: 0.75 }}
            >
              On Medialy since {user.memberSince} ·{" "}
              <FriendsLink>{friends.followingCount} following</FriendsLink> ·{" "}
              <FriendsLink>{friends.followersCount} followers</FriendsLink>
            </Typography>
            <Stack
              direction="row"
              sx={{ alignItems: "center", flexWrap: "wrap", gap: 3, mt: 2.5 }}
            >
              <Count label="Watched" value={counts.watched} />
              <CountDivider />
              <Count label="This year" value={counts.thisYear} />
              <CountDivider />
              <Count label="Rated" value={counts.rated} />
              <CountDivider />
              <Count label="Ranked" value={counts.ranked} />
            </Stack>
          </Box>
        </Stack>

        {hero ? (
          <Stack
            direction="row"
            sx={{ alignItems: "flex-end", flexShrink: 0, gap: 2 }}
          >
            <Box sx={{ pb: 0.75, textAlign: "right" }}>
              <Typography variant="eyebrow" sx={{ color: accent, display: "block" }}>
                Your №1 {shortMediaTypeLabel(mediaType).replace(/s$/, "").toLowerCase()}
              </Typography>
              <Typography
                sx={{
                  fontFamily: (theme) => theme.typography.h5.fontFamily,
                  fontSize: "1.125rem",
                  fontWeight: 650,
                  letterSpacing: "-0.02em",
                  mt: 0.5,
                }}
              >
                {hero.media.title}
              </Typography>
            </Box>
            <Box sx={{ boxShadow: "0 16px 40px rgba(0, 0, 0, 0.55)", width: 148 }}>
              <PosterTile
                item={hero.media}
                meta={yearMeta(hero.media)}
                scoreBadge={
                  hero.score != null ? <ScoreBadge score={hero.score} /> : undefined
                }
              />
            </Box>
          </Stack>
        ) : (
          <Typography
            sx={{ color: alpha("#F4EEFA", 0.72), fontSize: "0.875rem", maxWidth: 260 }}
          >
            Rate a few {formatMediaType(mediaType).toLowerCase()} titles and
            your №1 takes over this banner.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function FriendsLink({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component={Link}
      href="/friends"
      sx={{
        color: "inherit",
        fontWeight: 600,
        textDecoration: "none",
        "&:hover": { color: "text.primary" },
      }}
    >
      {children}
    </Box>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <Box>
      <Typography
        sx={{
          fontFamily: NUMBER_FONT,
          fontSize: "1.5rem",
          fontWeight: 700,
          letterSpacing: "-0.035em",
          lineHeight: 1,
        }}
      >
        {value.toLocaleString()}
      </Typography>
      <Typography variant="eyebrow" sx={{ display: "block", mt: 0.5 }}>
        {label}
      </Typography>
    </Box>
  );
}

function CountDivider() {
  return (
    <Box
      sx={{
        bgcolor: alpha("#FFFFFF", 0.16),
        display: { xs: "none", sm: "block" },
        height: 30,
        width: "1px",
      }}
    />
  );
}

function yearMeta(item: ProfileTile): string[] | undefined {
  const year = releaseYearLabel(item.releaseDate);
  return year ? [year] : undefined;
}

function Thumb({ item }: { item: ProfileTile }) {
  return (
    <Box
      component={Link}
      href={`/media/${item.id}`}
      sx={{
        backgroundImage: item.posterUrl
          ? `url(${item.posterUrl})`
          : posterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: "1px solid",
        borderColor: "border.subtle",
        borderLeft: `2px solid ${mediaAccent(item.mediaType)}`,
        borderRadius: "6px",
        display: "block",
        flexShrink: 0,
        height: 54,
        width: 36,
      }}
    />
  );
}

function MediaLink({ item }: { item: ProfileTile }) {
  return (
    <Box
      component={Link}
      href={`/media/${item.id}`}
      sx={{
        color: "inherit",
        fontWeight: 600,
        textDecoration: "none",
        "&:hover": { color: "primary.main" },
      }}
    >
      {item.title}
    </Box>
  );
}

function ActivityRow({
  event,
  last,
}: {
  event: ProfileActivity;
  last: boolean;
}) {
  const thumb = event.kind === "compared" ? event.winner : event.media;
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        borderBottom: last ? 0 : "1px solid",
        borderColor: "divider",
        gap: 1.5,
        py: 0.875,
      }}
    >
      <Thumb item={thumb} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: "0.875rem", lineHeight: 1.4 }}>
          {event.kind === "rated" ? (
            <>
              Rated <MediaLink item={event.media} /> ·{" "}
              <strong>{event.rating.toFixed(1)}</strong>
            </>
          ) : event.kind === "completed" ? (
            <>
              Finished <MediaLink item={event.media} />
            </>
          ) : (
            <>
              Ranked <MediaLink item={event.winner} /> above{" "}
              <MediaLink item={event.loser} />
            </>
          )}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          {event.kind === "compared"
            ? event.lens
              ? `Compared on ${event.lens}`
              : "Compared"
            : event.statusLabel}
          {event.kind !== "compared" && event.statusLabel ? " · " : ""}
          {event.kind === "compared" ? " · " : ""}
          {relativeLabel(event.occurredAt)}
        </Typography>
      </Box>
    </Stack>
  );
}

function RatingHistogram({
  accent,
  ratings,
}: {
  accent: string;
  ratings: ProfileTypeSection["ratings"];
}) {
  const max = Math.max(1, ...ratings.buckets);
  const modeIndex = ratings.buckets.indexOf(max);
  return (
    <Stack sx={{ flex: 1 }}>
      <Stack direction="row" sx={{ alignItems: "baseline", gap: 1.25, mb: 1.75 }}>
        <Typography
          sx={{
            fontFamily: NUMBER_FONT,
            fontSize: "2.125rem",
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 1,
          }}
        >
          {ratings.average?.toFixed(1)}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          average
          {ratings.consensusDelta != null ? (
            <>
              {" "}
              · you rate{" "}
              <Box component="strong" sx={{ color: "text.primary" }}>
                {Math.abs(ratings.consensusDelta).toFixed(1)}{" "}
                {ratings.consensusDelta >= 0 ? "above" : "below"}
              </Box>{" "}
              the Medialy consensus
            </>
          ) : null}
        </Typography>
      </Stack>
      <Stack
        direction="row"
        sx={{ alignItems: "flex-end", flex: 1, gap: 0.75, minHeight: 120 }}
      >
        {ratings.buckets.map((count, index) => (
          <Box
            key={index}
            sx={{
              bgcolor: index === modeIndex ? accent : alpha(accent, 0.55),
              borderRadius: "4px 4px 0 0",
              flex: 1,
              height: `${Math.max(2, (count / max) * 100)}%`,
              minHeight: 2,
            }}
            title={`${count} rated ${index + 1}`}
          />
        ))}
      </Stack>
      <Stack
        direction="row"
        sx={{
          borderTop: "1px solid",
          borderColor: "divider",
          gap: 0.75,
          mt: 1,
          pt: 1,
        }}
      >
        {ratings.buckets.map((_, index) => (
          <Typography
            key={index}
            sx={{
              color: index === modeIndex ? "text.primary" : "text.secondary",
              flex: 1,
              fontSize: "0.8125rem",
              fontWeight: 550,
              textAlign: "center",
            }}
          >
            {index + 1}
          </Typography>
        ))}
      </Stack>
    </Stack>
  );
}

function TastePanel({ taste }: { taste: ProfileData["taste"] }) {
  const leading = taste.lenses.slice(0, 2).map((lens) => lens.label);
  const strongest = taste.lenses[0]?.count ?? 1;
  if (!taste.totalTracked) {
    return <EmptyHint text="Track and compare titles to map your taste." />;
  }
  return (
    <Box
      sx={{
        alignContent: "start",
        display: "grid",
        flex: 1,
        gap: 3,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
      }}
    >
      <Stack spacing={1.25}>
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          {leading.length ? (
            <>
              You judge through{" "}
              <Box component="strong" sx={{ color: "text.primary" }}>
                {leading.join(" and ")}
              </Box>{" "}
              most.
            </>
          ) : (
            "Compare titles through a lens (Story, Visuals…) to see how you judge."
          )}
        </Typography>
        {taste.lenses.slice(0, 5).map((lens, index) => (
          <Box key={lens.label}>
            <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.4 }}>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
                {lens.label}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
                {lens.share}%
              </Typography>
            </Stack>
            <Box sx={{ bgcolor: alpha("#F4EEFA", 0.08), borderRadius: 3, height: 6 }}>
              <Box
                sx={{
                  bgcolor: index === 0 ? "text.secondary" : alpha("#F4EEFA", 0.36),
                  borderRadius: 3,
                  height: "100%",
                  width: `${Math.max(4, (lens.count / strongest) * 100)}%`,
                }}
              />
            </Box>
          </Box>
        ))}
      </Stack>
      <Stack spacing={1.25}>
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          Your library is{" "}
          <Box component="strong" sx={{ color: "text.primary" }}>
            {taste.totalTracked.toLocaleString()} titles
          </Box>
          {taste.mediaMix.length > 1
            ? ` across ${taste.mediaMix.length} types.`
            : "."}
        </Typography>
        <Stack direction="row" sx={{ borderRadius: 4, gap: "2px", height: 8, overflow: "hidden" }}>
          {taste.mediaMix.map((entry) => (
            <Box
              key={entry.mediaType}
              sx={{ bgcolor: mediaAccent(entry.mediaType), width: `${entry.share}%` }}
            />
          ))}
        </Stack>
        <Stack spacing={1}>
          {taste.mediaMix.map((entry) => (
            <Stack
              direction="row"
              key={entry.mediaType}
              sx={{ alignItems: "center", fontSize: "0.875rem", fontWeight: 600, gap: 1 }}
            >
              <Box
                sx={{
                  bgcolor: mediaAccent(entry.mediaType),
                  borderRadius: "3px",
                  height: 9,
                  width: 9,
                }}
              />
              <Box sx={{ flex: 1 }}>{shortMediaTypeLabel(entry.mediaType)}</Box>
              <Box sx={{ color: "text.secondary" }}>
                {entry.count.toLocaleString()} · {entry.share}%
              </Box>
            </Stack>
          ))}
        </Stack>
        {taste.topGenres.length ? (
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 0.5 }}>
            {taste.topGenres.map((genre) => (
              <Chip key={genre} label={genre} size="small" variant="outlined" />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}

function FriendsPanel({ friends }: { friends: ProfileData["friends"] }) {
  if (!friends.followingCount && !friends.followersCount) {
    return <EmptyHint text="Follow other Medialy users to see taste overlap." />;
  }
  return (
    <Stack spacing={1.75} sx={{ flex: 1, justifyContent: "center" }}>
      {friends.topMatch ? (
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            bgcolor: "surface.1",
            border: "1px solid",
            borderColor: "border.subtle",
            borderRadius: "12px",
            gap: 1.5,
            p: 1.5,
          }}
        >
          <UserAvatar
            avatarColor={friends.topMatch.avatarColor}
            displayName={friends.topMatch.displayName}
            image={friends.topMatch.image}
            size={44}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" sx={{ alignItems: "baseline", gap: 1 }}>
              <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                {friends.topMatch.displayName}
              </Typography>
              <Typography
                sx={{ color: "success.main", fontSize: "0.875rem", fontWeight: 600 }}
              >
                {friends.topMatch.compatibilityScore}% match
              </Typography>
            </Stack>
            <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
              Your closest taste match · {friends.topMatch.overlapCount}{" "}
              {friends.topMatch.overlapCount === 1 ? "title" : "titles"} in common
            </Typography>
          </Box>
          <Button
            component={Link}
            href={`/u/${friends.topMatch.userId}`}
            size="small"
            variant="outlined"
          >
            View profile
          </Button>
        </Stack>
      ) : (
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          Rate a few of the same titles as people you follow to find your
          closest match.
        </Typography>
      )}
      <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
        <Stack direction="row" sx={{ gap: 1 }}>
          {friends.following.map((profile) => (
            <Box
              component={Link}
              href={`/u/${profile.id}`}
              key={profile.id}
              sx={{ display: "block", lineHeight: 0 }}
              title={profile.displayName}
            >
              <UserAvatar
                avatarColor={profile.avatarColor}
                displayName={profile.displayName}
                image={profile.image}
                size={32}
              />
            </Box>
          ))}
          {friends.followingCount > friends.following.length ? (
            <Box
              component={Link}
              href="/friends"
              sx={{
                alignItems: "center",
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.32)}`,
                borderRadius: "50%",
                color: "primary.main",
                display: "flex",
                fontSize: "0.8125rem",
                fontWeight: 600,
                height: 32,
                justifyContent: "center",
                textDecoration: "none",
                width: 32,
              }}
            >
              +{friends.followingCount - friends.following.length}
            </Box>
          ) : null}
        </Stack>
        <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          Following {friends.followingCount}{" "}
          {friends.followingCount === 1 ? "person" : "people"} ·{" "}
          {friends.followersCount} follow you
        </Typography>
      </Stack>
    </Stack>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <Box
      sx={{
        alignItems: "center",
        color: "text.secondary",
        display: "flex",
        flex: 1,
        fontSize: "0.875rem",
        justifyContent: "center",
        minHeight: 120,
        px: 2,
        textAlign: "center",
      }}
    >
      {text}
    </Box>
  );
}
