import type { MediaType } from "@prisma/client";

import { mediaTypeTabIndicatorColor } from "@/lib/media-ui-helpers";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.substring(0, 2), 16),
    g: Number.parseInt(normalized.substring(2, 4), 16),
    b: Number.parseInt(normalized.substring(4, 6), 16),
  };
}

/**
 * Drives the body's top-left ambient radial gradient via CSS variables on
 * `:root`. Pages with media-type tabs render this with their selected type so
 * the page chrome glow matches the content (pink for Movies, lavender for TV,
 * teal for Games). When `mediaType` is null the tint falls back to brand peach.
 */
export function PageAccentBackground({
  mediaType,
}: {
  mediaType: MediaType | null;
}) {
  const { r, g, b } = hexToRgb(mediaTypeTabIndicatorColor(mediaType));
  return (
    <style>{`:root { --page-accent-r: ${r}; --page-accent-g: ${g}; --page-accent-b: ${b}; }`}</style>
  );
}
