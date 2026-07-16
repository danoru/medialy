import type { ReactNode } from "react";
import { Box, Card, CardContent, Stack, Tab, Tabs, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { MediaType } from "@prisma/client";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { formatMediaType } from "@/lib/format";
import {
  ACCENTS,
  HEADING_FONT,
  mediaAccent,
  mediaTypeTabIndicatorColor,
  mediaTypeTabSx,
} from "@/lib/media-ui-helpers";
import {
  CanonCard,
  type CanonCardData,
  type CanonRankStyle,
} from "@/components/canon/CanonCard";
import { CanonHero } from "@/components/canon/CanonHero";
import { CanonLeadCard } from "@/components/canon/CanonLeadCard";
import { PageAccentBackground } from "@/components/shared/PageAccentBackground";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import { getCanonData, type CanonGenreShelf, type CanonItem } from "@/lib/db/canon";

export const dynamic = "force-dynamic";
export const metadata = { title: "The Canon" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Runners shown after the №1 hero on the overview (hero + 9 = a top-10 marquee). */
const RUNNERS_SHOWN = 9;
/** Genre shelves rendered by default; the rest live behind the genre picker. */
const SHELVES_SHOWN = 6;
/** Cards after the lead in a genre shelf row. */
const SHELF_ROW_SIZE = 6;

const MEDIA_NOUN: Record<MediaType, string> = {
  MOVIE: "Films",
  TV_SHOW: "Series",
  VIDEO_GAME: "Games",
  BOOK: "Books",
  BOARD_GAME: "Board Games",
  MUSIC: "Music",
  MUSICAL: "Musicals",
};

const TYPE_DEK: Partial<Record<MediaType, string>> = {
  MOVIE: "The definitive films, ranked by acclaim — overall and by genre.",
  TV_SHOW: "The defining series, ranked by acclaim — overall and by genre.",
  VIDEO_GAME: "The essential games, ranked by acclaim — overall and by genre.",
};

export default async function CanonPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedType = stringParam(params.type);
  const selectedType = isVisibleMediaType(requestedType)
    ? requestedType
    : VISIBLE_MEDIA_TYPES[0];
  const requestedGenre = stringParam(params.genre) ?? null;
  const requestedSubgenre = stringParam(params.subgenre) ?? null;
  const showAll = stringParam(params.all) === "1";

  const data = await getCanonData({
    type: selectedType,
    genre: requestedGenre,
    subgenre: requestedSubgenre,
  });

  const accent = mediaAccent(selectedType);
  const noun = MEDIA_NOUN[selectedType];

  return (
    <Box sx={{ mx: "auto" }}>
      <PageAccentBackground mediaType={selectedType} />
      <Stack spacing={4}>
        <Box sx={{ borderBottom: "1px solid", borderBottomColor: "border.subtle" }}>
          <Tabs
            allowScrollButtonsMobile
            scrollButtons="auto"
            value={selectedType}
            variant="scrollable"
            slotProps={{
              indicator: {
                sx: { backgroundColor: mediaTypeTabIndicatorColor(selectedType) },
              },
            }}
            sx={{
              minHeight: 40,
              "& .MuiTab-root": {
                fontSize: "0.875rem",
                fontWeight: 550,
                minHeight: 40,
                px: 1.5,
                textTransform: "none",
              },
            }}
          >
            {VISIBLE_MEDIA_TYPES.map((type) => (
              <Tab
                component="a"
                href={canonHref(type)}
                key={type}
                label={formatMediaType(type)}
                sx={mediaTypeTabSx(type)}
                value={type}
              />
            ))}
          </Tabs>
        </Box>

        {data.mode === "genre" ? (
          <GenreView
            accent={accent}
            genre={data.genre}
            items={data.items}
            noun={noun}
            subgenre={data.subgenre}
            subgenres={data.subgenres}
            type={selectedType}
          />
        ) : showAll ? (
          <AllView
            accent={accent}
            dek={TYPE_DEK[selectedType] ?? TYPE_DEK.MOVIE!}
            noun={noun}
            overall={data.overall}
            type={selectedType}
          />
        ) : (
          <OverviewView
            accent={accent}
            dek={TYPE_DEK[selectedType] ?? TYPE_DEK.MOVIE!}
            noun={noun}
            overall={data.overall}
            shelves={data.shelves}
            type={selectedType}
          />
        )}
      </Stack>
    </Box>
  );
}

function OverviewView({
  accent,
  dek,
  noun,
  overall,
  shelves,
  type,
}: {
  accent: string;
  dek: string;
  noun: string;
  overall: CanonItem[];
  shelves: CanonGenreShelf[];
  type: MediaType;
}) {
  if (overall.length === 0) {
    return (
      <Stack spacing={3}>
        <CanonHeader accent={accent} eyebrow="The Canon" title={`Top ${noun}`} dek={dek} />
        <EmptyState accent={accent} />
      </Stack>
    );
  }

  const [lead, ...rest] = overall;
  const runners = rest.slice(0, RUNNERS_SHOWN);
  const shownShelves = shelves.slice(0, SHELVES_SHOWN);
  const activeGenres = new Set(shownShelves.map((shelf) => shelf.genre));

  return (
    <Stack spacing={5}>
      <Stack spacing={3}>
        <CanonHero
          accent={accent}
          dek={dek}
          eyebrow="The Canon"
          item={toCardData(lead, 1)}
          title={`Top ${noun}`}
        />

        {runners.length > 0 ? (
          <Box>
            <RunnersGrid items={runners} startRank={2} />
            {overall.length > runners.length + 1 ? (
              <Box sx={{ mt: 2 }}>
                <ViewAllLink href={canonHref(type, null, null, true)}>
                  View all {overall.length}
                </ViewAllLink>
              </Box>
            ) : null}
          </Box>
        ) : null}
      </Stack>

      {shelves.length > 0 ? (
        <Stack spacing={3}>
          <Box
            sx={{
              borderTop: "1px solid",
              borderTopColor: "border.subtle",
              pt: 3.5,
            }}
          >
            <Typography
              sx={{
                fontFamily: HEADING_FONT,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                mb: 1.5,
              }}
              variant="h6"
            >
              By genre
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {shelves.map((shelf) => (
                <GenreChip
                  active={activeGenres.has(shelf.genre)}
                  href={canonHref(type, shelf.genre)}
                  key={shelf.genre}
                  label={shelf.genre}
                />
              ))}
            </Box>
          </Box>

          <Stack spacing={5.5}>
            {shownShelves.map((shelf) => (
              <GenreShelf accent={accent} key={shelf.genre} shelf={shelf} type={type} />
            ))}
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}

function AllView({
  accent,
  dek,
  noun,
  overall,
  type,
}: {
  accent: string;
  dek: string;
  noun: string;
  overall: CanonItem[];
  type: MediaType;
}) {
  if (overall.length === 0) {
    return (
      <Stack spacing={3}>
        <CanonHeader accent={accent} eyebrow="The Canon" title={`Top ${noun}`} dek={dek} />
        <EmptyState accent={accent} />
      </Stack>
    );
  }

  const [lead, ...rest] = overall;

  return (
    <Stack spacing={3}>
      <BackLink accent={accent} href={canonHref(type)} label="Overview" />
      <CanonHero
        accent={accent}
        dek={dek}
        eyebrow="The Canon"
        item={toCardData(lead, 1)}
        title={`Top ${noun}`}
      />
      {rest.length > 0 ? (
        <CanonGallery items={rest} startRank={2} />
      ) : null}
    </Stack>
  );
}

function GenreView({
  accent,
  genre,
  items,
  noun,
  subgenre,
  subgenres,
  type,
}: {
  accent: string;
  genre: string;
  items: CanonItem[];
  noun: string;
  subgenre: string | null;
  subgenres: string[];
  type: MediaType;
}) {
  const [lead, ...rest] = items;

  return (
    <Stack spacing={3}>
      <BackLink accent={accent} href={canonHref(type)} label="All genres" />

      {lead ? (
        <CanonHero
          accent={accent}
          dek={`The highest-rated ${genre.toLowerCase()} ${noun.toLowerCase()}, by acclaim.`}
          eyebrow="The Canon"
          item={toCardData(lead, 1)}
          title={`Top ${genre} ${noun}`}
        />
      ) : (
        <CanonHeader
          accent={accent}
          eyebrow="The Canon"
          title={`Top ${genre} ${noun}`}
          dek={`The highest-rated ${genre.toLowerCase()} ${noun.toLowerCase()}, by acclaim.`}
        />
      )}

      {subgenres.length > 0 ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          <GenreChip
            active={subgenre == null}
            href={canonHref(type, genre)}
            label="All"
          />
          {subgenres.map((name) => (
            <GenreChip
              active={subgenre === name}
              href={canonHref(type, genre, name)}
              key={name}
              label={name}
            />
          ))}
        </Box>
      ) : null}

      {items.length === 0 ? (
        <EmptyState accent={accent} />
      ) : rest.length > 0 ? (
        <CanonGallery items={rest} startRank={2} />
      ) : null}
    </Stack>
  );
}

function CanonHeader({
  accent,
  dek,
  eyebrow,
  title,
}: {
  accent: string;
  dek: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <Box>
      <Typography
        sx={{
          color: accent,
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        {eyebrow}
      </Typography>
      <Typography
        sx={{
          fontFamily: HEADING_FONT,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          mt: 0.25,
        }}
        variant="h4"
      >
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 560, mt: 0.75 }} variant="body2">
        {dek}
      </Typography>
    </Box>
  );
}

function toCardData(item: CanonItem, rank: number): CanonCardData {
  return {
    id: item.id,
    title: item.title,
    mediaType: item.mediaType,
    posterUrl: item.posterUrl,
    year: item.year,
    genres: item.genres,
    score: item.score,
    leadCredit: item.leadCredit,
    rank,
  };
}

/** The overview's №2–№10 marquee: outlined rank numerals, nine across on desktop. */
function RunnersGrid({
  items,
  startRank,
}: {
  items: CanonItem[];
  startRank: number;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: "14px",
        gridTemplateColumns: {
          xs: "repeat(3, minmax(0, 1fr))",
          sm: "repeat(5, minmax(0, 1fr))",
          md: "repeat(9, minmax(0, 1fr))",
        },
      }}
    >
      {items.map((item, index) => (
        <CanonCard
          data={toCardData(item, startRank + index)}
          key={item.id}
          rankStyle="stroke"
        />
      ))}
    </Box>
  );
}

/** Dense responsive grid of badge-ranked cards — the full ranking & genre lists. */
function CanonGallery({
  items,
  startRank,
  rankStyle = "badge",
}: {
  items: CanonItem[];
  startRank: number;
  rankStyle?: CanonRankStyle;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: "14px",
        gridTemplateColumns: {
          xs: "repeat(3, minmax(0, 1fr))",
          sm: "repeat(5, minmax(0, 1fr))",
          md: "repeat(6, minmax(0, 1fr))",
          lg: "repeat(8, minmax(0, 1fr))",
        },
      }}
    >
      {items.map((item, index) => (
        <CanonCard
          data={toCardData(item, startRank + index)}
          key={item.id}
          rankStyle={rankStyle}
        />
      ))}
    </Box>
  );
}

function GenreShelf({
  accent,
  shelf,
  type,
}: {
  accent: string;
  shelf: CanonGenreShelf;
  type: MediaType;
}) {
  const [lead, ...rest] = shelf.items;
  const row = rest.slice(0, SHELF_ROW_SIZE);

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        aria-hidden
        sx={{
          color: "rgba(244,238,250,0.045)",
          fontFamily: HEADING_FONT,
          fontSize: { xs: 64, md: 110 },
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          maxWidth: "100%",
          overflow: "hidden",
          pointerEvents: "none",
          position: "absolute",
          right: 0,
          top: { xs: -8, md: -18 },
          whiteSpace: "nowrap",
        }}
      >
        {shelf.genre}
      </Box>

      <Stack
        direction="row"
        sx={{
          alignItems: "baseline",
          justifyContent: "space-between",
          mb: 1.5,
          position: "relative",
        }}
      >
        <Box sx={{ alignItems: "center", display: "flex", gap: 1.25 }}>
          <Typography
            sx={{
              fontFamily: HEADING_FONT,
              fontSize: "1.0625rem",
              fontWeight: 700,
              letterSpacing: "-0.015em",
            }}
          >
            Top {shelf.genre}
          </Typography>
          <Box
            sx={{
              background: `linear-gradient(90deg, ${accent}, transparent)`,
              borderRadius: "2px",
              height: 2,
              width: 28,
            }}
          />
        </Box>
        <ViewAllLink href={canonHref(type, shelf.genre)}>View all</ViewAllLink>
      </Stack>

      {lead ? (
        <>
          <Box
            sx={{
              alignItems: "end",
              display: { xs: "none", md: "grid" },
              gap: "14px",
              gridTemplateColumns: "1.6fr repeat(6, 1fr)",
              position: "relative",
            }}
          >
            <CanonLeadCard accent={accent} item={toCardData(lead, 1)} />
            {row.map((item, index) => (
              <CanonCard
                data={toCardData(item, index + 2)}
                key={item.id}
                rankStyle="badge"
              />
            ))}
          </Box>
          <Box
            sx={{
              display: { xs: "grid", md: "none" },
              gap: "14px",
              gridAutoColumns: { xs: 104, sm: 120 },
              gridAutoFlow: "column",
              overflowX: "auto",
              pb: 1,
              scrollbarWidth: "thin",
            }}
          >
            {shelf.items.slice(0, SHELF_ROW_SIZE + 1).map((item, index) => (
              <CanonCard
                data={toCardData(item, index + 1)}
                key={item.id}
                rankStyle="badge"
              />
            ))}
          </Box>
        </>
      ) : null}
    </Box>
  );
}

function GenreChip({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Box
      component="a"
      href={href}
      sx={{
        bgcolor: active ? alpha(ACCENTS.peach, 0.12) : "surface.1",
        border: "1px solid",
        borderColor: active ? alpha(ACCENTS.peach, 0.45) : "border.default",
        borderRadius: "6px",
        color: active ? ACCENTS.peach : "text.secondary",
        cursor: "pointer",
        fontSize: "0.78rem",
        fontWeight: active ? 600 : 500,
        px: 1.25,
        py: 0.5,
        textDecoration: "none",
        transition: "border-color 160ms ease, color 160ms ease",
        "&:hover": { borderColor: alpha(ACCENTS.peach, 0.45), color: ACCENTS.peach },
      }}
    >
      {label}
    </Box>
  );
}

/** The one interactive accent (peach) — Canon's "View all →" affordances. */
function ViewAllLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <Box
      component="a"
      href={href}
      sx={{
        alignItems: "center",
        color: ACCENTS.peach,
        display: "inline-flex",
        fontSize: "0.82rem",
        fontWeight: 600,
        textDecoration: "none",
        whiteSpace: "nowrap",
        "&:hover": { textDecoration: "underline" },
      }}
    >
      {children}
      <ChevronRightIcon fontSize="small" />
    </Box>
  );
}

function BackLink({
  accent,
  href,
  label,
}: {
  accent: string;
  href: string;
  label: string;
}) {
  return (
    <Box
      component="a"
      href={href}
      sx={{
        alignItems: "center",
        color: "text.secondary",
        display: "inline-flex",
        gap: 0.5,
        textDecoration: "none",
        width: "fit-content",
        "&:hover": { color: accent },
      }}
    >
      <ChevronLeftIcon fontSize="small" />
      <Typography variant="body2">{label}</Typography>
    </Box>
  );
}

function EmptyState({ accent }: { accent: string }) {
  return (
    <Card variant="outlined" sx={{ borderColor: alpha(accent, 0.3) }}>
      <CardContent>
        <Typography sx={{ fontWeight: 600 }}>Nothing ranked yet</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
          Items need community ratings or external scores to enter the Canon.
        </Typography>
      </CardContent>
    </Card>
  );
}

function canonHref(
  type: MediaType,
  genre?: string | null,
  subgenre?: string | null,
  all?: boolean,
) {
  const params = new URLSearchParams({ type });
  if (genre) params.set("genre", genre);
  if (subgenre) params.set("subgenre", subgenre);
  if (all) params.set("all", "1");
  return `/canon?${params.toString()}`;
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
