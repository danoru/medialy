export function formatMediaType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => {
      if (part === "tv") return "TV";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function formatStatus(value: string) {
  return formatMediaType(value);
}

const MEDIA_TYPE_SINGULAR: Record<string, string> = {
  MOVIE: "movie",
  TV_SHOW: "TV show",
  VIDEO_GAME: "game",
  BOOK: "book",
  BOARD_GAME: "board game",
  MUSIC: "album",
  MUSICAL: "musical",
};

const MEDIA_TYPE_PLURAL: Record<string, string> = {
  MOVIE: "movies",
  TV_SHOW: "TV shows",
  VIDEO_GAME: "games",
  BOOK: "books",
  BOARD_GAME: "board games",
  MUSIC: "albums",
  MUSICAL: "musicals",
};

export function mediaTypeNoun(mediaType: string, count: number): string {
  if (count === 1) return MEDIA_TYPE_SINGULAR[mediaType] ?? "title";
  return MEDIA_TYPE_PLURAL[mediaType] ?? "titles";
}
