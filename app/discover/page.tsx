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
  featuredCollection,
  isAdmin,
  pool,
  selectedType,
  worlds,
}: {
  accent: string;
  collections: CollectionSummary[];
  copy: { noun: string; headline: string; dek: string };
  featuredCollection: CollectionDetail | null;
  isAdmin: boolean;
  pool: DiscoverItem[];
  selectedType: MediaType;
  worlds: DiscoverWorld[];
}) {
  const essentials = pickEssentials(pool, new Set());
  const headlineNode = highlightLastWord(copy.headline, accent);

  return (
    <>
      <Box sx={{ maxHeight: 140, overflow: "hidden" }}>
        <Typography variant="eyebrow" sx={{ color: accent, display: "block" }}>
          {`${formatMediaType(selectedType)} discovery`}
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontFamily: HEADING_FONT,
            fontSize: { xs: "1.75rem", md: "2.5rem" },
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            mt: 0.5,
          }}
        >
          {headlineNode}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ fontSize: { xs: "0.875rem", md: "1rem" }, mt: 0.75 }}
        >
          {copy.dek}
        </Typography>
      </Box>

      {worlds.length === 0 ? (
        <EmptyDiscoveryState mediaType={selectedType} />
      ) : (
        <>
          <PosterShelf
            accent={accent}
            eyebrow="Definitive entries"
            glow
            items={essentials}
            title={`Essential ${copy.noun}`}
          />

          <WorldsGrid accent={accent} country={null} selectedType={selectedType} worlds={worlds} />
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
    ? (worldItemsAllSource?.subgenres.find((tag) => tag.name === activeSubgenre.name)
        ?.items ?? [])
    : (worldItemsAllSource?.items ?? []);

  const sections = buildSections({
    worldItems,
    pool: activeItems,
    mediaType: selectedType,
    genre: world.name,
    viewerMean,
  });

  const shelfTitle = activeSubgenre
    ? `Essential ${activeSubgenre.name}`
    : `Essential ${world.name}`;

  return (
    <>
      <Box
        sx={{
          bgcolor: "background.default",
          borderBottom: "1px solid",
          borderBottomColor: "border.subtle",
          boxShadow: `0 8px 24px -12px ${alpha(accent, 0.5)}`,
          position: "sticky",
          pt: 1.5,
          pb: 1.25,
          top: 0,
          zIndex: 10,
        }}
      >
        <Box
          component="a"
          href={topListsHref(selectedType, null, null, country)}
          sx={{
            color: PEACH,
            display: "inline-block",
            fontSize: "0.875rem",
            fontWeight: 550,
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {"‹ All worlds"}
        </Box>
        <Typography
          component="h1"
          sx={{
            fontFamily: HEADING_FONT,
            fontSize: { xs: "1.5rem", md: "2rem" },
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            mt: 0.25,
          }}
        >
          {highlightLastWord(world.name, accent)}
        </Typography>
        <SubgenrePills
          activeName={activeSubgenre?.name ?? null}
          country={country}
          genre={world.name}
          selectedType={selectedType}
          subgenres={world.subgenres}
        />
      </Box>

      <StartHerePanel
        accent={accent}
        genre={world.name}
        items={sections.gateway}
        mediaNoun={copy.noun}
      />

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

function WorldsGrid({
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
      <Typography variant="eyebrow" sx={{ color: accent }}>
        Worlds
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            sm: "repeat(3, minmax(0, 1fr))",
            md: "repeat(4, minmax(0, 1fr))",
            lg: "repeat(5, minmax(0, 1fr))",
          },
        }}
      >
        {worlds.map((world) => (
          <WorldCard
            country={country}
            key={world.name}
            selectedType={selectedType}
            world={world}
          />
        ))}
      </Box>
    </Stack>
  );
}

function WorldCard({
  country,
  selectedType,
  world,
}: {
  country?: string | null;
  selectedType: MediaType;
  world: DiscoverWorld;
}) {
  const mosaic = world.items.slice(0, DISCOVER.worldMosaicSize);
  return (
    <Box
      component="a"
      href={topListsHref(selectedType, world.name, null, country)}
      sx={{
        color: "inherit",
        display: "block",
        textDecoration: "none",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gap: 0.5,
          gridTemplateColumns: `repeat(${Math.max(mosaic.length, 1)}, 1fr)`,
        }}
      >
        {mosaic.length > 0 ? (
          mosaic.map((item) => (
            <Box
              key={item.id}
              sx={{
                aspectRatio: "2 / 3",
                backgroundImage: item.posterUrl
                  ? `url(${item.posterUrl})`
                  : posterFallback(item.mediaType),
                backgroundPosition: "center",
                backgroundSize: "cover",
                border: "1px solid",
                borderColor: "border.subtle",
                borderRadius: 1,
                overflow: "hidden",
              }}
            />
          ))
        ) : (
          <Box
            sx={{
              aspectRatio: "2 / 3",
              backgroundImage: posterFallback(selectedType),
              border: "1px solid",
              borderColor: "border.subtle",
              borderRadius: 1,
            }}
          />
        )}
      </Box>
      <Typography noWrap sx={{ fontWeight: 650, mt: 1 }}>
        {world.name}
      </Typography>
      <Typography color="text.secondary" noWrap variant="body2">
        {`${world.count} ${world.count === 1 ? "title" : "titles"}`}
      </Typography>
      <Typography color="text.secondary" noWrap variant="caption">
        {`Quality ${world.averageQuality.toFixed(1)}`}
      </Typography>
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

function StartHerePanel({
  accent,
  genre,
  items,
  mediaNoun,
}: {
  accent: string;
  genre: string;
  items: DiscoverItem[];
  mediaNoun: string;
}) {
  return (
    <DiscoveryPanel accent={accent}>
      <Typography variant="eyebrow" sx={{ color: accent }}>
        Start here
      </Typography>
      <Typography component="h2" sx={sectionTitleSx}>
        {`Gateway ${mediaNoun} for ${genre}`}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
          mt: 1.25,
        }}
      >
        {items.map((item, index) => (
          <GatewayCard accent={accent} index={index} item={item} key={item.id} />
        ))}
      </Box>
      {items.length === 0 ? <EmptyText>No entries yet.</EmptyText> : null}
    </DiscoveryPanel>
  );
}

function GatewayCard({
  accent,
  index,
  item,
}: {
  accent: string;
  index: number;
  item: DiscoverItem;
}) {
  return (
    <Box
      component="a"
      href={`/media/${item.id}`}
      sx={{
        alignItems: "center",
        bgcolor: "surface.1",
        border: "1px solid",
        borderColor: "border.subtle",
        borderLeft: `2px solid ${accent}`,
        borderRadius: 2,
        color: "inherit",
        display: "grid",
        gap: 1,
        gridTemplateColumns: "58px 1fr auto",
        minHeight: 86,
        overflow: "hidden",
        p: 1,
        textDecoration: "none",
        transition: "border-color 160ms ease, transform 160ms ease",
        "&:hover": {
          borderColor: "border.strong",
          transform: "translateY(-2px)",
        },
      }}
    >
      <PosterImage item={item} />
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 600, lineHeight: 1.2 }}>
          {item.title}
        </Typography>
        <Typography color="text.secondary" noWrap variant="body2">
          {item.tags
            .map((entry) => entry.tag.name)
            .slice(0, 2)
            .join(" · ") || "Essential entry point"}
        </Typography>
      </Box>
      <Typography sx={{ color: "text.disabled", fontSize: "1.1rem", fontWeight: 700 }}>
        {String(index + 1).padStart(2, "0")}
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
