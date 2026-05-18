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
import type { MediaItem, MediaType } from "@prisma/client";
import { alpha } from "@mui/material/styles";
import { formatMediaType } from "@/lib/format";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import { prisma } from "@/lib/prisma";
import { isDiscoverSubgenreForGenre } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type DiscoveryItem = MediaItem & {
  genres: Array<{ genre: { name: string } }>;
  tags: Array<{
    tag: {
      name: string;
      status: string;
      category: string;
      discoverable: boolean;
      mediaTypesJson: string | null;
      countryCode: string | null;
    };
  }>;
};

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

  const discoverItems = await prisma.mediaItem.findMany({
    where: {
      isArchived: false,
      mediaType: selectedType,
      ...(requestedCountry
        ? {
            tags: {
              some: {
                tag: {
                  category: "COUNTRY",
                  countryCode: requestedCountry,
                  discoverable: true,
                  status: "APPROVED",
                },
              },
            },
          }
        : {}),
    },
    include: {
      genres: { include: { genre: true } },
      tags: { include: { tag: true } },
    },
    orderBy: [
      { computedPersonalScore: "desc" },
      { personalRating: "desc" },
      { pairwiseScore: "desc" },
    ],
  });

  const genreWorlds = getGenreWorlds(discoverItems, selectedType);
  const selectedWorld =
    genreWorlds.find((world) => world.name === requestedGenre) ??
    genreWorlds[0] ??
    null;
  const selectedSubgenre =
    selectedWorld?.tags.find((tag) => tag.name === requestedSubgenre) ?? null;
  const activeItems = selectedSubgenre?.items ?? selectedWorld?.items ?? [];
  const essentials = activeItems.slice(0, 14);
  const startHere = getStartHere(activeItems);
  const hiddenGems = getHiddenGems(activeItems);
  const relationshipChains = getRelationshipChains(activeItems);
  const collections = getCollections(selectedWorld, genreWorlds, selectedType);
  const copy = discoveryCopy[selectedType] ?? discoveryCopy.MOVIE!;
  const heroTitle = selectedWorld
    ? `${selectedWorld.name} Essentials`
    : copy.headline;
  const heroDek = selectedWorld
    ? `The ${copy.noun} that make ${selectedWorld.name.toLowerCase()} feel vivid, approachable, and worth exploring deeper.`
    : copy.dek;
  const heroItems = essentials.slice(0, 5);

  return (
    <Box
      sx={{
        background:
          "radial-gradient(circle at 14% 0%, rgba(139, 92, 246, 0.18), transparent 34rem), radial-gradient(circle at 84% 4%, rgba(34, 211, 238, 0.1), transparent 30rem), linear-gradient(180deg, rgba(5, 8, 18, 0.1), rgba(5, 8, 18, 0.84) 42%, #050812)",
        mx: { xs: -1, sm: -1.5, md: -2 },
        px: { xs: 1, sm: 1.5, md: 2 },
        pb: 3,
      }}
    >
      <Stack spacing={2}>
        <Card
          variant="outlined"
          sx={{
            background: "rgba(6, 9, 18, 0.72)",
            borderColor: alpha("#FFFFFF", 0.08),
            overflow: "hidden",
          }}
        >
          <CardContent sx={{ p: { xs: 1, md: 1.25 } }}>
            <Tabs
              allowScrollButtonsMobile
              scrollButtons="auto"
              value={selectedType}
              variant="scrollable"
              sx={{
                minHeight: 36,
                "& .MuiTab-root": {
                  minHeight: 36,
                  px: 1.25,
                },
              }}
            >
              {VISIBLE_MEDIA_TYPES.map((type) => (
                <Tab
                  component="a"
                  href={topListsHref(type)}
                  key={type}
                  label={formatMediaType(type)}
                  value={type}
                />
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <HeroSection
          copy={heroDek}
          eyebrow={`${formatMediaType(selectedType)} discovery engine`}
          items={heroItems}
          title={heroTitle}
        />

        <GenreRail
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
                gap: 1.25,
                gridTemplateColumns: { xs: "1fr", lg: "1.15fr 0.85fr" },
              }}
            >
              <StartHerePanel
                genre={selectedWorld.name}
                items={startHere}
                mediaNoun={copy.noun}
              />
              <SubgenreExplorer
                selectedSubgenre={selectedSubgenre?.name ?? null}
                selectedType={selectedType}
                subgenres={selectedWorld.tags}
                genre={selectedWorld.name}
                country={requestedCountry}
              />
            </Box>

            <PosterShelf
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
                gap: 1.25,
                gridTemplateColumns: { xs: "1fr", xl: "0.9fr 1.1fr" },
              }}
            >
              <PosterShelf
                compact
                eyebrow="Worth digging for"
                grid
                items={hiddenGems}
                title="Hidden Gems"
              />
              <IfYouLikedPanel chains={relationshipChains} />
            </Box>

            <CuratedCollections
              collections={collections}
              country={requestedCountry}
              selectedType={selectedType}
            />
          </>
        ) : (
          <EmptyDiscoveryState mediaType={selectedType} />
        )}
      </Stack>
    </Box>
  );
}

function HeroSection({
  copy,
  eyebrow,
  items,
  title,
}: {
  copy: string;
  eyebrow: string;
  items: DiscoveryItem[];
  title: string;
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
            sx={{ color: alpha("#E2E8F0", 0.68), display: "block", mb: 1 }}
          >
            {eyebrow}
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily:
                'var(--font-heading), "Satoshi", "Inter", system-ui, sans-serif',
              fontSize: { xs: "2.45rem", sm: "4.8rem", md: "6.4rem" },
              fontWeight: 900,
              letterSpacing: 0,
              lineHeight: 0.86,
              maxWidth: 760,
              textWrap: "balance",
            }}
          >
            {title}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{
              fontSize: { xs: "0.98rem", md: "1.12rem" },
              lineHeight: 1.55,
              maxWidth: 560,
              mt: 1.5,
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
              xs: "repeat(5, minmax(52px, 1fr))",
              sm: "repeat(5, minmax(84px, 1fr))",
            },
            minHeight: { xs: 168, sm: 240, md: 430 },
            position: "relative",
          }}
        >
          <Box
            sx={{
              background:
                "radial-gradient(circle at 50% 52%, rgba(139, 92, 246, 0.3), transparent 24rem)",
              filter: "blur(2px)",
              inset: 0,
              position: "absolute",
            }}
          />
          {items.map((item, index) => (
            <PosterCard
              elevated={index === 2}
              item={item}
              key={item.id}
              sx={{
                mt: index % 2 === 0 ? { xs: 0, md: -5 } : { xs: 2, md: 8 },
                transform: {
                  xs: `rotate(${[-4, 3, -1, 4, -3][index] ?? 0}deg)`,
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
  country,
  genres,
  selectedGenre,
  selectedType,
}: {
  country?: string | null;
  genres: GenreWorld[];
  selectedGenre: string | null;
  selectedType: MediaType;
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="eyebrow">Choose a world</Typography>
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
          .map((genre) => (
            <Chip
              clickable
              component="a"
              href={topListsHref(selectedType, genre.name, null, country)}
              key={genre.name}
              label={genre.name}
              sx={{
                bgcolor:
                  selectedGenre === genre.name
                    ? alpha("#8B5CF6", 0.36)
                    : alpha("#FFFFFF", 0.055),
                border: `1px solid ${
                  selectedGenre === genre.name
                    ? alpha("#A78BFA", 0.36)
                    : alpha("#FFFFFF", 0.1)
                }`,
                color: "text.primary",
                flex: "0 0 auto",
              }}
            />
          ))}
      </Box>
    </Stack>
  );
}

function StartHerePanel({
  genre,
  items,
  mediaNoun,
}: {
  genre: string;
  items: DiscoveryItem[];
  mediaNoun: string;
}) {
  return (
    <DiscoveryPanel>
      <Typography variant="eyebrow">Start here</Typography>
      <Typography component="h2" sx={sectionTitleSx}>
        Gateway {mediaNoun} for {genre.toLowerCase()}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 0.8,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
          mt: 1.25,
        }}
      >
        {items.map((item, index) => (
          <GatewayCard index={index} item={item} key={item.id} />
        ))}
      </Box>
      {items.length === 0 ? <EmptyText>No entries yet.</EmptyText> : null}
    </DiscoveryPanel>
  );
}

function GatewayCard({ index, item }: { index: number; item: DiscoveryItem }) {
  return (
    <Box
      component="a"
      href={`/media/${item.id}`}
      sx={{
        alignItems: "center",
        background:
          "linear-gradient(135deg, rgba(15, 20, 38, 0.78), rgba(6, 9, 18, 0.9))",
        border: `1px solid ${alpha("#FFFFFF", 0.08)}`,
        borderRadius: "8px",
        color: "inherit",
        display: "grid",
        gap: 0.8,
        gridTemplateColumns: "58px 1fr auto",
        minHeight: 86,
        overflow: "hidden",
        p: 0.75,
        textDecoration: "none",
        transition: "border-color 160ms ease, transform 160ms ease",
        "&:hover": {
          borderColor: alpha("#A78BFA", 0.34),
          transform: "translateY(-2px)",
        },
      }}
    >
      <MiniPoster item={item} />
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 850, lineHeight: 1.15 }}>
          {item.title}
        </Typography>
        <Typography color="text.secondary" noWrap variant="body2">
          {item.tags
            .map((entry) => entry.tag.name)
            .slice(0, 2)
            .join(" / ") || "Essential entry point"}
        </Typography>
      </Box>
      <Typography sx={{ color: alpha("#FFFFFF", 0.36), fontWeight: 900 }}>
        {String(index + 1).padStart(2, "0")}
      </Typography>
    </Box>
  );
}

function SubgenreExplorer({
  country,
  genre,
  selectedSubgenre,
  selectedType,
  subgenres,
}: {
  country?: string | null;
  genre: string;
  selectedSubgenre: string | null;
  selectedType: MediaType;
  subgenres: Subgenre[];
}) {
  return (
    <DiscoveryPanel>
      <Typography variant="eyebrow">Subgenre explorer</Typography>
      <Typography component="h2" sx={sectionTitleSx}>
        Go deeper than {genre.toLowerCase()}
      </Typography>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mt: 1.25 }}>
        <Chip
          clickable
          component="a"
          href={topListsHref(selectedType, genre, null, country)}
          label="All essentials"
          sx={subgenreChipSx(!selectedSubgenre)}
        />
        {subgenres.slice(0, 14).map((tag) => (
          <Chip
            clickable
            component="a"
            href={topListsHref(selectedType, genre, tag.name, country)}
            key={tag.name}
            label={tag.name}
            sx={subgenreChipSx(selectedSubgenre === tag.name)}
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
  compact = false,
  eyebrow,
  grid = false,
  items,
  title,
}: {
  compact?: boolean;
  eyebrow: string;
  grid?: boolean;
  items: DiscoveryItem[];
  title: string;
}) {
  return (
    <DiscoveryPanel>
      <Typography variant="eyebrow">{eyebrow}</Typography>
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
          <ShelfPoster item={item} key={item.id} rank={index + 1} />
        ))}
      </Box>
      {items.length === 0 ? <EmptyText>No entries yet.</EmptyText> : null}
    </DiscoveryPanel>
  );
}

function ShelfPoster({ item, rank }: { item: DiscoveryItem; rank: number }) {
  return (
    <Box
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
            background: alpha("#050812", 0.78),
            border: `1px solid ${alpha("#FFFFFF", 0.14)}`,
            borderRadius: "6px",
            display: "flex",
            fontSize: 11,
            fontWeight: 900,
            height: 26,
            justifyContent: "center",
            left: 8,
            position: "absolute",
            top: 8,
            width: 30,
          }}
        >
          {rank}
        </Box>
      </Box>
      <Typography noWrap sx={{ fontWeight: 800, mt: 0.7 }}>
        {item.title}
      </Typography>
      <Typography color="text.secondary" noWrap variant="caption">
        {formatScore(item)}
      </Typography>
    </Box>
  );
}

function IfYouLikedPanel({
  chains,
}: {
  chains: Array<{ seed: DiscoveryItem; next: DiscoveryItem }>;
}) {
  return (
    <DiscoveryPanel>
      <Typography variant="eyebrow">Recommendation pathways</Typography>
      <Typography component="h2" sx={sectionTitleSx}>
        If You Liked...
      </Typography>
      <Stack spacing={0.8} sx={{ mt: 1.25 }}>
        {chains.map((chain) => (
          <Box
            key={`${chain.seed.id}-${chain.next.id}`}
            sx={{
              alignItems: "center",
              background: alpha("#FFFFFF", 0.045),
              border: `1px solid ${alpha("#FFFFFF", 0.08)}`,
              borderRadius: "8px",
              display: "grid",
              gap: 0.8,
              gridTemplateColumns: {
                xs: "38px minmax(0, 1fr) 30px 38px minmax(0, 1fr)",
                sm: "48px 1fr auto 48px 1fr",
              },
              p: 0.7,
            }}
          >
            <MiniPoster item={chain.seed} />
            <Typography noWrap sx={{ fontWeight: 800 }}>
              {chain.seed.title}
            </Typography>
            <Typography color="text.secondary" sx={{ fontWeight: 900 }}>
              then
            </Typography>
            <MiniPoster item={chain.next} />
            <Typography noWrap sx={{ fontWeight: 800 }}>
              {chain.next.title}
            </Typography>
          </Box>
        ))}
      </Stack>
      {chains.length === 0 ? (
        <EmptyText>More rated entries will create pathways here.</EmptyText>
      ) : null}
    </DiscoveryPanel>
  );
}

function CuratedCollections({
  collections,
  country,
  selectedType,
}: {
  collections: Array<{ title: string; description: string; genre: string }>;
  country?: string | null;
  selectedType: MediaType;
}) {
  return (
    <DiscoveryPanel>
      <Typography variant="eyebrow">Curated collections</Typography>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
          mt: 1,
        }}
      >
        {collections.map((collection) => (
          <Box
            component="a"
            href={topListsHref(selectedType, collection.genre, null, country)}
            key={collection.title}
            sx={{
              background:
                "linear-gradient(145deg, rgba(139, 92, 246, 0.16), rgba(34, 211, 238, 0.055) 45%, rgba(6, 9, 18, 0.88))",
              border: `1px solid ${alpha("#FFFFFF", 0.08)}`,
              borderRadius: "8px",
              color: "inherit",
              minHeight: 142,
              p: 1.15,
              textDecoration: "none",
              transition: "border-color 160ms ease, transform 160ms ease",
              "&:hover": {
                borderColor: alpha("#A78BFA", 0.34),
                transform: "translateY(-2px)",
              },
            }}
          >
            <Typography variant="eyebrow">{collection.genre}</Typography>
            <Typography sx={{ fontSize: "1.05rem", fontWeight: 900, mt: 2 }}>
              {collection.title}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.6 }} variant="body2">
              {collection.description}
            </Typography>
          </Box>
        ))}
      </Box>
    </DiscoveryPanel>
  );
}

function PosterCard({
  elevated = false,
  item,
  sx,
}: {
  elevated?: boolean;
  item: DiscoveryItem;
  sx?: object;
}) {
  return (
    <Box
      component="a"
      href={`/media/${item.id}`}
      sx={{
        aspectRatio: "2 / 3",
        backgroundImage: item.posterUrl
          ? `linear-gradient(180deg, transparent 58%, ${alpha("#050812", 0.62)}), url(${item.posterUrl})`
          : posterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        border: `1px solid ${alpha("#FFFFFF", elevated ? 0.18 : 0.1)}`,
        borderRadius: "8px",
        boxShadow: elevated
          ? `0 28px 90px ${alpha("#000000", 0.62)}, 0 0 54px ${alpha("#8B5CF6", 0.3)}`
          : `0 18px 54px ${alpha("#000000", 0.42)}`,
        display: "block",
        minWidth: 0,
        overflow: "hidden",
        position: "relative",
        textDecoration: "none",
        transition: "transform 180ms ease, box-shadow 180ms ease",
        width: "100%",
        "&:hover": {
          boxShadow: `0 26px 80px ${alpha("#000000", 0.58)}, 0 0 42px ${alpha("#22D3EE", 0.18)}`,
          transform: "translateY(-4px)",
        },
        ...sx,
      }}
    />
  );
}

function MiniPoster({ item }: { item: DiscoveryItem }) {
  return (
    <Box
      sx={{
        aspectRatio: "2 / 3",
        backgroundImage: item.posterUrl
          ? `url(${item.posterUrl})`
          : posterFallback(item.mediaType),
        backgroundPosition: "center",
        backgroundSize: "cover",
        borderRadius: "6px",
        boxShadow: `inset 0 0 0 1px ${alpha("#FFFFFF", 0.08)}`,
        width: "100%",
      }}
    />
  );
}

function DiscoveryPanel({ children }: { children: React.ReactNode }) {
  return (
    <Card
      variant="outlined"
      sx={{
        background:
          "linear-gradient(145deg, rgba(11, 16, 32, 0.8), rgba(6, 9, 18, 0.94))",
        borderColor: alpha("#FFFFFF", 0.075),
        height: "100%",
      }}
    >
      <CardContent sx={{ p: { xs: 1.2, md: 1.45 } }}>{children}</CardContent>
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

const sectionTitleSx = {
  fontFamily: 'var(--font-heading), "Satoshi", "Inter", system-ui, sans-serif',
  fontSize: { xs: "1.35rem", md: "1.65rem" },
  fontWeight: 900,
  letterSpacing: 0,
  lineHeight: 1,
  mt: 0.5,
};

function subgenreChipSx(active: boolean) {
  return {
    bgcolor: active ? alpha("#22D3EE", 0.18) : alpha("#FFFFFF", 0.055),
    border: `1px solid ${active ? alpha("#22D3EE", 0.34) : alpha("#FFFFFF", 0.1)}`,
    color: "text.primary",
  };
}

function getGenreWorlds(
  items: DiscoveryItem[],
  mediaType: MediaType,
): GenreWorld[] {
  const worlds = new Map<string, DiscoveryItem[]>();

  for (const item of items) {
    for (const entry of item.genres) {
      const current = worlds.get(entry.genre.name) ?? [];
      current.push(item);
      worlds.set(entry.genre.name, current);
    }
  }

  return [...worlds.entries()]
    .map(([name, worldItems]) => {
      const sortedItems = sortByScore(worldItems);
      const averageScore =
        sortedItems.reduce((sum, item) => sum + discoverScore(item), 0) /
        sortedItems.length;

      return {
        name,
        count: sortedItems.length,
        averageScore,
        items: sortedItems,
        tags: getSubgenres(sortedItems, mediaType, name),
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
      items: sortByScore(tagItems),
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

function getStartHere(items: DiscoveryItem[]) {
  return sortByScore(items)
    .sort(
      (first, second) =>
        second.comparisonCount - first.comparisonCount ||
        discoverScore(second) - discoverScore(first),
    )
    .slice(0, 4);
}

function getHiddenGems(items: DiscoveryItem[]) {
  if (items.length <= 4) return items.slice(2, 6);
  const medianComparisons = [...items]
    .map((item) => item.comparisonCount)
    .sort((a, b) => a - b)[Math.floor(items.length / 2)];

  return sortByScore(
    items.filter((item) => item.comparisonCount <= medianComparisons),
  ).slice(0, 8);
}

function getRelationshipChains(items: DiscoveryItem[]) {
  const chains: Array<{ seed: DiscoveryItem; next: DiscoveryItem }> = [];

  for (let index = 0; index < Math.min(items.length - 1, 4); index += 1) {
    chains.push({ seed: items[index], next: items[index + 1] });
  }

  return chains;
}

function getCollections(
  selectedWorld: GenreWorld | null,
  genreWorlds: GenreWorld[],
  mediaType: MediaType,
) {
  const fallbackGenres = genreWorlds.slice(0, 4).map((world) => world.name);
  const primary = selectedWorld?.name ?? fallbackGenres[0] ?? "Essentials";
  const secondary =
    fallbackGenres.find((genre) => genre !== primary) ?? primary;
  const tertiary =
    fallbackGenres.find((genre) => genre !== primary && genre !== secondary) ??
    primary;
  const noun =
    mediaType === "VIDEO_GAME"
      ? "Games"
      : mediaType === "TV_SHOW"
        ? "Series"
        : "Movies";

  return [
    {
      genre: primary,
      title: `Best First ${primary} ${noun}`,
      description: "Approachable entries that make the genre click quickly.",
    },
    {
      genre: primary,
      title: `Essential ${primary} Canon`,
      description: "The definitive works that anchor the whole conversation.",
    },
    {
      genre: secondary,
      title: `Deep ${secondary} Cuts`,
      description: "Strong picks beyond the obvious first shelf.",
    },
    {
      genre: tertiary,
      title: `${tertiary} Worlds Worth Entering`,
      description: "A focused path into another high-performing lane.",
    },
  ];
}

function sortByScore(items: DiscoveryItem[]) {
  return [...items].sort(
    (first, second) => discoverScore(second) - discoverScore(first),
  );
}

function discoverScore(
  item: Pick<
    MediaItem,
    "computedPersonalScore" | "personalRating" | "pairwiseScore" | "status"
  >,
) {
  if (item.computedPersonalScore != null) return item.computedPersonalScore;
  if (item.personalRating != null) return item.personalRating;
  if (item.status === "COMPLETED") return item.pairwiseScore / 100;
  return 0;
}

function formatScore(
  item: Pick<
    MediaItem,
    "computedPersonalScore" | "personalRating" | "pairwiseScore" | "status"
  >,
) {
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

function posterFallback(mediaType: MediaType) {
  const label =
    mediaType === "VIDEO_GAME"
      ? "linear-gradient(145deg, #122218, #0B1020 44%, #1A1230)"
      : mediaType === "TV_SHOW"
        ? "linear-gradient(145deg, #111A2E, #0B1020 48%, #251233)"
        : "linear-gradient(145deg, #221225, #0B1020 46%, #122433)";

  return `${label}`;
}
