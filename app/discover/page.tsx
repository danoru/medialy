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
  mediaAccent,
  mediaTypeTabIndicatorColor,
  mediaTypeTabSx,
  posterFallback,
} from "@/lib/media-ui-helpers";
import { PosterImage, PosterTile } from "@/components/media/PosterCard";
import { PageAccentBackground } from "@/components/shared/PageAccentBackground";
import {
  getFeaturedCollection,
  listCollections,
  type CollectionDetail,
  type CollectionSummary,
} from "@/lib/db/collections";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import { rankHiddenGems } from "@/lib/scoring/hiddenGems";
import { bayesianShrunkMean } from "@/lib/scoring/affinity";
import { TOP_RANKING } from "@/lib/scoring/config";
import {
  getPromotedDiscoverTagsForMediaType,
  isDiscoverSubgenreForGenre,
} from "@/lib/taxonomy";
import { getCurrentUser } from "@/lib/user";
import {
  getCatalogWithUser,
  type CatalogItemWithUser,
} from "@/lib/db/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type DiscoveryItem = CatalogItemWithUser;

type GenreWorld = {
  name: string;
  count: number;
  averageScore: number;
  items: DiscoveryItem[];
  tags: Subgenre[];
};

type Subgenre = {
  name: string;
  count: number;
  items: DiscoveryItem[];
};

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

export default async function TopListsPage({
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
  // Reads the shared cached catalog instead of its own per-type scan; the type,
  // archive and country filters below are the JS equivalents of the `where`
  // clauses this used to send.
  const catalog = await getCatalogWithUser(userId);
  const discoverItems: DiscoveryItem[] = catalog
    .filter((item) => item.mediaType === selectedType)
    .filter((item) => userId == null || !item.isArchived)
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
    )
    .sort(
      (a, b) =>
        (b.computedPersonalScore ?? -Infinity) -
          (a.computedPersonalScore ?? -Infinity) ||
        (b.personalRating ?? -Infinity) - (a.personalRating ?? -Infinity) ||
        b.pairwiseScore - a.pairwiseScore,
    );

  const discoverPrior = computeDiscoverPrior(discoverItems);
  const genreWorlds = getGenreWorlds(
    discoverItems,
    selectedType,
    discoverPrior,
  );
  const selectedWorld =
    genreWorlds.find((world) => world.name === requestedGenre) ??
    genreWorlds[0] ??
    null;
  const selectedSubgenre =
    selectedWorld?.tags.find((tag) => tag.name === requestedSubgenre) ?? null;
  const activeItems = selectedSubgenre?.items ?? selectedWorld?.items ?? [];
  const essentials = activeItems.slice(0, 14);
  const startHere = getStartHere(activeItems, discoverPrior);
  const hiddenGems = getHiddenGems(activeItems);
  const relationshipChains = getRelationshipChains(activeItems);
  const [featuredCollection, collections] = await Promise.all([
    getFeaturedCollection(),
    listCollections({ includeDrafts: false }),
  ]);
  const copy = discoveryCopy[selectedType] ?? discoveryCopy.MOVIE!;
  const heroTitle = selectedWorld
    ? `${selectedWorld.name} Essentials`
    : copy.headline;
  const heroDek = selectedWorld
    ? `The ${copy.noun} that make ${selectedWorld.name.toLowerCase()} feel vivid, approachable, and worth exploring deeper.`
    : copy.dek;
  const heroItems = essentials.slice(0, 5);
  const accentColor = mediaAccent(selectedType);
  const heroTitleNode = highlightLastWord(heroTitle, accentColor);

  return (
    <Box
      sx={{
        mx: "auto",
      }}
    >
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

        <HeroSection
          accent={accentColor}
          copy={heroDek}
          eyebrow={`${formatMediaType(selectedType)} discovery engine`}
          items={heroItems}
          title={heroTitleNode}
        />

        {featuredCollection ? (
          <FeaturedCollectionPanel
            accent={accentColor}
            collection={featuredCollection}
          />
        ) : null}

        <GenreRail
          accent={accentColor}
          genres={genreWorlds}
          selectedGenre={selectedWorld?.name ?? null}
          selectedType={selectedType}
          country={requestedCountry}
        />

        {selectedWorld ? (
          <>
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", lg: "1.15fr 0.85fr" },
              }}
            >
              <StartHerePanel
                accent={accentColor}
                genre={selectedWorld.name}
                items={startHere}
                mediaNoun={copy.noun}
              />
              <SubgenreExplorer
                accent={accentColor}
                selectedSubgenre={selectedSubgenre?.name ?? null}
                selectedType={selectedType}
                subgenres={selectedWorld.tags}
                genre={selectedWorld.name}
                country={requestedCountry}
              />
            </Box>

            <PosterShelf
              accent={accentColor}
              eyebrow="Definitive entries"
              items={essentials}
              title={
                selectedSubgenre
                  ? `Essential ${selectedSubgenre.name}`
                  : `Essential ${selectedWorld.name}`
              }
            />

            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", xl: "0.9fr 1.1fr" },
              }}
            >
              <PosterShelf
                accent={accentColor}
                compact
                eyebrow="Worth digging for"
                grid
                items={hiddenGems}
                title="Hidden Gems"
              />
              <IfYouLikedPanel
                accent={accentColor}
                chains={relationshipChains}
              />
            </Box>
          </>
        ) : (
          <EmptyDiscoveryState mediaType={selectedType} />
        )}

        {collections.length > 0 || isAdmin ? (
          <CuratedCollections
            accent={accentColor}
            collections={collections}
            isAdmin={isAdmin}
          />
        ) : null}
      </Stack>
    </Box>
  );
}

function highlightLastWord(text: string, accent: string): React.ReactNode {
  const trimmed = text.trim();
  const lastSpace = trimmed.lastIndexOf(" ");
  if (lastSpace === -1) {
    return (
      <Box
        component="span"
        sx={{
          color: accent,
          textShadow: `0 0 28px ${alpha(accent, 0.5)}`,
        }}
      >
        {trimmed}
      </Box>
    );
  }
  return (
    <>
      {trimmed.slice(0, lastSpace + 1)}
      <Box
        component="span"
        sx={{
          color: accent,
          textShadow: `0 0 28px ${alpha(accent, 0.5)}`,
        }}
      >
        {trimmed.slice(lastSpace + 1)}
      </Box>
    </>
  );
}

function HeroSection({
  accent,
  copy,
  eyebrow,
  items,
  title,
}: {
  accent: string;
  copy: string;
  eyebrow: string;
  items: DiscoveryItem[];
  title: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        minHeight: { xs: 360, sm: 430, md: 470 },
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
            pt: { xs: 2, md: 5 },
            zIndex: 2,
          }}
        >
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
        </Box>

        <Box
          sx={{
            alignItems: "center",
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(3, minmax(96px, 1fr))",
              sm: "repeat(5, minmax(84px, 1fr))",
            },
            minHeight: { xs: 168, sm: 240, md: 430 },
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
            <PosterCard
              accent={accent}
              elevated={index === 2}
              item={item}
              key={item.id}
              linked
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

function GenreRail({
  accent,
  country,
  genres,
  selectedGenre,
  selectedType,
}: {
  accent: string;
  country?: string | null;
  genres: GenreWorld[];
  selectedGenre: string | null;
  selectedType: MediaType;
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="eyebrow" sx={{ color: accent }}>
        Choose a world
      </Typography>
      <Box
        sx={{
          display: "flex",
          gap: 0.75,
          overflowX: "auto",
          pb: 0.4,
          scrollbarWidth: "thin",
        }}
      >
        {[...genres]
          .sort((first, second) => first.name.localeCompare(second.name))
          .map((genre) => {
            const active = selectedGenre === genre.name;
            return (
              <Chip
                clickable
                component="a"
                href={topListsHref(selectedType, genre.name, null, country)}
                key={genre.name}
                label={genre.name}
                sx={{
                  bgcolor: active ? alpha(accent, 0.1) : "surface.1",
                  border: active
                    ? `1px solid ${alpha(accent, 0.4)}`
                    : "1px solid var(--mui-palette-border-subtle)",
                  color: active ? accent : "text.primary",
                  flex: "0 0 auto",
                  fontWeight: active ? 600 : 500,
                  boxShadow: active
                    ? `0 0 14px ${alpha(accent, 0.25)}`
                    : "none",
                }}
              />
            );
          })}
      </Box>
    </Stack>
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
  items: DiscoveryItem[];
  mediaNoun: string;
}) {
  return (
    <DiscoveryPanel accent={accent}>
      <Typography variant="eyebrow" sx={{ color: accent }}>
        Start here
      </Typography>
      <Typography component="h2" sx={sectionTitleSx}>
        Gateway {mediaNoun} for {genre.toLowerCase()}
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
          <GatewayCard
            accent={accent}
            index={index}
            item={item}
            key={item.id}
          />
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
  item: DiscoveryItem;
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
      <Typography
        sx={{ color: "text.disabled", fontSize: "1.1rem", fontWeight: 700 }}
      >
        {String(index + 1).padStart(2, "0")}
      </Typography>
    </Box>
  );
}

function SubgenreExplorer({
  accent,
  country,
  genre,
  selectedSubgenre,
  selectedType,
  subgenres,
}: {
  accent: string;
  country?: string | null;
  genre: string;
  selectedSubgenre: string | null;
  selectedType: MediaType;
  subgenres: Subgenre[];
}) {
  return (
    <DiscoveryPanel accent={accent}>
      <Typography variant="eyebrow" sx={{ color: accent }}>
        Subgenre explorer
      </Typography>
      <Typography component="h2" sx={sectionTitleSx}>
        Go deeper than {genre.toLowerCase()}
      </Typography>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 1.25 }}>
        <Chip
          clickable
          component="a"
          href={topListsHref(selectedType, genre, null, country)}
          label="All essentials"
          sx={subgenreChipSx(!selectedSubgenre, accent)}
        />
        {subgenres.slice(0, 14).map((tag) => (
          <Chip
            clickable
            component="a"
            href={topListsHref(selectedType, genre, tag.name, country)}
            key={tag.name}
            label={tag.name}
            sx={subgenreChipSx(selectedSubgenre === tag.name, accent)}
          />
        ))}
      </Stack>
      {subgenres.length === 0 ? (
        <EmptyText>
          Add approved tags to this genre to unlock subgenre paths.
        </EmptyText>
      ) : null}
    </DiscoveryPanel>
  );
}

function PosterShelf({
  accent,
  compact = false,
  eyebrow,
  grid = false,
  items,
  title,
}: {
  accent: string;
  compact?: boolean;
  eyebrow: string;
  grid?: boolean;
  items: DiscoveryItem[];
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
  item,
  rank,
}: {
  accent: string;
  item: DiscoveryItem;
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
        <PosterCard item={item} />
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
      <Typography color="text.secondary" noWrap variant="caption">
        {formatScore(item)}
      </Typography>
    </Box>
  );
}

function IfYouLikedPanel({
  accent,
  chains,
}: {
  accent: string;
  chains: Array<{ seed: DiscoveryItem; next: DiscoveryItem }>;
}) {
  return (
    <DiscoveryPanel accent={accent}>
      <Typography variant="eyebrow" sx={{ color: accent }}>
        Recommendation pathways
      </Typography>
      <Typography component="h2" sx={sectionTitleSx}>
        If You Liked...
      </Typography>
      {/* Was a five-column grid even at 390px, which squeezed each `noWrap`
          title into ~85px — and nothing in the row was a link, so the user
          could see two films and tap neither. Now it stacks on a phone and both
          halves navigate. */}
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
          </Box>
        ))}
      </Stack>
      {chains.length === 0 ? (
        <EmptyText>More rated entries will create pathways here.</EmptyText>
      ) : null}
    </DiscoveryPanel>
  );
}

function FeaturedCollectionPanel({
  accent,
  collection,
}: {
  accent: string;
  collection: CollectionDetail;
}) {
  const items = [
    ...collection.ungrouped,
    ...collection.sectionGroups.flatMap((group) => group.items),
  ].slice(0, 6);

  return (
    <DiscoveryPanel accent={accent}>
      <Box
        component="a"
        href={`/discover/collections/${collection.id}`}
        sx={{ color: "inherit", display: "block", textDecoration: "none" }}
      >
        <Typography variant="eyebrow" sx={{ color: accent }}>
          Featured collection
        </Typography>
        <Typography
          sx={{
            fontFamily:
              'var(--font-heading), "Satoshi", "General Sans", "Space Grotesk", "Inter", system-ui, sans-serif',
            fontSize: "1.35rem",
            fontWeight: 700,
            letterSpacing: "-0.015em",
            mt: 0.5,
          }}
        >
          {collection.name}
        </Typography>
        {collection.subtitle ? (
          <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
            {collection.subtitle}
          </Typography>
        ) : null}
      </Box>
      {items.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: {
              xs: "repeat(3, 1fr)",
              sm: "repeat(6, 1fr)",
            },
            mt: 1.5,
          }}
        >
          {items.map((item) => (
            <PosterTile
              item={{
                id: item.media.id,
                title: item.media.title,
                mediaType: item.media.mediaType,
                posterUrl: item.media.posterUrl,
              }}
              key={item.id}
            />
          ))}
        </Box>
      ) : null}
    </DiscoveryPanel>
  );
}

function CuratedCollections({
  accent,
  collections,
  isAdmin,
}: {
  accent: string;
  collections: CollectionSummary[];
  isAdmin: boolean;
}) {
  return (
    <DiscoveryPanel accent={accent}>
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
          href="/discover/collections"
          sx={{ color: accent, fontSize: "0.875rem", textDecoration: "none" }}
        >
          {collections.length > 0 ? "View all collections" : "Manage collections"}
        </Box>
      </Box>
      {collections.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
          No collections yet.{" "}
          {isAdmin ? (
            <Box
              component="a"
              href="/discover/collections/new"
              sx={{ color: accent, textDecoration: "none" }}
            >
              Create the first one.
            </Box>
          ) : null}
        </Typography>
      ) : null}
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
          mt: 1,
        }}
      >
        {collections.slice(0, 8).map((collection) => (
          <Box
            component="a"
            href={`/discover/collections/${collection.id}`}
            key={collection.id}
            sx={{
              bgcolor: "surface.1",
              border: "1px solid",
              borderColor: "border.subtle",
              borderLeft: `2px solid ${accent}`,
              borderRadius: 2,
              color: "inherit",
              display: "flex",
              flexDirection: "column",
              minHeight: 142,
              p: 1.5,
              textDecoration: "none",
              transition: "border-color 160ms ease, transform 160ms ease",
              "&:hover": {
                borderColor: "border.strong",
                transform: "translateY(-2px)",
              },
            }}
          >
            {collection.featuredMonth ? (
              <Typography variant="eyebrow" sx={{ color: accent }}>
                Featured · {collection.featuredMonth}
              </Typography>
            ) : null}
            <Typography
              sx={{
                fontFamily:
                  'var(--font-heading), "Satoshi", "General Sans", "Space Grotesk", "Inter", system-ui, sans-serif',
                fontSize: "1rem",
                fontWeight: 650,
                letterSpacing: "-0.015em",
                mt: 1.5,
              }}
            >
              {collection.name}
            </Typography>
            {collection.subtitle ? (
              <Typography
                color="text.secondary"
                sx={{ mt: 0.6 }}
                variant="body2"
              >
                {collection.subtitle}
              </Typography>
            ) : null}
            <Typography
              color="text.secondary"
              sx={{ mt: "auto", pt: 1 }}
              variant="caption"
            >
              {collection.itemCount} title
              {collection.itemCount === 1 ? "" : "s"}
            </Typography>
          </Box>
        ))}
      </Box>
    </DiscoveryPanel>
  );
}

/** One half of an "If You Liked…" chain — poster + title, as a single link.
 *
 *  Note this page is a Server Component, so `component={Link}` can't be used:
 *  MUI's `Box` is a client component and a function prop can't cross the RSC
 *  boundary. Plain `<Link>` on the outside, `sx` on the inside. */
function ChainLink({ item }: { item: DiscoveryItem }) {
  return (
    <Link
      href={`/media/${item.id}`}
      style={{ color: "inherit", textDecoration: "none" }}
    >
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

/**
 * A poster.
 *
 * `linked` controls whether it is *itself* the anchor. `ShelfPoster` already
 * wraps it in one, and an `<a>` inside an `<a>` is invalid HTML — it also gave
 * screen-reader users the same destination twice in a row. Callers that render
 * it bare (the hero fan) opt into the link; callers that wrap it don't.
 */
function PosterCard({
  accent,
  elevated = false,
  item,
  linked = false,
  sx,
}: {
  accent?: string;
  elevated?: boolean;
  item: DiscoveryItem;
  linked?: boolean;
  sx?: object;
}) {
  const tint = accent ?? mediaAccent(item.mediaType);
  return (
    <Box
      component={linked ? "a" : "div"}
      href={linked ? `/media/${item.id}` : undefined}
      aria-label={linked ? item.title : undefined}
      sx={{
        aspectRatio: "2 / 3",
        backgroundImage: item.posterUrl
          ? `linear-gradient(180deg, transparent 58%, rgba(8,8,11,0.55)), url(${item.posterUrl})`
          : posterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: `1px solid ${alpha(tint, elevated ? 0.55 : 0.3)}`,
        borderRadius: 2,
        boxShadow: elevated
          ? `0 18px 42px rgba(0,0,0,0.55), 0 0 32px ${alpha(tint, 0.45)}`
          : `0 10px 24px rgba(0,0,0,0.45), 0 0 18px ${alpha(tint, 0.22)}`,
        display: "block",
        minWidth: 0,
        overflow: "hidden",
        position: "relative",
        textDecoration: "none",
        transition: "transform 180ms ease, box-shadow 180ms ease",
        width: "100%",
        "&:hover": {
          boxShadow: `0 22px 48px rgba(0,0,0,0.6), 0 0 38px ${alpha(tint, 0.55)}`,
          transform: "translateY(-4px)",
        },
        ...sx,
      }}
    />
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
        boxShadow: accent
          ? `0 8px 24px rgba(0,0,0,0.25), -10px 0 32px -18px ${alpha(accent, 0.6)}`
          : undefined,
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
        No {formatMediaType(mediaType).toLowerCase()} yet
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

function subgenreChipSx(active: boolean, accent: string): SxProps<Theme> {
  return {
    bgcolor: active ? alpha(accent, 0.1) : "surface.1",
    border: active
      ? `1px solid ${alpha(accent, 0.4)}`
      : "1px solid var(--mui-palette-border-subtle)",
    color: active ? accent : "text.primary",
    fontWeight: active ? 600 : 500,
    boxShadow: active ? `0 0 14px ${alpha(accent, 0.25)}` : "none",
  };
}

function getGenreWorlds(
  items: DiscoveryItem[],
  mediaType: MediaType,
  prior: number,
): GenreWorld[] {
  const worlds = new Map<string, DiscoveryItem[]>();

  for (const item of items) {
    for (const entry of item.genres) {
      const current = worlds.get(entry.genre.name) ?? [];
      current.push(item);
      worlds.set(entry.genre.name, current);
    }
  }

  const promoted = getPromotedDiscoverTagsForMediaType(mediaType);
  if (promoted.length > 0) {
    const promotedKeys = new Map(
      promoted.map((name) => [name.toLowerCase(), name]),
    );
    for (const item of items) {
      const seenThisItem = new Set<string>();
      for (const entry of item.tags) {
        if (entry.tag.status !== "APPROVED") continue;
        const canonical = promotedKeys.get(entry.tag.name.toLowerCase());
        if (!canonical) continue;
        if (seenThisItem.has(canonical)) continue;
        seenThisItem.add(canonical);
        const current = worlds.get(canonical) ?? [];
        current.push(item);
        worlds.set(canonical, current);
      }
    }
  }

  return [...worlds.entries()]
    .map(([name, worldItems]) => {
      const sortedItems = sortByScore(worldItems, prior);
      // World averageScore drives world ordering — use the shrunk rank score
      // so a world full of thin 10s doesn't outrank a world of broad 8s.
      const averageScore =
        sortedItems.reduce(
          (sum, item) => sum + discoverRankScore(item, prior),
          0,
        ) / sortedItems.length;

      return {
        name,
        count: sortedItems.length,
        averageScore,
        items: sortedItems,
        tags: getSubgenres(sortedItems, mediaType, name, prior),
      };
    })
    .sort(
      (first, second) =>
        second.averageScore - first.averageScore || second.count - first.count,
    );
}

function getSubgenres(
  items: DiscoveryItem[],
  mediaType: MediaType,
  genre: string,
  prior: number,
) {
  const tags = new Map<string, DiscoveryItem[]>();

  for (const item of items) {
    for (const entry of item.tags) {
      if (entry.tag.status !== "APPROVED") continue;
      if (entry.tag.category !== "SUBGENRE") continue;
      if (!entry.tag.discoverable) continue;
      if (!tagAllowsMediaType(entry.tag.mediaTypesJson, mediaType)) continue;
      if (!isDiscoverSubgenreForGenre(mediaType, genre, entry.tag.name)) {
        continue;
      }
      const current = tags.get(entry.tag.name) ?? [];
      current.push(item);
      tags.set(entry.tag.name, current);
    }
  }

  return [...tags.entries()]
    .map(([name, tagItems]) => ({
      name,
      count: tagItems.length,
      items: sortByScore(tagItems, prior),
    }))
    .sort((first, second) => second.count - first.count)
    .slice(0, 18);
}

function tagAllowsMediaType(
  mediaTypesJson: string | null,
  mediaType: MediaType,
) {
  if (!mediaTypesJson) return true;

  try {
    const mediaTypes = JSON.parse(mediaTypesJson);
    return Array.isArray(mediaTypes) && mediaTypes.includes(mediaType);
  } catch {
    return false;
  }
}

function getStartHere(items: DiscoveryItem[], prior: number) {
  return sortByScore(items, prior)
    .sort(
      (first, second) =>
        second.comparisonCount - first.comparisonCount ||
        discoverRankScore(second, prior) - discoverRankScore(first, prior),
    )
    .slice(0, 4);
}

function getHiddenGems(items: DiscoveryItem[]) {
  if (items.length <= 4) return items.slice(2, 6);
  return rankHiddenGems(items, { limit: 8, requireQualifies: false }).filter(
    (item) => item.hiddenGem.score > 0,
  );
}

function getRelationshipChains(items: DiscoveryItem[]) {
  const chains: Array<{ seed: DiscoveryItem; next: DiscoveryItem }> = [];

  for (let index = 0; index < Math.min(items.length - 1, 4); index += 1) {
    chains.push({ seed: items[index], next: items[index + 1] });
  }

  return chains;
}

function sortByScore(items: DiscoveryItem[], prior: number) {
  return [...items].sort(
    (first, second) =>
      discoverRankScore(second, prior) - discoverRankScore(first, prior),
  );
}

type ScorableItem = {
  computedPersonalScore: number | null;
  personalRating: number | null;
  pairwiseScore: number;
  comparisonCount?: number;
  status: import("@prisma/client").MediaStatus;
};

/**
 * Raw observed score used for display ("8.5"). Same fallback chain as before.
 * Use `discoverRankScore` for ranking — that one applies Bayesian shrinkage
 * so a single 10-rated item doesn't outrank items with broader evidence.
 */
function discoverScore(item: ScorableItem) {
  if (item.computedPersonalScore != null) return item.computedPersonalScore;
  if (item.personalRating != null) return item.personalRating;
  if (item.status === "COMPLETED") return item.pairwiseScore / 100;
  return 0;
}

/**
 * Ranking-only variant. Shrinks the discover score toward `prior` in
 * proportion to evidence (pairwise comparisons + explicit-rating presence).
 * Items with zero evidence collapse to the prior and lose ground to anything
 * that has any data.
 */
function discoverRankScore(item: ScorableItem, prior: number) {
  const observed = discoverScore(item);
  if (observed === 0) return 0;
  const evidence =
    (item.comparisonCount ?? 0) + (item.personalRating != null ? 3 : 0);
  return bayesianShrunkMean(
    observed,
    evidence,
    prior,
    TOP_RANKING.shrinkageK.personal,
  );
}

/**
 * Mean of the observed scores across the candidate pool — used as the prior
 * for `discoverRankScore`. Items with no signal contribute 0 and would skew
 * the mean low, so we average across items that have any score.
 */
function computeDiscoverPrior(items: ScorableItem[]): number {
  let sum = 0;
  let count = 0;
  for (const item of items) {
    const value = discoverScore(item);
    if (value > 0) {
      sum += value;
      count += 1;
    }
  }
  return count > 0 ? sum / count : TOP_RANKING.fallbackPrior;
}

function formatScore(item: ScorableItem) {
  const score = discoverScore(item);
  return score > 0 ? score.toFixed(1) : "Unrated";
}

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
