"use client";

import Link from "next/link";
import { Box, Stack, Typography } from "@mui/material";
import type { MediaType } from "@prisma/client";
import { UserAvatar } from "@/components/social/UserAvatar";
import { statusIcon } from "@/lib/media-ui-helpers";
import type { FriendMediaEntry } from "@/lib/social/visibility";
import { statusLabel } from "@/lib/status-labels";

/**
 * "What the people you follow think of this" — one compact cell per friend on
 * the media detail page, showing their tracking status and their rating if
 * they've given one.
 *
 * Data comes from `getFriendMediaActivity`, which is the only place allowed to
 * decide what a follow lets you see; this component renders whatever it is
 * handed and makes no privacy decisions of its own.
 *
 * Deliberately un-accented: per the design rules, media-type color is reserved
 * for type icons / tabs / poster fallbacks, so these cells wear neutral chrome
 * and statuses read as a muted meta line rather than as chips.
 */
export function FriendMediaActivity({
  entries,
  mediaType,
}: {
  entries: FriendMediaEntry[];
  mediaType: MediaType;
}) {
  return (
    <Box sx={friendGridSx}>
      {entries.map((entry) => {
        const icon = statusIcon(entry.status);
        const label =
          entry.status === "UNTRACKED"
            ? "Rated it"
            : statusLabel(entry.status, mediaType);
        return (
          <Box
            component={Link}
            href={`/u/${entry.userId}`}
            key={entry.userId}
            sx={friendCellSx}
          >
            <UserAvatar
              avatarColor={entry.avatarColor}
              displayName={entry.displayName}
              image={entry.image}
              size={34}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={friendNameSx}>
                {entry.displayName}
              </Typography>
              <Stack
                direction="row"
                sx={{ alignItems: "center", gap: 0.4, mt: 0.1 }}
              >
                {icon ? <Box sx={friendStatusIconSx}>{icon}</Box> : null}
                <Typography noWrap sx={friendStatusLabelSx}>
                  {label}
                </Typography>
              </Stack>
            </Box>
            {entry.personalRating != null ? (
              <Stack
                direction="row"
                sx={{ alignItems: "baseline", gap: 0.25, ml: "auto" }}
              >
                <Typography sx={friendRatingSx}>
                  {formatFriendRating(entry.personalRating)}
                </Typography>
                <Typography sx={friendRatingScaleSx}>/10</Typography>
              </Stack>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

/** `8` rather than `8.0`, but keep the decimal when there is one. */
function formatFriendRating(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const friendGridSx = {
  display: "grid",
  gap: 1,
  gridTemplateColumns: {
    xs: "minmax(0, 1fr)",
    sm: "repeat(auto-fill, minmax(220px, 1fr))",
  },
} as const;

const friendCellSx = {
  alignItems: "center",
  bgcolor: "surface.1",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 2,
  color: "text.primary",
  display: "flex",
  gap: 1.1,
  // 44px keeps the whole cell a comfortable tap target on mobile.
  minHeight: 44,
  px: 1.25,
  py: 1,
  textDecoration: "none",
  "&:hover": { borderColor: "primary.main" },
} as const;

const friendNameSx = {
  fontSize: "0.9375rem",
  fontWeight: 600,
  lineHeight: 1.3,
} as const;

const friendStatusIconSx = {
  alignItems: "center",
  color: "text.secondary",
  display: "flex",
  "& .MuiSvgIcon-root": { fontSize: 15 },
} as const;

const friendStatusLabelSx = {
  color: "text.secondary",
  fontSize: "0.875rem",
  lineHeight: 1.3,
} as const;

const friendRatingSx = {
  fontSize: "1.125rem",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  lineHeight: 1,
} as const;

const friendRatingScaleSx = {
  color: "text.secondary",
  fontSize: "0.875rem",
} as const;
