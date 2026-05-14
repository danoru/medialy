"use client";

import type { ReactNode } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import type { CardProps } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const noirTokens = {
  accent: {
    amber: "#F59E0B",
    blue: "#38BDF8",
    emerald: "#34D399",
    purple: "#8B5CF6",
    rose: "#F472B6",
  },
  background: {
    default: "#080B12",
    elevated: "#0B1020",
    panel: "#111827",
  },
  border: {
    subtle: "rgba(191, 219, 254, 0.14)",
    strong: "rgba(191, 219, 254, 0.24)",
  },
  text: {
    muted: "#8EA3BD",
    primary: "#F8FAFC",
    secondary: "#CBD5E1",
  },
};

type AccentCardProps = CardProps & {
  accent?: string;
};

export const CinematicCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== "accent",
})<AccentCardProps>(({ accent = noirTokens.accent.purple, theme }) => ({
  background:
    "linear-gradient(145deg, rgba(13, 18, 30, 0.94), rgba(6, 9, 15, 0.94))",
  border: `1px solid ${alpha("#BFDBFE", 0.12)}`,
  boxShadow: [
    `inset 0 1px 0 ${alpha("#FFFFFF", 0.045)}`,
    `0 16px 48px ${alpha("#000000", 0.34)}`,
    `0 0 0 1px ${alpha(accent, 0.04)}`,
  ].join(", "),
  overflow: "hidden",
  position: "relative",
  transition:
    "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
  height: "100%",
  "&::before": {
    background: `linear-gradient(90deg, transparent, ${alpha(accent, 0.72)}, transparent)`,
    content: '""',
    height: 1,
    left: 18,
    opacity: 0.55,
    position: "absolute",
    right: 18,
    top: 0,
  },
  "&:hover": {
    borderColor: alpha(accent, 0.34),
    boxShadow: [
      `inset 0 1px 0 ${alpha("#FFFFFF", 0.07)}`,
      `0 18px 56px ${alpha("#000000", 0.42)}`,
      `0 0 28px ${alpha(accent, 0.1)}`,
    ].join(", "),
    transform: "translateY(-2px)",
  },
  [theme.breakpoints.down("sm")]: {
    "&:hover": {
      transform: "none",
    },
  },
}));

export const CinematicPanel = CinematicCard;

export function DashboardSection({
  accent = noirTokens.accent.purple,
  action,
  children,
  kicker,
  title,
}: {
  accent?: string;
  action?: ReactNode;
  children: ReactNode;
  kicker?: string;
  title: string;
}) {
  return (
    <CinematicPanel accent={accent} variant="outlined">
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          p: { xs: 1.25, md: 1.4 },
          "&:last-child": { pb: { xs: 1.25, md: 1.4 } },
        }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: "center", gap: 1.5, mb: 1.15 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {kicker ? (
              <Typography
                color="text.secondary"
                sx={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                }}
              >
                {kicker}
              </Typography>
            ) : null}
            <Typography
              component="h2"
              sx={{ fontSize: 15, fontWeight: 850, lineHeight: 1.1 }}
            >
              {title}
            </Typography>
          </Box>
          {action}
        </Stack>
        <Box
          sx={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {children}
        </Box>
      </CardContent>
    </CinematicPanel>
  );
}

export const DashboardPanel = DashboardSection;

export function CompactStatCard({
  accent,
  icon,
  label,
  value,
}: {
  accent: string;
  icon?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <Box
      sx={{
        alignItems: "center",
        background: `linear-gradient(145deg, ${alpha(accent, 0.095)}, rgba(8, 11, 18, 0.72))`,
        border: `1px solid ${alpha("#BFDBFE", 0.11)}`,
        borderRadius: 1,
        display: "flex",
        gap: 0.9,
        minHeight: 50,
        minWidth: { xs: 132, sm: 150 },
        px: 1.15,
        py: 0.8,
      }}
    >
      {icon ? (
        <Box
          sx={{
            alignItems: "center",
            color: accent,
            display: "flex",
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      ) : null}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          color="text.secondary"
          noWrap
          sx={{
            fontSize: 9.5,
            fontWeight: 850,
            letterSpacing: 0.9,
            lineHeight: 1.2,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Typography>
        <Typography sx={{ fontSize: 18, fontWeight: 950, lineHeight: 1.05 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

export function AmbientIcon({
  accent,
  children,
  size = 44,
}: {
  accent: string;
  children: ReactNode;
  size?: number;
}) {
  return (
    <Box
      sx={{
        alignItems: "center",
        background: `linear-gradient(145deg, ${alpha(accent, 0.24)}, ${alpha("#FFFFFF", 0.035)})`,
        border: `1px solid ${alpha(accent, 0.32)}`,
        borderRadius: 2,
        boxShadow: `0 0 28px ${alpha(accent, 0.16)}`,
        color: accent,
        display: "flex",
        flexShrink: 0,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      {children}
    </Box>
  );
}
