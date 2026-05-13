import { MediaType } from "@prisma/client";

export const VISIBLE_MEDIA_TYPES: readonly MediaType[] = [
  MediaType.MOVIE,
  MediaType.TV_SHOW,
  MediaType.VIDEO_GAME,
] as const;

export function isVisibleMediaType(
  value: string | null | undefined,
): value is MediaType {
  return VISIBLE_MEDIA_TYPES.includes(value as MediaType);
}

export function visibleMediaTypeFilter() {
  return { in: [...VISIBLE_MEDIA_TYPES] };
}
