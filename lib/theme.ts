import type { CSSProperties } from "react";
import { createTheme, alpha } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";

export type ThemeMode = "light" | "dark";

declare module "@mui/material/styles" {
  interface Palette {
    surface: {
      1: string;
      2: string;
      3: string;
    };
    border: {
      subtle: string;
      default: string;
      strong: string;
    };
    accent: {
      primary: string;
      muted: string;
    };
  }

  interface PaletteOptions {
    surface?: {
      1: string;
      2: string;
      3: string;
    };
    border?: {
      subtle: string;
      default: string;
      strong: string;
    };
    accent?: {
      primary: string;
      muted: string;
    };
  }

  interface TypographyVariants {
    displayHero: CSSProperties;
    eyebrow: CSSProperties;
    mediaTitle: CSSProperties;
    statValue: CSSProperties;
    labelSm: CSSProperties;
    labelMd: CSSProperties;
  }

  interface TypographyVariantsOptions {
    displayHero?: CSSProperties;
    eyebrow?: CSSProperties;
    mediaTitle?: CSSProperties;
    statValue?: CSSProperties;
    labelSm?: CSSProperties;
    labelMd?: CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    displayHero: true;
    eyebrow: true;
    mediaTitle: true;
    statValue: true;
    labelSm: true;
    labelMd: true;
  }
}

const headingFontFamily =
  'var(--font-heading), "Satoshi", "General Sans", "Space Grotesk", "Inter", system-ui, sans-serif';

const bodyFontFamily = 'var(--font-inter), "Inter", system-ui, sans-serif';

type Tokens = {
  bg: { default: string; paper: string };
  bodyBackground: string;
  surface: { 1: string; 2: string; 3: string };
  border: { subtle: string; default: string; strong: string };
  text: { primary: string; secondary: string; disabled: string };
  accent: { primary: string; primaryHover: string; muted: string };
  divider: string;
  shadow: { sm: string; md: string; lg: string };
};

const darkTokens: Tokens = {
  bg: { default: "#0C0C10", paper: "#141419" },
  bodyBackground:
    "radial-gradient(1200px 600px at 12% -5%, rgba(124, 122, 237, 0.08), transparent 60%), radial-gradient(1000px 700px at 100% 0%, rgba(124, 122, 237, 0.05), transparent 55%), #0A0A0D",
  surface: { 1: "#17171D", 2: "#1F1F26", 3: "#272730" },
  border: {
    subtle: "rgba(255, 255, 255, 0.06)",
    default: "rgba(255, 255, 255, 0.1)",
    strong: "rgba(255, 255, 255, 0.16)",
  },
  text: {
    primary: "#F5F5F7",
    secondary: "rgba(245, 245, 247, 0.62)",
    disabled: "rgba(245, 245, 247, 0.32)",
  },
  accent: {
    primary: "#7C7AED",
    primaryHover: "#9492F2",
    muted: "rgba(124, 122, 237, 0.16)",
  },
  divider: "rgba(255, 255, 255, 0.08)",
  shadow: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.3)",
    md: "0 6px 24px rgba(0, 0, 0, 0.35)",
    lg: "0 24px 60px rgba(0, 0, 0, 0.45)",
  },
};

const lightTokens: Tokens = {
  bg: { default: "#FAFAF8", paper: "#FFFFFF" },
  bodyBackground:
    "radial-gradient(1200px 600px at 12% -5%, rgba(91, 91, 214, 0.05), transparent 60%), radial-gradient(1000px 700px at 100% 0%, rgba(91, 91, 214, 0.035), transparent 55%), #F7F7F3",
  surface: { 1: "#F4F4F1", 2: "#ECECE8", 3: "#E0E0DC" },
  border: {
    subtle: "rgba(15, 15, 20, 0.06)",
    default: "rgba(15, 15, 20, 0.1)",
    strong: "rgba(15, 15, 20, 0.18)",
  },
  text: {
    primary: "#0A0A0F",
    secondary: "rgba(10, 10, 15, 0.62)",
    disabled: "rgba(10, 10, 15, 0.36)",
  },
  accent: {
    primary: "#5B5BD6",
    primaryHover: "#4848C4",
    muted: "rgba(91, 91, 214, 0.1)",
  },
  divider: "rgba(15, 15, 20, 0.08)",
  shadow: {
    sm: "0 1px 2px rgba(15, 15, 20, 0.06)",
    md: "0 6px 24px rgba(15, 15, 20, 0.08)",
    lg: "0 24px 60px rgba(15, 15, 20, 0.12)",
  },
};

export function createMedialyTheme(mode: ThemeMode = "dark") {
  const t = mode === "dark" ? darkTokens : lightTokens;

  return createTheme({
    breakpoints: {
      values: { xs: 0, sm: 640, md: 900, lg: 1200, xl: 1536 },
    },

    palette: {
      mode,

      primary: {
        main: t.accent.primary,
        light: t.accent.primaryHover,
        dark: mode === "dark" ? "#5654C9" : "#3A3AA8",
        contrastText: "#FFFFFF",
      },

      secondary: {
        main: mode === "dark" ? "#E8E8EC" : "#1A1A20",
        contrastText: mode === "dark" ? "#0A0A0D" : "#FAFAF8",
      },

      success: { main: mode === "dark" ? "#3FD693" : "#16A372" },
      warning: { main: mode === "dark" ? "#F0B649" : "#C28A1C" },
      error: { main: mode === "dark" ? "#F26D8A" : "#D43855" },
      info: { main: mode === "dark" ? "#5BA8F0" : "#2178D1" },

      background: {
        default: t.bg.default,
        paper: t.bg.paper,
      },

      text: {
        primary: t.text.primary,
        secondary: t.text.secondary,
        disabled: t.text.disabled,
      },

      divider: t.divider,

      surface: t.surface,
      border: t.border,
      accent: { primary: t.accent.primary, muted: t.accent.muted },
    },

    shape: {
      borderRadius: 10,
    },

    typography: {
      fontFamily: bodyFontFamily,

      h1: {
        fontFamily: headingFontFamily,
        fontSize: "clamp(2.25rem, 4.5vw, 4.5rem)",
        fontWeight: 700,
        letterSpacing: "-0.04em",
        lineHeight: 1.02,
      },
      h2: {
        fontFamily: headingFontFamily,
        fontSize: "clamp(1.75rem, 3.2vw, 3rem)",
        fontWeight: 700,
        letterSpacing: "-0.035em",
        lineHeight: 1.08,
      },
      h3: {
        fontFamily: headingFontFamily,
        fontSize: "clamp(1.4rem, 2.4vw, 2rem)",
        fontWeight: 650,
        letterSpacing: "-0.03em",
        lineHeight: 1.15,
      },
      h4: {
        fontFamily: headingFontFamily,
        fontSize: "1.375rem",
        fontWeight: 650,
        letterSpacing: "-0.025em",
        lineHeight: 1.2,
      },
      h5: {
        fontFamily: headingFontFamily,
        fontSize: "1.125rem",
        fontWeight: 650,
        letterSpacing: "-0.02em",
        lineHeight: 1.25,
      },
      h6: {
        fontFamily: headingFontFamily,
        fontSize: "0.95rem",
        fontWeight: 650,
        letterSpacing: "-0.015em",
        lineHeight: 1.3,
      },

      body1: {
        fontSize: "0.9375rem",
        fontWeight: 400,
        lineHeight: 1.55,
      },
      body2: {
        fontSize: "0.8125rem",
        fontWeight: 400,
        lineHeight: 1.5,
      },

      button: {
        fontFamily: bodyFontFamily,
        fontSize: "0.8125rem",
        fontWeight: 550,
        letterSpacing: "-0.005em",
        textTransform: "none",
      },

      caption: {
        fontSize: "0.75rem",
        fontWeight: 500,
        letterSpacing: 0,
        lineHeight: 1.4,
      },

      overline: {
        fontSize: "0.6875rem",
        fontWeight: 600,
        letterSpacing: "0.1em",
        lineHeight: 1.3,
        textTransform: "uppercase",
      },

      displayHero: {
        fontFamily: headingFontFamily,
        fontSize: "clamp(2.75rem, 6vw, 6rem)",
        fontWeight: 750,
        letterSpacing: "-0.05em",
        lineHeight: 0.95,
      },

      eyebrow: {
        fontFamily: bodyFontFamily,
        fontSize: "0.6875rem",
        fontWeight: 600,
        letterSpacing: "0.12em",
        lineHeight: 1.3,
        textTransform: "uppercase",
        color: t.text.secondary,
      },

      mediaTitle: {
        fontFamily: headingFontFamily,
        fontSize: "0.9375rem",
        fontWeight: 600,
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
      },

      statValue: {
        fontFamily: headingFontFamily,
        fontSize: "1.5rem",
        fontWeight: 700,
        letterSpacing: "-0.035em",
        lineHeight: 1,
      },

      labelSm: {
        fontFamily: bodyFontFamily,
        fontSize: "0.6875rem",
        fontWeight: 550,
        letterSpacing: "0.005em",
        lineHeight: 1.3,
      },

      labelMd: {
        fontFamily: bodyFontFamily,
        fontSize: "0.8125rem",
        fontWeight: 550,
        letterSpacing: 0,
        lineHeight: 1.3,
      },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: t.bodyBackground,
            backgroundAttachment: "fixed",
            color: t.text.primary,
            transition: "color 200ms ease",
          },
          "::selection": {
            backgroundColor: alpha(t.accent.primary, 0.32),
          },
          "*::-webkit-scrollbar": { width: 10, height: 10 },
          "*::-webkit-scrollbar-track": { background: "transparent" },
          "*::-webkit-scrollbar-thumb": {
            background: t.border.default,
            borderRadius: 8,
            border: `2px solid ${t.bg.default}`,
          },
          "*::-webkit-scrollbar-thumb:hover": {
            background: t.border.strong,
          },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: "none",
            fontWeight: 550,
            minHeight: 36,
            paddingInline: 14,
            "&:hover": { boxShadow: "none" },
            "&.MuiButton-containedPrimary": {
              backgroundColor: t.accent.primary,
              color: "#FFFFFF",
              "&:hover": {
                backgroundColor: t.accent.primaryHover,
                boxShadow: "none",
              },
            },
            "&.MuiButton-outlined": {
              borderColor: t.border.default,
              color: t.text.primary,
              backgroundColor: "transparent",
              "&:hover": {
                borderColor: t.border.strong,
                backgroundColor:
                  mode === "dark"
                    ? "rgba(255, 255, 255, 0.04)"
                    : "rgba(15, 15, 20, 0.04)",
              },
            },
            "&.MuiButton-text": {
              color: t.text.primary,
              "&:hover": {
                backgroundColor:
                  mode === "dark"
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(15, 15, 20, 0.04)",
              },
            },
          },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: t.bg.paper,
            backgroundImage:
              mode === "dark"
                ? `linear-gradient(180deg, ${alpha("#FFFFFF", 0.022)}, transparent 120px)`
                : "none",
            border: `1px solid ${t.border.subtle}`,
            borderRadius: 12,
            boxShadow: t.shadow.md,
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontSize: "0.75rem",
            fontWeight: 500,
            height: 24,
          },
          filled: {
            backgroundColor: t.surface[1],
            color: t.text.primary,
          },
          outlined: {
            borderColor: t.border.default,
            color: t.text.secondary,
          },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            color: t.text.secondary,
            transition:
              "color 160ms ease, background-color 160ms ease",
            "&:hover": {
              backgroundColor:
                mode === "dark"
                  ? "rgba(255, 255, 255, 0.06)"
                  : "rgba(15, 15, 20, 0.05)",
              color: t.text.primary,
            },
          },
        },
      },

      MuiTextField: {
        defaultProps: { variant: "outlined", size: "small" },
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              backgroundColor: t.surface[1],
              borderRadius: 8,
              "& fieldset": { borderColor: t.border.default },
              "&:hover fieldset": { borderColor: t.border.strong },
              "&.Mui-focused fieldset": {
                borderColor: t.accent.primary,
                borderWidth: 1,
                boxShadow: `0 0 0 3px ${alpha(t.accent.primary, 0.18)}`,
              },
            },
          },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: t.surface[1],
            borderRadius: 8,
            "& fieldset": { borderColor: t.border.default },
          },
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: { borderColor: t.divider },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: t.surface[3],
            border: `1px solid ${t.border.default}`,
            borderRadius: 6,
            color: t.text.primary,
            fontSize: "0.75rem",
            fontWeight: 500,
            paddingBlock: 6,
          },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            "&.Mui-selected": {
              backgroundColor: t.accent.muted,
              "&:hover": { backgroundColor: t.accent.muted },
            },
          },
        },
      },

      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: t.bg.paper,
            border: `1px solid ${t.border.default}`,
            borderRadius: 10,
            boxShadow: t.shadow.md,
          },
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: "transparent",
            backgroundImage: "none",
            color: t.text.primary,
          },
        },
      },
    },
  });
}

export const medialyTheme = createMedialyTheme("dark");

// Legacy sx helpers — kept for any straggler imports.
export const glassPanelSx: SxProps<Theme> = {
  bgcolor: "background.paper",
  border: (theme) => `1px solid ${theme.palette.border.subtle}`,
  borderRadius: 2,
};

export const mediaPosterSx: SxProps<Theme> = {
  aspectRatio: "2 / 3",
  bgcolor: "surface.2",
  border: (theme) => `1px solid ${theme.palette.border.subtle}`,
  borderRadius: 1.5,
  overflow: "hidden",
};

export const mediaCardSx: SxProps<Theme> = {
  bgcolor: "background.paper",
  border: (theme) => `1px solid ${theme.palette.border.subtle}`,
  borderRadius: 1.5,
  overflow: "hidden",
  position: "relative",
  transition: "border-color 200ms ease, transform 200ms ease",
  "&:hover": {
    borderColor: (theme) => theme.palette.border.strong,
    transform: "translateY(-2px)",
  },
};

export const iconActionSx: SxProps<Theme> = {
  bgcolor: "transparent",
  color: "text.secondary",
  "&:hover": { color: "text.primary" },
};

export const dangerIconActionSx: SxProps<Theme> = {
  bgcolor: "transparent",
  color: "error.main",
  "&:hover": {
    bgcolor: (theme) => alpha(theme.palette.error.main, 0.1),
  },
};

export const scoreBadgeSx: SxProps<Theme> = {
  bgcolor: (theme) => alpha(theme.palette.success.main, 0.14),
  border: (theme) => `1px solid ${alpha(theme.palette.success.main, 0.32)}`,
  color: "success.main",
  fontWeight: 600,
};

export default medialyTheme;
