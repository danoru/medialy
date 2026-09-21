import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import type { MediaType } from "@prisma/client";
import type { SxProps, Theme } from "@mui/material/styles";
import { formatMediaType } from "@/lib/format";
import { alpha } from "@mui/material/styles";
import {
  ACCENTS,
  mediaAccent,
  mediaTypeTabIndicatorColor,
  mediaTypeTabSx,
  posterFallback,
} from "@/lib/media-ui-helpers";
import { PosterImage } from "@/components/media/PosterCard";
import { PageAccentBackground } from "@/components/shared/PageAccentBackground";
import {
  getFeaturedCollection,
  listCollections,
  type CollectionDetail,
  type CollectionSummary,
} from "@/lib/db/collections";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import { getCurrentUser } from "@/lib/user";
import { getCatalogWithUser } from "@/lib/db/catalog";
import { buildOverallTopRankingContext } from "@/lib/db/dashboard";
import { DISCOVER } from "@/lib/scoring/config";
import {
  buildDiscoverPool,
  buildSections,
  buildWorlds,
  pickEssentials,
  scoreDiscoverItems,
  viewerMeanScore,
  type DiscoverChain,
  type DiscoverItem,
  type DiscoverWorld,
} from "@/lib/discover";
import { SubgenreMenu } from "./SubgenreMenu";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PEACH = ACCENTS.peach;
const HEADING_FONT =
  'var(--font-heading), "Satoshi", "General Sans", "Space Grotesk", "Inter", system-ui, sans-serif';

const discoveryCopy: Partial<
  Record<MediaType, { noun: string; headline: string; dek: string }>
> = {
  MOVIE: {
    noun: "films",
    headline: "Movie Discovery",
    dek: "Find the essentials, gateways, hidden gems, and deeper pathways for every cinematic lane.",
  },
  TV_SHOW: {
    noun: "series",
    headline: "TV Discovery",
    dek: "Explore genre-defining seasons, prestige gateways, and shows that open up new obsessions.",
  },
  VIDEO_GAME: {
    noun: "games",
    headline: "Game Discovery",
    dek: "Move through essential games, approachable entry points, and niche worlds worth digging into.",
  },
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedType = stringParam(params.type);
  const selectedType = isVisibleMediaType(requestedType)
    ? requestedType
    : VISIBLE_MEDIA_TYPES[0];
  const requestedGenre = stringParam(params.genre);
  const requestedSubgenre = stringParam(params.subgenre);
  const requestedCountry = stringParam(params.country)?.toUpperCase();

  const currentUser = await getCurrentUser();
  const userId = currentUser?.id ?? null;
  const isAdmin = currentUser?.isAdmin ?? false;

  const [catalog, context, featuredCollection, collections] = await Promise.all([
    getCatalogWithUser(userId),
    buildOverallTopRankingContext(),
    getFeaturedCollection(),
    listCollections({ includeDrafts: false }),
  ]);

  const ofType = catalog
    .filter((item) => item.mediaType === selectedType)
    .filter(
      (item) =>
        !requestedCountry ||
        item.tags.some(
          (entry) =>
            entry.tag.category === "COUNTRY" &&
            entry.tag.countryCode === requestedCountry &&
            entry.tag.discoverable &&
            entry.tag.status === "APPROVED",
        ),
    );

  const scoredAll = scoreDiscoverItems(ofType, context);
  const pool = buildDiscoverPool(scoredAll, { viewerId: userId });
  const viewerMean = viewerMeanScore(scoredAll);
  const worlds = buildWorlds(pool, selectedType);
  const worldsAll = buildWorlds(scoredAll, selectedType);

  const copy = discoveryCopy[selectedType] ?? discoveryCopy.MOVIE!;
  const accentColor = mediaAccent(selectedType);

  const selectedWorld = requestedGenre
    ? (worlds.find((world) => world.name === requestedGenre) ?? null)
    : null;

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
                sx: {
                  backgroundColor: mediaTypeTabIndicatorColor(selectedType),
                },
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
                href={topListsHref(type)}
                key={type}
                label={formatMediaType(type)}
                sx={mediaTypeTabSx(type)}
                value={type}
              />
            ))}
          </Tabs>
        </Box>

        {selectedWorld ? (
          <WorldView
            accent={accentColor}
            country={requestedCountry}
            copy={copy}
            selectedSubgenre={requestedSubgenre ?? null}
            selectedType={selectedType}
            viewerMean={viewerMean}
            world={selectedWorld}
            worldsAll={worldsAll}
          />
        ) : (
          <LandingView
            accent={accentColor}
            collections={collections}
            copy={copy}
            country={requestedCountry}
            featuredCollection={featuredCollection}
            isAdmin={isAdmin}
            pool={pool}
            selectedType={selectedType}
            worlds={worlds}
          />
        )}
      </Stack>
    </Box>
  );
}

function LandingView({
  accent,
  collections,
  copy,
  country,
  featuredCollection,
  isAdmin,
  pool,
  selectedType,
  worlds,
}: {
  accent: string;
  collections: CollectionSummary[];
  copy: { noun: string; headline: string; dek: string };
  country?: string | null;
  featuredCollection: CollectionDetail | null;
  isAdmin: boolean;
  pool: DiscoverItem[];
  selectedType: MediaType;
  worlds: DiscoverWorld[];
}) {
  const essentials = pickEssentials(pool, new Set());

  return (
    <>
      <HeroSection
        accent={accent}
        copy={copy.dek}
        eyebrow={`${formatMediaType(selectedType)} discovery engine`}
        items={essentials.slice(0, 5)}
        title={highlightLastWord(copy.headline, accent)}
      />

      {worlds.length === 0 ? (
        <EmptyDiscoveryState mediaType={selectedType} />
      ) : (
        <>
          <MarqueeRail
            accent={accent}
            country={country}
            selectedType={selectedType}
            worlds={worlds}
          />

          <PosterShelf
            accent={accent}
            eyebrow="Definitive entries"
            items={essentials}
            title={`Essential ${copy.noun}`}
          />
        </>
      )}

      <CollectionsRail
        accent={accent}
        collections={collections}
        featuredCollection={featuredCollection}
        isAdmin={isAdmin}
      />
    </>
  );
}

function WorldView({
  accent,
  country,
  copy,
  selectedSubgenre,
  selectedType,
  viewerMean,
  world,
  worldsAll,
}: {
  accent: string;
  country?: string | null;
  copy: { noun: string; headline: string; dek: string };
  selectedSubgenre: string | null;
  selectedType: MediaType;
  viewerMean: number | null;
  world: DiscoverWorld;
  worldsAll: DiscoverWorld[];
}) {
  const activeSubgenre = selectedSubgenre
    ? (world.subgenres.find((tag) => tag.name === selectedSubgenre) ?? null)
    : null;
  const activeItems = activeSubgenre ? activeSubgenre.items : world.items;

  const worldItemsAllSource = worldsAll.find((w) => w.name === world.name);
  const worldItems = activeSubgenre
    ? (worldItemsAllSource?.subgenres.find(
        (tag) => tag.name === activeSubgenre.name,
      )?.items ?? [])
    : (worldItemsAllSource?.items ?? []);

  const sections = buildSections({
    worldItems,
    pool: activeItems,
    mediaType: selectedType,
    genre: world.name,
    viewerMean,
  });

  // The fan is the "Start here" set: the gateway picks, topped up from the
  // essentials so it always fans out to five.
  const fanItems = [
    ...sections.gateway,
    ...sections.essentials.filter(
      (item) => !sections.gateway.some((pick) => pick.id === item.id),
    ),
  ].slice(0, 5);

  const shelfTitle = activeSubgenre
    ? `Essential ${activeSubgenre.name}`
    : `Essential ${world.name}`;
  const heroDek = `The ${copy.noun} that make ${world.name.toLowerCase()} feel vivid, approachable, and worth exploring deeper.`;

  return (
    <>
      <HeroSection
        accent={accent}
        backHref={topListsHref(selectedType, null, null, country)}
        copy={heroDek}
        eyebrow="Start here"
        items={fanItems}
        title={highlightLastWord(`${world.name} Essentials`, accent)}
      >
        <SubgenrePills
          activeName={activeSubgenre?.name ?? null}
          country={country}
          genre={world.name}
          selectedType={selectedType}
          subgenres={world.subgenres}
        />
      </HeroSection>

      <PosterShelf
        accent={accent}
        eyebrow="Definitive entries"
        items={sections.essentials}
        title={shelfTitle}
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" },
        }}
      >
        <PosterShelf
          accent={accent}
          compact
          eyebrow="Worth digging for"
          grid
          items={sections.hiddenGems}
          title="Hidden Gems"
        />
        <IfYouLikedPanel accent={accent} chains={sections.ifYouLiked} />
      </Box>
    </>
  );
}

/**
 * The page's opening: headline copy on the left, a fan of five posters on
 * the right. On the landing the fan is the type's top essentials; in a world
 * it is the Start here set. The center poster carries the page's one glow.
 */
function HeroSection({
  accent,
  backHref,
  children,
  copy,
  eyebrow,
  items,
  title,
}: {
  accent: string;
  backHref?: string;
  children?: React.ReactNode;
  copy: string;
  eyebrow: string;
  items: DiscoverItem[];
  title: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        minHeight: { xs: 340, sm: 420, md: 460 },
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gap: { xs: 1.2, md: 1.5 },
          gridTemplateColumns: { xs: "1fr", md: "0.92fr 1.08fr" },
          minHeight: "inherit",
        }}
      >
        <Box
          sx={{
            alignSelf: "end",
            maxWidth: 780,
            pb: { xs: 1, md: 4 },
            pt: { xs: 2, md: 4 },
            zIndex: 2,
          }}
        >
          {backHref ? (
            <Box
              component="a"
              href={backHref}
              sx={{
                color: PEACH,
                display: "inline-block",
                fontSize: "0.875rem",
                fontWeight: 550,
                mb: 1.5,
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              {"‹ All worlds"}
            </Box>
          ) : null}
          <Typography
            variant="eyebrow"
            sx={{ color: accent, display: "block", mb: 1.5 }}
          >
            {eyebrow}
          </Typography>
          <Typography
            component="h1"
            variant="displayHero"
            sx={{
              fontSize: { xs: "2.25rem", sm: "3.5rem", md: "4.5rem" },
              maxWidth: 760,
              textWrap: "balance",
            }}
          >
            {title}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{
              fontSize: { xs: "0.9375rem", md: "1.0625rem" },
              lineHeight: 1.55,
              maxWidth: 560,
              mt: 2,
            }}
          >
            {copy}
          </Typography>
          {children ? <Box sx={{ mt: 2.5 }}>{children}</Box> : null}
        </Box>

        <Box
          sx={{
            alignItems: "center",
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(3, minmax(96px, 1fr))",
              sm: "repeat(5, minmax(84px, 1fr))",
            },
            minHeight: { xs: 168, sm: 240, md: 420 },
            position: "relative",
          }}
        >
          <Box
            sx={{
              background: `radial-gradient(circle at 45% 22%, ${alpha(accent, 0.08)} 0%, transparent 24rem)`,
              inset: 0,
              position: "absolute",
              pointerEvents: "none",
            }}
          />
          {items.map((item, index) => (
            <HeroPoster
              accent={accent}
              elevated={index === 2}
              item={item}
              key={item.id}
              sx={{
                // Only three fit across a phone, so don't wrap the other two
                // onto a second row.
                display: { xs: index < 3 ? "block" : "none", sm: "block" },
                mt: index % 2 === 0 ? { xs: 0, md: -5 } : { xs: 2, md: 8 },
                transform: {
                  xs: "none",
                  md: `rotate(${[-7, 4, -2, 6, -5][index] ?? 0}deg)`,
                },
                zIndex: index === 2 ? 4 : 3 - Math.abs(index - 2),
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

/** One fanned poster in the hero. The elevated (center) one carries the glow. */
function HeroPoster({
  accent,
  elevated = false,
  item,
  sx,
}: {
  accent: string;
  elevated?: boolean;
  item: DiscoverItem;
  sx?: object;
}) {
  return (
    <Box
      component="a"
      href={`/media/${item.id}`}
      aria-label={item.title}
      title={item.title}
      sx={{
        aspectRatio: "2 / 3",
        backgroundImage: item.posterUrl
          ? `linear-gradient(180deg, transparent 58%, rgba(8,8,11,0.55)), url(${item.posterUrl})`
          : posterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: `1px solid ${alpha(accent, elevated ? 0.55 : 0.3)}`,
        borderRadius: 2,
        boxShadow: elevated
          ? `0 18px 42px rgba(0,0,0,0.55), 0 0 32px ${alpha(accent, 0.45)}`
          : "0 10px 24px rgba(0,0,0,0.45)",
        display: "block",
        minWidth: 0,
        overflow: "hidden",
        position: "relative",
        textDecoration: "none",
        transition: "transform 180ms ease",
        width: "100%",
        "&:hover": { transform: "translateY(-4px)" },
        ...sx,
      }}
    />
  );
}

function SubgenrePills({
  activeName,
  country,
  genre,
  selectedType,
  subgenres,
}: {
  activeName: string | null;
  country?: string | null;
  genre: string;
  selectedType: MediaType;
  subgenres: DiscoverWorld["subgenres"];
}) {
  const visible = subgenres.slice(0, 8);
  const overflow = subgenres.slice(8);

  return (
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 1 }}>
      <Chip
        clickable
        component="a"
        href={topListsHref(selectedType, genre, null, country)}
        label="All"
        sx={pillSx(activeName == null)}
      />
      {visible.map((tag) => (
        <Chip
          clickable
          component="a"
          href={topListsHref(selectedType, genre, tag.name, country)}
          key={tag.name}
          label={tag.name}
          sx={pillSx(activeName === tag.name)}
        />
      ))}
      {overflow.length > 0 ? (
        <SubgenreMenu
          options={overflow.map((tag) => ({
            name: tag.name,
            href: topListsHref(selectedType, genre, tag.name, country),
          }))}
        />
      ) : null}
    </Stack>
  );
}

function pillSx(active: boolean): SxProps<Theme> {
  return {
    bgcolor: active ? alpha(PEACH, 0.14) : "surface.1",
    border: active
      ? `1px solid ${alpha(PEACH, 0.5)}`
      : "1px solid var(--mui-palette-border-subtle)",
    color: active ? PEACH : "text.primary",
    fontWeight: active ? 600 : 500,
  };
}

function highlightLastWord(text: string, accent: string): React.ReactNode {
  const trimmed = text.trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) {
    return (
      <Box component="span" sx={{ color: accent }}>
        {trimmed}
      </Box>
    );
  }
  return (
    <>
      {trimmed.slice(0, lastSpace + 1)}
      <Box component="span" sx={{ color: accent }}>
        {trimmed.slice(lastSpace + 1)}
      </Box>
    </>
  );
}

/**
 * The world picker: one marquee card per genre, best world first, in a
 * horizontal rail. Each card is the genre name over a small strip of its top
 * posters, so a world reads as a destination rather than a chip.
 */
function MarqueeRail({
  accent,
  country,
  selectedType,
  worlds,
}: {
  accent: string;
  country?: string | null;
  selectedType: MediaType;
  worlds: DiscoverWorld[];
}) {
  return (
    <Stack spacing={1}>
      <Box
        sx={{
          alignItems: "baseline",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="eyebrow" sx={{ color: accent }}>
            Choose a world
          </Typography>
          <Typography component="h2" sx={sectionTitleSx}>
            {worlds.length} lanes, best first
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridAutoColumns: { xs: "196px", sm: "232px" },
          gridAutoFlow: "column",
          overflowX: "auto",
          pb: 0.75,
          scrollbarWidth: "thin",
        }}
      >
        {worlds.map((world) => (
          <MarqueeCard
            accent={accent}
            href={topListsHref(selectedType, world.name, null, country)}
            key={world.name}
            selectedType={selectedType}
            world={world}
          />
        ))}
      </Box>
    </Stack>
  );
}

function MarqueeCard({
  accent,
  href,
  selectedType,
  world,
}: {
  accent: string;
  href: string;
  selectedType: MediaType;
  world: DiscoverWorld;
}) {
  const strip = world.items.slice(0, DISCOVER.worldMosaicSize);
  const noun = world.count === 1 ? "title" : "titles";

  return (
    <Box
      component="a"
      href={href}
      aria-label={`${world.name}, ${world.count} ${noun}`}
      sx={{
        bgcolor: "surface.2",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 2.5,
        color: "inherit",
        display: "block",
        height: 150,
        overflow: "hidden",
        position: "relative",
        textDecoration: "none",
        transition: "border-color 160ms ease, transform 160ms ease",
        "&:hover": {
          borderColor: alpha(PEACH, 0.5),
          transform: "translateY(-2px)",
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          bottom: -34,
          display: "flex",
          gap: 0.75,
          opacity: 0.85,
          position: "absolute",
          right: -10,
          transform: "rotate(-8deg)",
          width: 190,
        }}
      >
        {strip.map((item) => (
          <Box
            key={item.id}
            sx={{
              aspectRatio: "2 / 3",
              backgroundImage: item.posterUrl
                ? `url(${item.posterUrl})`
                : posterFallback(selectedType),
              backgroundPosition: "center",
              backgroundSize: "cover",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 1.25,
              flex: "0 0 58px",
            }}
          />
        ))}
      </Box>
      <Box
        aria-hidden
        sx={{
          background:
            "linear-gradient(105deg, var(--mui-palette-surface-2) 38%, rgba(26,22,36,0.2) 100%)",
          inset: 0,
          position: "absolute",
        }}
      />
      <Typography
        sx={{
          fontFamily: HEADING_FONT,
          fontSize: "1.375rem",
          fontWeight: 700,
          left: 16,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          maxWidth: 124,
          position: "absolute",
          top: 16,
        }}
      >
        {world.name}
      </Typography>
      <Typography
        sx={{
          bottom: 14,
          color: "text.secondary",
          fontSize: "0.75rem",
          left: 16,
          position: "absolute",
        }}
      >
        {world.count} {noun} · quality {world.averageQuality.toFixed(1)}
      </Typography>
      <Box
        aria-hidden
        sx={{
          bgcolor: accent,
          bottom: 0,
          left: 0,
          position: "absolute",
          top: 0,
          width: 2,
        }}
      />
    </Box>
  );
}

function CollectionsRail({
  accent,
  collections,
  featuredCollection,
  isAdmin,
}: {
  accent: string;
  collections: CollectionSummary[];
  featuredCollection: CollectionDetail | null;
  isAdmin: boolean;
}) {
  if (collections.length === 0 && !isAdmin) return null;

  const rest = featuredCollection
    ? collections.filter((c) => c.id !== featuredCollection.id)
    : collections;

  return (
    <Stack spacing={1}>
      <Box
        sx={{
          alignItems: "baseline",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="eyebrow" sx={{ color: accent }}>
          Curated collections
        </Typography>
        <Box
          component="a"
          href={
            collections.length > 0 || !isAdmin
              ? "/discover/collections"
              : "/discover/collections/new"
          }
          sx={{ color: PEACH, fontSize: "0.875rem", textDecoration: "none" }}
        >
          {collections.length > 0
            ? "View all"
            : isAdmin
              ? "Create the first one"
              : "View all"}
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          overflowX: "auto",
          pb: 0.5,
          scrollbarWidth: "thin",
        }}
      >
        {featuredCollection ? (
          <FeaturedCollectionCard collection={featuredCollection} />
        ) : null}
        {rest.slice(0, 12).map((collection) => (
          <CompactCollectionCard collection={collection} key={collection.id} />
        ))}
      </Box>
    </Stack>
  );
}

function FeaturedCollectionCard({ collection }: { collection: CollectionDetail }) {
  const items = [
    ...collection.ungrouped,
    ...collection.sectionGroups.flatMap((group) => group.items),
  ].slice(0, 4);

  return (
    <Box
      component="a"
      href={`/discover/collections/${collection.id}`}
      sx={{
        bgcolor: "surface.1",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 2,
        color: "inherit",
        display: "block",
        flex: "0 0 auto",
        p: 1.5,
        textDecoration: "none",
        width: 320,
      }}
    >
      <Typography variant="eyebrow" sx={{ color: PEACH }}>
        {collection.featuredMonth
          ? `Featured · ${collection.featuredMonth}`
          : "Featured"}
      </Typography>
      <Typography sx={{ fontWeight: 700, mt: 0.5 }}>{collection.name}</Typography>
      {collection.subtitle ? (
        <Typography color="text.secondary" noWrap sx={{ mt: 0.25 }} variant="body2">
          {collection.subtitle}
        </Typography>
      ) : null}
      {items.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 0.75,
            gridTemplateColumns: "repeat(4, 1fr)",
            mt: 1,
          }}
        >
          {items.map((item) => (
            <PosterImage item={item.media} key={item.id} />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function CompactCollectionCard({ collection }: { collection: CollectionSummary }) {
  return (
    <Box
      component="a"
      href={`/discover/collections/${collection.id}`}
      sx={{
        bgcolor: "surface.1",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 2,
        color: "inherit",
        display: "flex",
        flex: "0 0 auto",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: 96,
        p: 1.5,
        textDecoration: "none",
        width: 200,
      }}
    >
      <Typography noWrap sx={{ fontWeight: 650 }}>
        {collection.name}
      </Typography>
      {collection.subtitle ? (
        <Typography color="text.secondary" noWrap sx={{ mt: 0.25 }} variant="body2">
          {collection.subtitle}
        </Typography>
      ) : null}
      <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="caption">
        {`${collection.itemCount} title${collection.itemCount === 1 ? "" : "s"}`}
      </Typography>
    </Box>
  );
}

function PosterShelf({
  accent,
  compact = false,
  eyebrow,
  glow = false,
  grid = false,
  items,
  title,
}: {
  accent: string;
  compact?: boolean;
  eyebrow: string;
  glow?: boolean;
  grid?: boolean;
  items: DiscoverItem[];
  title: string;
}) {
  return (
    <DiscoveryPanel accent={accent}>
      <Typography variant="eyebrow" sx={{ color: accent }}>
        {eyebrow}
      </Typography>
      <Typography component="h2" sx={sectionTitleSx}>
        {title}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridAutoColumns: grid
            ? undefined
            : {
                xs: compact ? "118px" : "132px",
                sm: compact ? "132px" : "156px",
                md: compact ? "142px" : "172px",
              },
          gridAutoFlow: grid ? undefined : "column",
          gridTemplateColumns: grid
            ? {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "repeat(3, minmax(0, 1fr))",
                lg: "repeat(4, minmax(0, 1fr))",
              }
            : undefined,
          mt: 1.25,
          overflowX: grid ? "visible" : "auto",
          pb: 0.5,
          scrollbarWidth: "thin",
        }}
      >
        {items.map((item, index) => (
          <ShelfPoster
            accent={accent}
            glow={glow && index === 0}
            item={item}
            key={item.id}
            rank={index + 1}
          />
        ))}
      </Box>
      {items.length === 0 ? <EmptyText>No entries yet.</EmptyText> : null}
    </DiscoveryPanel>
  );
}

function ShelfPoster({
  accent,
  glow = false,
  item,
  rank,
}: {
  accent: string;
  glow?: boolean;
  item: DiscoverItem;
  rank: number;
}) {
  return (
    <Box
      aria-label={item.title}
      component="a"
      href={`/media/${item.id}`}
      sx={{
        color: "inherit",
        display: "block",
        minWidth: 0,
        textDecoration: "none",
      }}
    >
      <Box sx={{ position: "relative" }}>
        <Box
          sx={{
            aspectRatio: "2 / 3",
            backgroundImage: item.posterUrl
              ? `linear-gradient(180deg, transparent 58%, rgba(8,8,11,0.55)), url(${item.posterUrl})`
              : posterFallback(item.mediaType),
            backgroundPosition: "center",
            backgroundSize: "cover",
            border: `1px solid ${alpha(accent, 0.3)}`,
            borderRadius: 2,
            boxShadow: glow
              ? `0 14px 36px rgba(0,0,0,0.5), 0 0 28px ${alpha(accent, 0.4)}`
              : "0 6px 16px rgba(0,0,0,0.35)",
            overflow: "hidden",
            width: "100%",
          }}
        />
        <Box
          sx={{
            alignItems: "center",
            bgcolor: "rgba(8,8,11,0.7)",
            backdropFilter: "blur(6px)",
            border: `1px solid ${alpha(accent, 0.4)}`,
            borderRadius: 1,
            color: accent,
            display: "flex",
            fontSize: "0.875rem",
            fontWeight: 700,
            height: 24,
            justifyContent: "center",
            left: 8,
            position: "absolute",
            top: 8,
            width: 28,
          }}
        >
          {rank}
        </Box>
      </Box>
      <Typography noWrap sx={{ fontWeight: 600, mt: 1 }}>
        {item.title}
      </Typography>
      <Typography
        color="text.secondary"
        component="span"
        noWrap
        sx={{ display: "block" }}
        title="Quality: community and critic blend"
        variant="caption"
      >
        {item.quality.toFixed(1)}
      </Typography>
    </Box>
  );
}

function IfYouLikedPanel({
  accent,
  chains,
}: {
  accent: string;
  chains: DiscoverChain[];
}) {
  return (
    <DiscoveryPanel accent={accent}>
      <Typography variant="eyebrow" sx={{ color: accent }}>
        Recommendation pathways
      </Typography>
      <Typography component="h2" sx={sectionTitleSx}>
        If You Liked...
      </Typography>
      <Stack spacing={0.8} sx={{ mt: 1.25 }}>
        {chains.map((chain) => (
          <Box
            key={`${chain.seed.id}-${chain.next.id}`}
            sx={{
              alignItems: "center",
              bgcolor: "surface.1",
              border: "1px solid",
              borderColor: "border.subtle",
              borderRadius: 2,
              display: "grid",
              gap: 1,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "48px 1fr auto 48px 1fr",
              },
              p: 1,
            }}
          >
            <ChainLink item={chain.seed} />
            <Typography
              color="text.secondary"
              sx={{ fontWeight: 550, textAlign: { xs: "center", sm: "left" } }}
            >
              then
            </Typography>
            <ChainLink item={chain.next} />
            {chain.sharedFacet ? (
              <Typography
                color="text.secondary"
                sx={{ gridColumn: "1 / -1" }}
                variant="caption"
              >
                {`both ${chain.sharedFacet}`}
              </Typography>
            ) : null}
          </Box>
        ))}
      </Stack>
      {chains.length === 0 ? (
        <EmptyText>More rated entries will create pathways here.</EmptyText>
      ) : null}
    </DiscoveryPanel>
  );
}

/** One half of an "If You Liked…" chain — poster + title, as a single link.
 *
 *  Note this page is a Server Component, so `component={Link}` can't be used:
 *  MUI's `Box` is a client component and a function prop can't cross the RSC
 *  boundary. Plain `<Link>` on the outside, `sx` on the inside. */
function ChainLink({ item }: { item: DiscoverItem }) {
  return (
    <Link href={`/media/${item.id}`} style={{ color: "inherit", textDecoration: "none" }}>
      <Box
        sx={{
          alignItems: "center",
          display: "grid",
          gap: 1,
          gridTemplateColumns: "48px minmax(0, 1fr)",
          minHeight: 44,
        }}
      >
        <PosterImage item={item} />
        <Typography noWrap sx={{ fontWeight: 600 }}>
          {item.title}
        </Typography>
      </Box>
    </Link>
  );
}

function DiscoveryPanel({
  accent,
  children,
}: {
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      sx={{
        height: "100%",
        borderLeft: accent ? `2px solid ${accent}` : undefined,
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>{children}</CardContent>
    </Card>
  );
}

function EmptyDiscoveryState({ mediaType }: { mediaType: MediaType }) {
  return (
    <DiscoveryPanel>
      <Typography component="h2" sx={sectionTitleSx}>
        {`No ${formatMediaType(mediaType).toLowerCase()} yet`}
      </Typography>
      <EmptyText>
        Add items with genres and posters to build the discovery engine.
      </EmptyText>
    </DiscoveryPanel>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
      {children}
    </Typography>
  );
}

const sectionTitleSx: SxProps<Theme> = {
  fontFamily:
    'var(--font-heading), "Satoshi", "General Sans", "Space Grotesk", "Inter", system-ui, sans-serif',
  fontSize: { xs: "1.25rem", md: "1.5rem" },
  fontWeight: 650,
  letterSpacing: "-0.025em",
  lineHeight: 1.15,
  mt: 0.75,
};

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function topListsHref(
  type: MediaType,
  genre?: string | null,
  subgenre?: string | null,
  country?: string | null,
) {
  const params = new URLSearchParams({ type });
  if (genre) params.set("genre", genre);
  if (subgenre) params.set("subgenre", subgenre);
  if (country) params.set("country", country);
  return `/discover?${params.toString()}`;
}
