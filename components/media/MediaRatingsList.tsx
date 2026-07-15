"use client";

import { Box, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { MediaStatus, MediaType } from "@prisma/client";
import Link from "next/link";
import { updateMediaRating } from "@/app/media/actions";
import { PosterThumb } from "@/components/media/PosterCard";
import { StarRating } from "@/components/media/StarRating";
import { formatMediaType } from "@/lib/format";
import { mediaAccent } from "@/lib/media-ui-helpers";
import { statusLabel } from "@/lib/status-labels";

export type MediaRatingsListItem = {
  id: string;
  title: string;
  mediaType: MediaType;
  status: MediaStatus;
  personalRating: number | null;
  computedPersonalScore: number | null;
  computedConsensusScore: number | null;
  isFavorite: boolean;
  isArchived: boolean;
  posterUrl: string | null;
  genres: string[];
  tags: string[];
};

/**
 * One responsive row layout for the library list.
 *
 * This replaces the previous pair of components (a desktop `<Table>` and a
 * mobile card list) which were *both* rendered into the DOM and toggled with
 * `display` — so a phone downloaded 50 table rows it would never show, and the
 * page carried 100 rating inputs for 50 items.
 *
 * Rating is inline and saves on tap: no batch "Save ratings" button, and no
 * follow-up status prompt (rating an untracked item marks it watched server-side).
 */
export function MediaRatingsList({
  canRate,
  items,
}: {
  canRate: boolean;
  items: MediaRatingsListItem[];
}) {
  return (
    <Stack sx={{ p: { xs: 1, md: 0 } }}>
      {items.map((item, index) => {
        const accent = mediaAccent(item.mediaType);
        return (
          <Box
            key={item.id}
            sx={{
              background: `linear-gradient(90deg, ${alpha(accent, 0.05)} 0%, transparent 20%)`,
              borderColor: "divider",
              borderLeft: `2px solid ${accent}`,
              borderTop: index === 0 ? 0 : "1px solid",
              display: "grid",
              gap: { xs: 1, md: 2 },
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(0, 2.2fr) minmax(0, 1.4fr) auto auto",
              },
              alignItems: { md: "center" },
              px: { xs: 1, md: 2 },
              py: { xs: 1.25, md: 1.5 },
            }}
          >
            {/* Title + poster + state chips */}
            <Stack direction="row" spacing={1.25} sx={{ minWidth: 0 }}>
              <PosterThumb item={item} size="sm" />
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                {/* The title is the primary tap target for the whole row, so it
                    gets a real 44px-tall hit area rather than the ~19px the
                    bare text line would give it. */}
                <Box
                  component={Link}
                  href={`/media/${item.id}`}
                  sx={{
                    alignItems: "center",
                    color: "text.primary",
                    display: "flex",
                    minHeight: 44,
                    textDecoration: "none",
                    "&:hover": { color: "primary.main" },
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 600,
                      lineHeight: 1.25,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.title}
                  </Typography>
                </Box>
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
                  <Chip label={formatMediaType(item.mediaType)} size="small" />
                  <Chip
                    label={statusLabel(item.status, item.mediaType)}
                    size="small"
                    variant="outlined"
                  />
                  {item.isFavorite ? (
                    <Chip color="secondary" label="Favorite" size="small" />
                  ) : null}
                  {item.isArchived ? (
                    <Chip label="Archived" size="small" />
                  ) : null}
                </Stack>
              </Stack>
            </Stack>

            {/* Genres + tags */}
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Typography color="text.secondary" variant="body2">
                {item.genres.join(", ") || "Missing genres"}
              </Typography>
              {item.tags.length > 0 ? (
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
                  {item.tags.slice(0, 3).map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Stack>
              ) : null}
            </Stack>

            {/* Scores */}
            <Stack direction="row" spacing={2}>
              <ScoreCell
                accent={accent}
                label="Personal"
                value={item.computedPersonalScore}
              />
              <ScoreCell label="Consensus" value={item.computedConsensusScore} />
            </Stack>

            {/* Rating — tap to save */}
            <StarRating
              mediaId={item.id}
              mediaType={item.mediaType}
              personalRating={item.personalRating}
              rateAction={updateMediaRating.bind(null, item.id)}
              readOnly={!canRate}
              size="small"
              title={item.title}
            />
          </Box>
        );
      })}
    </Stack>
  );
}

function ScoreCell({
  accent,
  label,
  value,
}: {
  accent?: string;
  label: string;
  value: number | null;
}) {
  return (
    <Box>
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
      <Typography
        sx={{
          color: value != null && accent ? accent : "text.primary",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
        }}
      >
        {value == null ? "–" : value.toFixed(1)}
      </Typography>
    </Box>
  );
}
