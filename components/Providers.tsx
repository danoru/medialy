"use client";

import { alpha } from "@mui/material/styles";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { noirTokens } from "@/components/cinematic/CinematicPrimitives";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: noirTokens.accent.purple,
    },
    secondary: {
      main: noirTokens.accent.blue,
    },
    background: {
      default: noirTokens.background.default,
      paper: noirTokens.background.panel,
    },
    success: {
      main: noirTokens.accent.emerald,
    },
    warning: {
      main: noirTokens.accent.amber,
    },
    info: {
      main: noirTokens.accent.blue,
    },
    text: {
      primary: noirTokens.text.primary,
      secondary: noirTokens.text.muted,
    },
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontWeight: 900, letterSpacing: 0 },
    h2: { fontWeight: 900, letterSpacing: 0 },
    h3: { fontWeight: 900, letterSpacing: 0 },
    h4: { fontWeight: 850, letterSpacing: 0 },
    h5: { fontWeight: 850, letterSpacing: 0 },
    h6: { fontWeight: 800, letterSpacing: 0 },
    button: {
      fontWeight: 800,
      letterSpacing: 0,
      textTransform: "none",
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          minHeight: 30,
          paddingBottom: 4,
          paddingTop: 4,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        "::selection": {
          backgroundColor: alpha(noirTokens.accent.purple, 0.34),
        },
        html: {
          background: noirTokens.background.default,
        },
        body: {
          background:
            "radial-gradient(circle at 18% -8%, rgba(56, 189, 248, 0.18), transparent 30rem), radial-gradient(circle at 82% 4%, rgba(139, 92, 246, 0.18), transparent 34rem), linear-gradient(180deg, #0B1020 0%, #080B12 42%, #080B12 100%)",
          minHeight: "100vh",
        },
        "*": {
          scrollbarColor: `${alpha("#9fb4d0", 0.35)} transparent`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background:
            "linear-gradient(145deg, rgba(17, 24, 39, 0.92), rgba(8, 11, 18, 0.9))",
          borderColor: alpha("#bfdbfe", 0.1),
          boxShadow: `inset 0 1px 0 ${alpha("#ffffff", 0.04)}, 0 12px 38px ${alpha("#000000", 0.3)}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderColor: alpha("#bfdbfe", 0.18),
          backgroundColor: alpha("#bfdbfe", 0.08),
          borderRadius: 5,
          height: 22,
          fontWeight: 700,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 7,
          borderRadius: 999,
          backgroundColor: alpha("#bfdbfe", 0.12),
        },
        bar: {
          borderRadius: 999,
        },
      },
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
