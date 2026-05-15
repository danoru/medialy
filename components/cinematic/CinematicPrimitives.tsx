"use client";
import type { ReactNode } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import type { CardProps } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const noirTokens = {
  accent: {
    amber: "#A78BFA",
    blue: "#22D3EE",
    emerald: "#22D3EE",
    purple: "#8B5CF6",
    rose: "#FF77C8",
    violet: "#A78BFA",
  },
  background: {
    default: "#050812",
    elevated: "#0B1020",
    panel: "#08111F",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.07)",
    strong: "rgba(255, 255, 255, 0.14)",
  },
  text: {
    muted: "rgba(226, 232, 240, 0.68)",
    primary: "#F8FAFC",
    secondary: "rgba(226, 232, 240, 0.78)",
  },
};

export const dashboardSurfaceRadius = 18;

const dashboardPanelBackground =
  "linear-gradient(145deg, rgba(8, 17, 31, 0.92), rgba(5, 8, 18, 0.98))";

type AccentCardProps = CardProps & {
  accent?: string;
};

export const CinematicCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== "accent",
})<AccentCardProps>(({ accent = noirTokens.accent.purple, theme }) => ({
  background: `radial-gradient(circle at 18% 0%, ${alpha(accent, 0.1)}, transparent 22rem), radial-gradient(circle at 92% 12%, ${alpha(noirTokens.accent.blue, 0.045)}, transparent 20rem), ${dashboardPanelBackground}`,
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  borderRadius: dashboardSurfaceRadius,
  boxShadow: [
    `0 22px 70px ${alpha("#000000", 0.36)}`,
    `inset 0 1px 0 ${alpha("#FFFFFF", 0.04)}`,
    `0 0 48px ${alpha(accent, 0.055)}`,
  ].join(", "),
  overflow: "hidden",
  position: "relative",
  transition: "box-shadow 220ms ease, background-color 220ms ease",
  height: "100%",
  "&::before": {
    background: `linear-gradient(90deg, transparent, ${alpha(accent, 0.28)}, ${alpha(noirTokens.accent.blue, 0.12)}, transparent)`,
    content: '""',
    height: 1,
    left: 18,
    opacity: 0.64,
    position: "absolute",
    right: 18,
    top: 0,
  },
  "&::after": {
    background:
      "linear-gradient(135deg, rgba(139, 92, 246, 0.035), transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.014), transparent 22%)",
    content: '""',
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
  },
  "&:hover": {
    boxShadow: [
      `0 24px 76px ${alpha("#000000", 0.46)}`,
      `inset 0 1px 0 ${alpha("#FFFFFF", 0.055)}`,
      `0 0 58px ${alpha(accent, 0.08)}`,
    ].join(", "),
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
    <CinematicPanel accent={accent}>
      <CardContent
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          p: { xs: 1.1, md: 1.25 },
          position: "relative",
          zIndex: 1,
          "&:last-child": { pb: { xs: 1.1, md: 1.25 } },
        }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: "center", gap: 1.1, mb: 0.95 }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {kicker ? (
              <Typography
                variant="eyebrow"
                sx={{
                  color: "rgba(226, 232, 240, 0.68)",
                  display: "block",
                  mb: 0.25,
                }}
              >
                {kicker.toUpperCase()}
              </Typography>
            ) : null}
            <Typography
              component="h2"
              variant="eyebrow"
              sx={{
                color: "rgba(226, 232, 240, 0.68)",
                display: "block",
                fontSize: "0.72rem",
                fontWeight: 850,
                letterSpacing: "0.12em",
              }}
            >
              {title.toUpperCase()}
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
        background: `radial-gradient(circle at 16% 0%, ${alpha(accent, 0.16)}, transparent 62%), linear-gradient(145deg, rgba(12, 17, 31, 0.8), rgba(5, 7, 14, 0.88))`,
        backdropFilter: "blur(18px)",
        border: 0,
        borderRadius: `${dashboardSurfaceRadius}px`,
        boxShadow: `inset 0 1px 0 ${alpha("#FFFFFF", 0.055)}, inset 0 0 0 1px ${alpha("#D8E6FF", 0.035)}, 0 16px 42px ${alpha("#000000", 0.22)}`,
        display: "flex",
        gap: 0.9,
        minHeight: 48,
        minWidth: { xs: 132, sm: 150 },
        px: 1.05,
        py: 0.7,
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
