"use client";

import { alpha } from "@mui/material/styles";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#7c5cff",
    },
    secondary: {
      main: "#25d0b2",
    },
    background: {
      default: "#07111d",
      paper: "#101b2a",
    },
    success: {
      main: "#55d66b",
    },
    warning: {
      main: "#ffb13d",
    },
    info: {
      main: "#4fa3ff",
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background:
            "radial-gradient(circle at 20% 0%, rgba(41, 112, 255, 0.18), transparent 28rem), radial-gradient(circle at 85% 8%, rgba(124, 92, 255, 0.16), transparent 30rem), #07111d",
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
            "linear-gradient(180deg, rgba(20, 35, 54, 0.88), rgba(12, 24, 38, 0.88))",
          borderColor: alpha("#9fb4d0", 0.18),
          boxShadow: `inset 0 1px 0 ${alpha("#ffffff", 0.04)}, 0 18px 50px ${alpha("#000000", 0.22)}`,
          backdropFilter: "blur(18px)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderColor: alpha("#9fb4d0", 0.22),
          backgroundColor: alpha("#9fb4d0", 0.1),
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 7,
          borderRadius: 999,
          backgroundColor: alpha("#9fb4d0", 0.14),
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
