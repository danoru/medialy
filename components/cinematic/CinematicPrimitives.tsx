"use client";
import type { ReactNode } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import type { CardProps } from "@mui/material";
import { alpha, styled, useTheme } from "@mui/material/styles";
import { ACCENTS } from "@/lib/media-ui-helpers";

// Legacy token export. These now serve as fallback constants for code that
// still imports `noirTokens` directly. Prefer reading from the MUI theme
// (theme.palette.surface, theme.palette.border, theme.palette.accent) or the
// named `ACCENTS` palette from `lib/media-ui-helpers`.
export const noirTokens = {
  accent: {
    amber: ACCENTS.yellow,
    blue: ACCENTS.navy,
    emerald: ACCENTS.mint,
    purple: ACCENTS.lavender,
    rose: ACCENTS.pink,
    violet: ACCENTS.lavender,
  },
  background: {
    default: "#0A0810",
    elevated: "#13101A",
    panel: "#1A1624",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.05)",
    strong: "rgba(255, 255, 255, 0.16)",
  },
  text: {
    muted: "rgba(244, 238, 250, 0.5)",
    primary: "#F4EEFA",
    secondary: "rgba(244, 238, 250, 0.62)",
  },
};

export const dashboardSurfaceRadius = 12;

type AccentCardProps = CardProps & {
  accent?: string;
};

export const CinematicCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== "accent",
})<AccentCardProps>(({ theme, accent }) => ({
  backgroundColor: theme.palette.background.paper,
  backgroundImage: `linear-gradient(180deg, ${alpha("#FFFFFF", 0.022)}, transparent 120px)`,
  border: `1px solid ${theme.palette.border.subtle}`,
  borderLeft: accent ? `2px solid ${accent}` : `1px solid ${theme.palette.border.subtle}`,
  borderRadius: dashboardSurfaceRadius,
  boxShadow: accent
    ? `0 8px 28px rgba(0, 0, 0, 0.42), 0 1px 0 ${alpha("#FFFFFF", 0.03)} inset, -8px 0 24px -16px ${alpha(accent, 0.55)}`
    : "0 6px 24px rgba(0, 0, 0, 0.35)",
  height: "100%",
  overflow: "hidden",
  position: "relative",
  transition:
    "border-color 200ms ease, transform 200ms ease, box-shadow 200ms ease",
  "&:hover": {
    borderColor: theme.palette.border.default,
    borderLeftColor: accent ?? theme.palette.border.default,
    transform: "translateY(-2px)",
    boxShadow: accent
      ? `0 16px 44px rgba(0, 0, 0, 0.52), 0 1px 0 ${alpha("#FFFFFF", 0.04)} inset, -10px 0 32px -14px ${alpha(accent, 0.7)}`
      : "0 12px 36px rgba(0, 0, 0, 0.45)",
  },
  ...theme.applyStyles("light", {
    backgroundImage: "none",
    boxShadow: "0 6px 24px rgba(15, 15, 20, 0.08)",
    "&:hover": {
      borderColor: theme.palette.border.default,
      transform: "translateY(-2px)",
      boxShadow: "0 12px 36px rgba(15, 15, 20, 0.12)",
    },
  }),
}));

export const CinematicPanel = CinematicCard;

export function DashboardSection({
  accent,
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
  const theme = useTheme();
  const accentColor = accent ?? theme.palette.primary.main;
  return (
    <CinematicPanel accent={accentColor}>
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          p: { xs: 2, md: 2.5 },
          "&:last-child": { pb: { xs: 2, md: 2.5 } },
        }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: "center", gap: 1, mb: 1.5 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {kicker ? (
              <Typography variant="eyebrow" sx={{ display: "block", mb: 0.5 }}>
                {kicker}
              </Typography>
            ) : null}
            <Typography
              component="h2"
              sx={{
                color: "text.primary",
                fontFamily: (t) => t.typography.h5.fontFamily,
                fontSize: "0.9375rem",
                fontWeight: 600,
                letterSpacing: "-0.015em",
              }}
            >
              {title}
            </Typography>
            <Box
              sx={{
                background: `linear-gradient(90deg, ${accentColor}, ${alpha(accentColor, 0)})`,
                borderRadius: 1,
                height: 2,
                mt: 0.65,
                width: 36,
              }}
            />
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
        bgcolor: "surface.1",
        border: "1px solid",
        borderColor: "border.subtle",
        borderLeft: `2px solid ${accent}`,
        borderRadius: 2,
        display: "flex",
        gap: 1.25,
        minHeight: 56,
        minWidth: { xs: 132, sm: 150 },
        px: 1.5,
        py: 1,
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
          variant="eyebrow"
          noWrap
          sx={{ display: "block", mb: 0.25 }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontFamily: (theme) => theme.typography.statValue.fontFamily,
            fontSize: "1.125rem",
            fontWeight: 650,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

export function AmbientIcon({
  accent,
  children,
  size = 40,
}: {
  accent: string;
  children: ReactNode;
  size?: number;
}) {
  return (
    <Box
      sx={{
        alignItems: "center",
        bgcolor: alpha(accent, 0.14),
        border: `1px solid ${alpha(accent, 0.24)}`,
        borderRadius: 2,
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
