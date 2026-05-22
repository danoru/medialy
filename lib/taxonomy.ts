import type { MediaType } from "@prisma/client";

export const SCREEN_MEDIA_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Horror",
  "Musical",
  "Mystery",
  "Reality",
  "Romance",
  "Science Fiction",
  "Sports",
  "Thriller",
  "War",
  "Western",
] as const;

export type ScreenMediaGenre = (typeof SCREEN_MEDIA_GENRES)[number];

export const GAME_GENRES = [
  "Action",
  "Adventure",
  "Casual",
  "Fighting",
  "Horror",
  "Platformer",
  "Puzzle",
  "Racing",
  "Rhythm",
  "RPG",
  "Shooter",
  "Simulation",
  "Sports",
  "Strategy",
  "Survival",
  "Visual Novel",
] as const;

export type GameGenre = (typeof GAME_GENRES)[number];

export const MAX_GENRES_PER_ITEM = 3;

export const TAG_CATEGORIES = [
  "SUBGENRE",
  "COUNTRY",
  "THEME",
  "MECHANIC",
  "MOOD",
  "FORMAT",
] as const;

export type TagCategory = (typeof TAG_CATEGORIES)[number];

export type CanonicalTagMetadata = {
  category: TagCategory;
  discoverable: boolean;
  mediaTypes?: MediaType[];
  countryCode?: string;
};

export type CanonicalTagDefinition = CanonicalTagMetadata & {
  name: string;
  normalizedName: string;
};

type DiscoverSubgenreMap = Partial<
  Record<MediaType, Record<string, readonly string[]>>
>;

export const DISCOVER_SUBGENRES: DiscoverSubgenreMap = {
  MOVIE: {
    Action: ["Disaster", "Martial Arts"],
    Adventure: ["Quest", "Urban Adventure"],
    Animation: [
      "Anime",
      "Computer Animation",
      "Rotoscope",
      "Stop Motion",
      "Traditional Animation",
    ],
    Comedy: [
      "Absurdist Comedy",
      "Buddy Comedy",
      "Dark Comedy",
      "Romantic Comedy",
      "Parody",
      "Quirky Comedy",
      "Satire",
      "Screwball Comedy",
      "Slapstick",
    ],
    Crime: ["Caper", "Detective", "Gangster", "Police"],
    Documentary: ["Docudrama"],
    Drama: [
      "Docudrama",
      "Legal Drama",
      "Historical Drama",
      "Period Drama",
      "Tragedy",
    ],
    Family: [],
    Fantasy: [
      "Dark Fantasy",
      "Fairy Tail",
      "High Fantasy",
      "Superhero",
      "Sword & Sorcery",
      "Steampunk",
      "Urban Fantasy",
    ],
    Horror: [
      "Body Horror",
      "Folk Horror",
      "Found Footage",
      "Monster Horror",
      "Psychological Horror",
      "Slasher",
    ],
    Musical: ["Jukebox Musical"],
    Mystery: ["Whodunit"],
    Romance: ["Romantic Comedy", "Tragic Romance"],
    "Science Fiction": [
      "Alternate History",
      "Cyberpunk",
      "Dystopian",
      "Kaiju",
      "Post Apocalyptic",
      "Space Opera",
    ],
    Sports: ["Baseball", "Football", "Motorsports", "Table Tennis"],
    Thriller: ["Conspiracy Thriller", "Psychological Thriller"],
    War: [],
    Western: [],
  },
  TV_SHOW: {
    Action: ["Disaster", "Martial Arts"],
    Adventure: ["Quest", "Urban Adventure"],
    Animation: [
      "Anime",
      "Computer Animation",
      "Rotoscope",
      "Stop Motion",
      "Traditional Animation",
    ],
    Comedy: [
      "Absurdist Comedy",
      "Buddy Comedy",
      "Dark Comedy",
      "Romantic Comedy",
      "Parody",
      "Quirky Comedy",
      "Satire",
      "Situational Comedy",
      "Slapstick",
      "Workplace Comedy",
    ],
    Crime: ["Caper", "Detective", "Gangster", "Police", "True Crime"],
    Documentary: ["Biography"],
    Drama: [
      "Docudrama",
      "Legal Drama",
      "Historical Drama",
      "Period Drama",
      "Workplace Drama",
    ],
    Family: [],
    Fantasy: [
      "Dark Fantasy",
      "Fairy Tail",
      "High Fantasy",
      "Superhero",
      "Sword & Sorcery",
      "Steampunk",
      "Urban Fantasy",
    ],
    Horror: [
      "Body Horror",
      "Folk Horror",
      "Found Footage",
      "Monster Horror",
      "Psychological Horror",
      "Slasher",
    ],
    Musical: ["Jukebox Musical"],
    Mystery: [],
    Reality: ["Reality Competition"],
    Romance: ["Romantic Comedy", "Tragic Romance"],
    "Science Fiction": [
      "Alternate History",
      "Cyberpunk",
      "Dystopian",
      "Post Apocalyptic",
      "Space Opera",
    ],
    Sports: ["Baseball", "Football", "Motorsports", "Table Tennis"],
    Thriller: ["Psychological Thriller"],
    War: [],
    Western: [],
  },
  VIDEO_GAME: {
    Action: ["Beat-Em Up", "Hack and Slash", "Stealth", "Stylish Action"],
    Adventure: ["Metroidvania", "Open World"],
    Casual: ["Arcade", "Party"],
    Fighting: ["Brawler"],
    Horror: ["Survival Horror"],
    Platformer: ["Metroidvania"],
    Puzzle: [],
    Racing: ["Kart", "Simulation"],
    Rhythm: ["Music"],
    RPG: ["Action RPG", "Roguelike", "Soulslike", "Turn-Based RPG"],
    Shooter: [
      "First Person Shooter",
      "Looter Shooter",
      "Tactical Shooter",
      "Third Person Shooter",
    ],
    Simulation: [],
    Sports: [],
    Strategy: [
      "4X",
      "Auto Battler",
      "Deckbuilder",
      "Card Battler",
      "Real-Time Strategy",
      "Tactics",
    ],
    Survival: ["Crafting", "Survival Horror"],
    "Visual Novel": [],
  },
};

const screenMediaTypes = new Set<MediaType>(["MOVIE", "TV_SHOW"]);
const gameMediaTypes = new Set<MediaType>(["VIDEO_GAME"]);
const validMediaTypes = new Set<string>([
  "MOVIE",
  "TV_SHOW",
  "VIDEO_GAME",
  "BOOK",
  "BOARD_GAME",
  "MUSIC",
  "MUSICAL",
]);
const tvOnlyGenres = new Set(["Reality"]);
const canonicalGenreByKey = new Map<string, string>(
  [...SCREEN_MEDIA_GENRES, ...GAME_GENRES].map((genre) => [
    normalizeTaxonomyKey(genre),
    genre,
  ]),
);

const genreAliases = new Map<string, string>([
  ["sci fi", "Science Fiction"],
  ["sci-fi", "Science Fiction"],
  ["science-fiction", "Science Fiction"],
  ["science fiction action", "Science Fiction"],
  ["scifi", "Science Fiction"],
  ["romcom", "Romance"],
  ["rom com", "Romance"],
  ["kids", "Family"],
  ["children", "Family"],
  ["childrens", "Family"],
  ["role playing", "RPG"],
  ["role-playing", "RPG"],
  ["party", "Casual"],
  ["party game", "Casual"],
]);

const tagAliases = new Map<string, string>([
  ["animated", "Animation"],
  ["body-horror", "Body Horror"],
  ["cyber punk", "Cyberpunk"],
  ["cyber-punk", "Cyberpunk"],
  ["japanese", "Japan"],
  ["japan", "Japan"],
  ["jp", "Japan"],
  ["korean", "South Korea"],
  ["south korean", "South Korea"],
  ["turn based rpg", "Turn-Based RPG"],
  ["turn-based-rpg", "Turn-Based RPG"],
  ["sci fi", "Sci-Fi"],
  ["scifi", "Sci-Fi"],
  ["science fiction", "Science Fiction"],
  ["found-family", "Found Family"],
  ["souls like", "Soulslike"],
  ["soul like", "Soulslike"],
  ["rogue like", "Roguelike"],
]);

const countryTagsByKey = new Map<string, { name: string; countryCode: string }>(
  [
    ["france", { name: "France", countryCode: "FR" }],
    ["japan", { name: "Japan", countryCode: "JP" }],
    ["indonesia", { name: "Indonesia", countryCode: "ID" }],
    ["newzealand", { name: "New Zealand", countryCode: "NZ" }],
    ["southkorea", { name: "South Korea", countryCode: "KR" }],
    ["unitedkingdom", { name: "United Kingdom", countryCode: "GB" }],
    ["unitedstates", { name: "United States", countryCode: "US" }],
  ],
);

const titleCaseExceptions = new Set([
  "4X",
  "JRPG",
  "RPG",
  "Sci-Fi",
  "Turn-Based RPG",
]);

export function getGenresForMediaType(mediaType: MediaType) {
  if (screenMediaTypes.has(mediaType))
    return [...SCREEN_MEDIA_GENRES] as string[];
  if (gameMediaTypes.has(mediaType)) return [...GAME_GENRES] as string[];
  return [];
}

export function normalizeGenreName(value: string, mediaType: MediaType) {
  const normalized = normalizeName(value);
  if (!normalized) return null;

  const aliased = genreAliases.get(normalized.toLowerCase()) ?? normalized;
  const canonical = canonicalGenreByKey.get(normalizeTaxonomyKey(aliased));
  if (!canonical) return null;
  if (tvOnlyGenres.has(canonical) && mediaType !== "TV_SHOW") return null;

  return getGenresForMediaType(mediaType).includes(canonical)
    ? canonical
    : null;
}

export function normalizeExternalGenres(
  mediaType: MediaType,
  externalGenres: string[],
) {
  return splitGenresAndTags(mediaType, externalGenres);
}

export function splitGenresAndTags(
  mediaType: MediaType,
  incomingValues: string[],
) {
  const genres: string[] = [];
  const tags: string[] = [];

  for (const value of incomingValues) {
    const genre = normalizeGenreName(value, mediaType);
    if (genre) {
      if (!genres.includes(genre) && genres.length < MAX_GENRES_PER_ITEM) {
        genres.push(genre);
      }
    } else {
      const tag = normalizeTagName(value);
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
  }

  return { genres, tags };
}

export function normalizeGenresForMediaType(
  mediaType: MediaType,
  values: string[],
) {
  const genres = values
    .map((value) => normalizeGenreName(value, mediaType))
    .filter((value): value is string => Boolean(value));

  return [...new Set(genres)].slice(0, MAX_GENRES_PER_ITEM);
}

export function normalizeTagName(value: string) {
  const raw = normalizeName(value.replace(/[_/]+/g, " ").replace(/-+/g, " "));
  if (!raw) return "";

  const aliased = tagAliases.get(raw.toLowerCase()) ?? raw;
  if (titleCaseExceptions.has(aliased)) return aliased;
  if (isAllCapsTag(aliased)) return aliased;
  if (aliased.toLowerCase() === "sci fi") return "Sci-Fi";

  return aliased
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      if (["rpg", "vr"].includes(lower)) return lower.toUpperCase();
      if (lower === "sci-fi") return "Sci-Fi";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function normalizeTagKey(value: string) {
  return normalizeTaxonomyKey(normalizeTagName(value));
}

export function canonicalTagMetadataForName(
  value: string,
): CanonicalTagMetadata | null {
  const definition = canonicalTagDefinitionForName(value);
  if (!definition) return null;

  return {
    category: definition.category,
    discoverable: definition.discoverable,
    mediaTypes: definition.mediaTypes,
    countryCode: definition.countryCode,
  };
}

export function canonicalTagDefinitionForName(
  value: string,
): CanonicalTagDefinition | null {
  const key = normalizeTagKey(value);
  return (
    getCanonicalTagDefinitions().find(
      (definition) => definition.normalizedName === key,
    ) ?? null
  );
}

export function isTagApplicableForMediaType(
  value: string,
  mediaType: MediaType,
) {
  const definition = canonicalTagDefinitionForName(value);
  if (!definition) return false;
  return (
    !definition.mediaTypes ||
    definition.mediaTypes.length === 0 ||
    definition.mediaTypes.includes(mediaType)
  );
}

export function mediaTypesFromJson(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is MediaType =>
      validMediaTypes.has(String(entry)),
    );
  } catch {
    return [];
  }
}

export function tagMetadataAllowsMediaType(
  mediaTypesJson: string | null | undefined,
  mediaType: MediaType,
) {
  const mediaTypes = mediaTypesFromJson(mediaTypesJson);
  return mediaTypes.length === 0 || mediaTypes.includes(mediaType);
}

export function normalizeCanonicalTagsForMediaType(
  mediaType: MediaType,
  values: string[],
) {
  const tags: string[] = [];

  for (const value of values) {
    const definition = canonicalTagDefinitionForName(value);
    if (!definition) {
      throw new Error(`Invalid canonical tag: ${value}`);
    }
    if (!isTagApplicableForMediaType(definition.name, mediaType)) {
      throw new Error(`Invalid tag for ${mediaType}: ${value}`);
    }
    if (!tags.includes(definition.name)) tags.push(definition.name);
  }

  return tags;
}

const explicitCanonicalTags: CanonicalTagDefinition[] = [
  {
    name: "Animation",
    normalizedName: normalizeTagKey("Animation"),
    category: "FORMAT",
    discoverable: true,
    mediaTypes: ["MOVIE", "TV_SHOW"],
  },
  {
    name: "Indie",
    normalizedName: normalizeTagKey("Indie"),
    category: "FORMAT",
    discoverable: true,
    mediaTypes: ["MOVIE", "TV_SHOW", "VIDEO_GAME"],
  },
];

const promotedDiscoverTagsByMediaType: Partial<Record<MediaType, string[]>> = {
  MOVIE: ["Animation", "Indie"],
  TV_SHOW: ["Animation", "Indie"],
  VIDEO_GAME: ["Indie"],
};

export function getPromotedDiscoverTagsForMediaType(mediaType: MediaType) {
  return [...(promotedDiscoverTagsByMediaType[mediaType] ?? [])];
}

export function isPromotedDiscoverTag(mediaType: MediaType, tagName: string) {
  const key = normalizeTagKey(tagName);
  return getPromotedDiscoverTagsForMediaType(mediaType).some(
    (name) => normalizeTagKey(name) === key,
  );
}

export function getCanonicalTagDefinitions(): CanonicalTagDefinition[] {
  const namesByKey = new Map<string, string>();

  for (const genreMap of Object.values(DISCOVER_SUBGENRES)) {
    for (const tags of Object.values(genreMap)) {
      for (const tag of tags) {
        namesByKey.set(normalizeTagKey(tag), tag);
      }
    }
  }

  for (const country of countryTagsByKey.values()) {
    namesByKey.set(normalizeTagKey(country.name), country.name);
  }

  const explicitByKey = new Map(
    explicitCanonicalTags.map((tag) => [tag.normalizedName, tag]),
  );
  for (const tag of explicitCanonicalTags) {
    namesByKey.set(tag.normalizedName, tag.name);
  }

  return [...namesByKey.entries()]
    .map(([normalizedName, name]) => {
      const explicit = explicitByKey.get(normalizedName);
      if (explicit) return explicit;

      const country = countryTagsByKey.get(normalizedName);

      if (country) {
        return {
          name: country.name,
          normalizedName,
          category: "COUNTRY",
          discoverable: true,
          countryCode: country.countryCode,
        } satisfies CanonicalTagDefinition;
      }

      return {
        name,
        normalizedName,
        category: "SUBGENRE",
        discoverable: true,
        mediaTypes: mediaTypesForDiscoverSubgenre(name),
      } satisfies CanonicalTagDefinition;
    })
    .sort((first, second) => first.name.localeCompare(second.name));
}

export function getDiscoverSubgenresForGenre(
  mediaType: MediaType,
  genre: string,
) {
  return [...(DISCOVER_SUBGENRES[mediaType]?.[genre] ?? [])];
}

export function isDiscoverSubgenreForGenre(
  mediaType: MediaType,
  genre: string,
  tagName: string,
) {
  const key = normalizeTagKey(tagName);
  return getDiscoverSubgenresForGenre(mediaType, genre).some(
    (name) => normalizeTagKey(name) === key,
  );
}

function mediaTypesForDiscoverSubgenre(tagName: string) {
  const key = normalizeTagKey(tagName);
  const mediaTypes = Object.entries(DISCOVER_SUBGENRES)
    .filter(([, genreMap]) =>
      Object.values(genreMap).some((tags) =>
        tags.some((name) => normalizeTagKey(name) === key),
      ),
    )
    .map(([mediaType]) => mediaType as MediaType);

  return [...new Set(mediaTypes)];
}

function normalizeTaxonomyKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function isAllCapsTag(value: string) {
  return /^[A-Z0-9]+$/.test(value);
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
