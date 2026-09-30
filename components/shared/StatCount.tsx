"use client";

import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

/** A marquee statistic: a large figure over an eyebrow label. */
export function StatCount({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography
        sx={{
          fontFamily: (theme) => theme.typography.statValue.fontFamily,
          fontSize: "1.5rem",
          fontWeight: 700,
          letterSpacing: "-0.035em",
          lineHeight: 1,
        }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </Typography>
      <Typography variant="eyebrow" sx={{ display: "block", mt: 0.5 }}>
        {label}
      </Typography>
    </Box>
  );
}

/** The hairline between marquee statistics. Hidden once they wrap on phones. */
export function StatCountDivider() {
  return (
    <Box
      sx={{
        bgcolor: alpha("#FFFFFF", 0.16),
        display: { xs: "none", sm: "block" },
        height: 30,
        width: "1px",
      }}
    />
  );
}

/** A panel's quiet empty state: one centred line of secondary text. */
export function EmptyHint({ text }: { text: string }) {
  return (
    <Box
      sx={{
        alignItems: "center",
        color: "text.secondary",
        display: "flex",
        flex: 1,
        fontSize: "0.875rem",
        justifyContent: "center",
        minHeight: 120,
        px: 2,
        textAlign: "center",
      }}
    >
      {text}
    </Box>
  );
}
