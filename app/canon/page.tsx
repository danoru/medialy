import { Box, Card, CardContent, Chip, Stack, Tab, Tabs, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { MediaType } from "@prisma/client";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import { formatMediaType } from "@/lib/format";
import {
  mediaAccent,
  mediaTypeTabIndicatorColor,
  mediaTypeTabSx,
} from "@/lib/media-ui-helpers";
import { CanonCard, type CanonCardData } from "@/components/canon/CanonCard";
import { PageAccentBackground } from "@/components/shared/PageAccentBackground";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import { getCanonData, type CanonGenreShelf, type CanonItem } from "@/lib/db/canon";

export const dynamic = "force-dynamic";
export const metadata = { title: "The Canon" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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
      <Stack spacing={2.5}>
        <Box
          sx={{
            borderBottom: "1px solid",
            borderBottomColor: "border.subtle",
          }}
        >
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
  return (
    <Stack spacing={3}>
      <CanonHeader accent={accent} eyebrow="The Canon" title={`Top ${noun}`} dek={dek} />

      {overall.length > 0 ? (
        <CanonGallery accent={accent} items={overall} />
      ) : (
        <EmptyState accent={accent} />
      )}

      {shelves.map((shelf) => (
        <GenreShelf accent={accent} key={shelf.genre} shelf={shelf} type={type} />
      ))}
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
  return (
    <Stack spacing={2.5}>
      <Box
        component="a"
        href={canonHref(type)}
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
        <Typography variant="body2">All genres</Typography>
      </Box>

      <CanonHeader
        accent={accent}
        eyebrow="The Canon"
        title={`Top ${genre} ${noun}`}
        dek={`The highest-rated ${genre.toLowerCase()} ${noun.toLowerCase()}, by acclaim.`}
      />

      {subgenres.length > 0 ? (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
          <SubgenreChip
            accent={accent}
            active={subgenre == null}
            href={canonHref(type, genre)}
            label="All"
          />
          {subgenres.map((name) => (
            <SubgenreChip
              accent={accent}
              active={subgenre === name}
              href={canonHref(type, genre, name)}
              key={name}
              label={name}
            />
          ))}
        </Stack>
      ) : null}

      {items.length > 0 ? (
        <CanonGallery accent={accent} items={items} />
      ) : (
        <EmptyState accent={accent} />
      )}
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
          fontFamily:
            'var(--font-heading), "Satoshi", "General Sans", "Space Grotesk", "Inter", system-ui, sans-serif',
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

/** Responsive grid of ranked cards — the Top Overall + deep-genre lists. */
function CanonGallery({ accent, items }: { accent: string; items: CanonItem[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: {
          xs: "repeat(3, minmax(0, 1fr))",
          sm: "repeat(5, minmax(0, 1fr))",
          md: "repeat(6, minmax(0, 1fr))",
          lg: "repeat(8, minmax(0, 1fr))",
        },
      }}
    >
      {items.map((item, index) => (
        <CanonCard accent={accent} data={toCardData(item, index + 1)} key={item.id} />
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
  return (
    <Box>
      <Stack
        direction="row"
        sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 1 }}
      >
        <Typography sx={{ fontWeight: 650 }} variant="h6">
          Top {shelf.genre}
        </Typography>
        <Box
          component="a"
          href={canonHref(type, shelf.genre)}
          sx={{
            alignItems: "center",
            color: accent,
            display: "inline-flex",
            fontSize: "0.82rem",
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          View all
          <ChevronRightIcon fontSize="small" />
        </Box>
      </Stack>
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridAutoColumns: { xs: 104, sm: 120 },
          gridAutoFlow: "column",
          overflowX: "auto",
          pb: 1,
          scrollbarWidth: "thin",
        }}
      >
        {shelf.items.map((item, index) => (
          <CanonCard accent={accent} data={toCardData(item, index + 1)} key={item.id} />
        ))}
      </Box>
    </Box>
  );
}

function SubgenreChip({
  accent,
  active,
  href,
  label,
}: {
  accent: string;
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Chip
      clickable
      component="a"
      href={href}
      label={label}
      size="small"
      sx={{
        bgcolor: active ? alpha(accent, 0.12) : "surface.1",
        border: active
          ? `1px solid ${alpha(accent, 0.45)}`
          : "1px solid var(--mui-palette-border-subtle)",
        color: active ? accent : "text.primary",
        fontWeight: active ? 600 : 500,
      }}
    />
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

function canonHref(type: MediaType, genre?: string | null, subgenre?: string | null) {
  const params = new URLSearchParams({ type });
  if (genre) params.set("genre", genre);
  if (subgenre) params.set("subgenre", subgenre);
  return `/canon?${params.toString()}`;
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
