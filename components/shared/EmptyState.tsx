"use client";
import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

/**
 * Centered icon + heading + (optional) description, used as a section
 * placeholder when a list/grid has nothing to show. Replaces the
 * `EmptyPanel` / `EmptyState` blocks previously inlined in dashboard,
 * watchlist, discover, etc.
 *
 * Wrap in a card/panel if you want a chrome border — `EmptyState`
 * itself only handles the centered content.
 */
export function EmptyState({
  action,
  description,
  icon,
  minHeight = 180,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  minHeight?: number | string;
  title: ReactNode;
}) {
  return (
    <Stack
      spacing={1}
      sx={{
        alignItems: "center",
        justifyContent: "center",
        minHeight,
        px: 2,
        py: 2,
        textAlign: "center",
      }}
    >
      {icon ? (
        <Box sx={{ color: "text.secondary", "& svg": { fontSize: 38 } }}>
          {icon}
        </Box>
      ) : null}
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 650 }}>
        {title}
      </Typography>
      {description ? (
        <Typography
          color="text.secondary"
          sx={{ fontSize: "0.8125rem", maxWidth: 420 }}
        >
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 1 }}>{action}</Box> : null}
    </Stack>
  );
}
