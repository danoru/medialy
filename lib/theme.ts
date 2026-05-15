import type { CSSProperties } from "react";
import { createTheme } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface TypographyVariants {
    displayHero: CSSProperties;
    eyebrow: CSSProperties;
    mediaTitle: CSSProperties;
    statValue: CSSProperties;
  }

  interface TypographyVariantsOptions {
    displayHero?: CSSProperties;
    eyebrow?: CSSProperties;
    mediaTitle?: CSSProperties;
    statValue?: CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    displayHero: true;
    eyebrow: true;
    mediaTitle: true;
    statValue: true;
  }
}

const headingFontFamily =
  'var(--font-heading), "Satoshi", "General Sans", "Space Grotesk", "Inter", system-ui, sans-serif';

const bodyFontFamily = 'var(--font-inter), "Inter", system-ui, sans-serif';

export const medialyTheme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 640,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },

  palette: {
    mode: "dark",

    primary: {
      main: "#8B5CF6",
      light: "#A78BFA",
      dark: "#5B21B6",
      contrastText: "#FFFFFF",
    },

    secondary: {
      main: "#22D3EE",
      light: "#67E8F9",
      dark: "#0891B2",
      contrastText: "#02111A",
    },

    success: {
      main: "#2EFFC3",
      light: "#7DFFD9",
      dark: "#00A879",
      contrastText: "#02110D",
    },

    warning: {
      main: "#FBBF24",
      light: "#FDE68A",
      dark: "#B45309",
      contrastText: "#160D02",
    },

    error: {
      main: "#FF5C7A",
      light: "#FF91A6",
      dark: "#BE123C",
      contrastText: "#FFFFFF",
    },

    info: {
      main: "#38BDF8",
      light: "#7DD3FC",
      dark: "#0369A1",
      contrastText: "#02111A",
    },

    background: {
      default: "#050812",
      paper: "#0B1020",
    },

    text: {
      primary: "#F8FAFC",
      secondary: "rgba(226, 232, 240, 0.72)",
      disabled: "rgba(226, 232, 240, 0.38)",
    },

    divider: "rgba(255, 255, 255, 0.08)",
  },

  shape: {
    borderRadius: 6,
  },

  typography: {
    fontFamily: bodyFontFamily,

    h1: {
      fontFamily: headingFontFamily,
      fontSize: "clamp(2.5rem, 5vw, 5.5rem)",
      fontWeight: 800,
      letterSpacing: "-0.055em",
      lineHeight: 0.95,
    },

    h2: {
      fontFamily: headingFontFamily,
      fontSize: "clamp(2rem, 4vw, 4rem)",
      fontWeight: 750,
      letterSpacing: "-0.045em",
      lineHeight: 1,
    },

    h3: {
      fontFamily: headingFontFamily,
      fontSize: "clamp(1.65rem, 3vw, 2.75rem)",
      fontWeight: 700,
      letterSpacing: "-0.035em",
      lineHeight: 1.05,
    },

    h4: {
      fontFamily: headingFontFamily,
      fontSize: "1.75rem",
      fontWeight: 700,
      letterSpacing: "-0.03em",
      lineHeight: 1.1,
    },

    h5: {
      fontFamily: headingFontFamily,
      fontSize: "1.3rem",
      fontWeight: 700,
      letterSpacing: "-0.025em",
      lineHeight: 1.15,
    },

    h6: {
      fontFamily: headingFontFamily,
      fontSize: "1rem",
      fontWeight: 700,
      letterSpacing: "-0.015em",
      lineHeight: 1.2,
    },

    body1: {
      fontSize: "0.95rem",
      fontWeight: 500,
      lineHeight: 1.65,
    },

    body2: {
      color: "rgba(226, 232, 240, 0.74)",
      fontSize: "0.84rem",
      fontWeight: 500,
      lineHeight: 1.55,
    },

    button: {
      fontFamily: bodyFontFamily,
      fontSize: "0.82rem",
      fontWeight: 800,
      letterSpacing: "-0.01em",
      textTransform: "none",
    },

    caption: {
      color: "rgba(226, 232, 240, 0.58)",
      fontSize: "0.72rem",
      fontWeight: 600,
      letterSpacing: "0.01em",
      lineHeight: 1.35,
    },

    overline: {
      color: "rgba(226, 232, 240, 0.56)",
      fontSize: "0.68rem",
      fontWeight: 800,
      letterSpacing: "0.12em",
      lineHeight: 1.3,
      textTransform: "uppercase",
    },

    displayHero: {
      fontFamily: headingFontFamily,
      fontSize: "clamp(3rem, 7vw, 7.5rem)",
      fontWeight: 850,
      letterSpacing: "-0.07em",
      lineHeight: 0.88,
    },

    eyebrow: {
      color: "rgba(226, 232, 240, 0.58)",
      fontFamily: bodyFontFamily,
      fontSize: "0.68rem",
      fontWeight: 850,
      letterSpacing: "0.14em",
      lineHeight: 1.25,
      textTransform: "uppercase",
    },

    mediaTitle: {
      fontFamily: headingFontFamily,
      fontSize: "0.95rem",
      fontWeight: 750,
      letterSpacing: "-0.025em",
      lineHeight: 1.05,
    },

    statValue: {
      fontFamily: headingFontFamily,
      fontSize: "1.35rem",
      fontWeight: 850,
      letterSpacing: "-0.04em",
      lineHeight: 1,
    },
  },

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: "none",
          minHeight: 38,
          paddingInline: 18,

          "&.MuiButton-containedPrimary": {
            background:
              "linear-gradient(135deg, #8B5CF6 0%, #6D5DFB 48%, #22D3EE 125%)",
            boxShadow: "0 18px 42px rgba(124, 92, 255, 0.28)",
          },

          "&.MuiButton-outlined": {
            borderColor: "rgba(255, 255, 255, 0.12)",
            color: "#E2E8F0",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
          },
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          background:
            "linear-gradient(145deg, rgba(15, 20, 38, 0.92), rgba(6, 9, 18, 0.96))",
          border: "1px solid rgba(255, 255, 255, 0.07)",
          borderRadius: 8,
          boxShadow:
            "0 24px 80px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontSize: "0.72rem",
          fontWeight: 750,
          height: 26,
        },

        filled: {
          backgroundColor: "rgba(255, 255, 255, 0.075)",
          color: "#E2E8F0",
        },

        outlined: {
          borderColor: "rgba(255, 255, 255, 0.12)",
          color: "rgba(226, 232, 240, 0.82)",
        },
      },
    },

    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background:
            "radial-gradient(circle at 18% 4%, rgba(34, 211, 238, 0.12), transparent 34%), radial-gradient(circle at 82% 0%, rgba(139, 92, 246, 0.18), transparent 34%), #050812",
          color: "#F8FAFC",
        },

        "::selection": {
          backgroundColor: "rgba(139, 92, 246, 0.45)",
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(255, 255, 255, 0.045)",
          border: "1px solid rgba(255, 255, 255, 0.09)",
          color: "rgba(226, 232, 240, 0.86)",
          transition:
            "transform 180ms ease, background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",

          "&:hover": {
            backgroundColor: "rgba(139, 92, 246, 0.16)",
            borderColor: "rgba(167, 139, 250, 0.32)",
            boxShadow: "0 0 28px rgba(139, 92, 246, 0.22)",
            transform: "translateY(-1px)",
          },
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

    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "rgba(5, 8, 18, 0.55)",
            borderRadius: 8,

            "& fieldset": {
              borderColor: "rgba(255, 255, 255, 0.11)",
            },

            "&:hover fieldset": {
              borderColor: "rgba(139, 92, 246, 0.36)",
            },

            "&.Mui-focused fieldset": {
              borderColor: "#8B5CF6",
              boxShadow: "0 0 0 3px rgba(139, 92, 246, 0.14)",
            },
          },
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "rgba(8, 12, 24, 0.96)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 6,
          color: "#F8FAFC",
          fontSize: "0.72rem",
          fontWeight: 700,
        },
      },
    },
  },
});

export const glassPanelSx: SxProps<Theme> = {
  background:
    "linear-gradient(145deg, rgba(15, 20, 38, 0.78), rgba(6, 9, 18, 0.92))",
  backdropFilter: "blur(22px)",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  borderRadius: "8px",
  boxShadow:
    "0 24px 80px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
};

export const mediaPosterSx: SxProps<Theme> = {
  aspectRatio: "2 / 3",
  background:
    "linear-gradient(145deg, rgba(139, 92, 246, 0.2), rgba(34, 211, 238, 0.08) 45%, rgba(5, 8, 18, 0.96))",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "8px",
  boxShadow:
    "0 28px 90px rgba(0, 0, 0, 0.55), 0 0 42px rgba(124, 92, 255, 0.22)",
  overflow: "hidden",
};

export const mediaCardSx: SxProps<Theme> = {
  background:
    "linear-gradient(180deg, rgba(32, 28, 72, 0.78), rgba(5, 8, 18, 0.96))",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  borderRadius: "8px",
  boxShadow: "0 18px 50px rgba(0, 0, 0, 0.36)",
  overflow: "hidden",
  position: "relative",
  transition:
    "transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease",

  "&:hover": {
    borderColor: "rgba(167, 139, 250, 0.26)",
    boxShadow:
      "0 26px 80px rgba(0, 0, 0, 0.55), 0 0 42px rgba(124, 92, 255, 0.22)",
    transform: "translateY(-6px)",
  },

  "&:hover .posterImage": {
    transform: "scale(1.055)",
  },
};

export const iconActionSx: SxProps<Theme> = {
  backdropFilter: "blur(16px)",
  backgroundColor: "rgba(255, 255, 255, 0.045)",
  border: "1px solid rgba(255, 255, 255, 0.09)",
  color: "rgba(226, 232, 240, 0.86)",

  "&:hover": {
    backgroundColor: "rgba(139, 92, 246, 0.16)",
    borderColor: "rgba(167, 139, 250, 0.32)",
    boxShadow: "0 0 28px rgba(139, 92, 246, 0.22)",
  },
};

export const dangerIconActionSx: SxProps<Theme> = {
  ...iconActionSx,
  color: "#FF8AA0",

  "&:hover": {
    backgroundColor: "rgba(255, 92, 122, 0.14)",
    borderColor: "rgba(255, 92, 122, 0.34)",
    boxShadow: "0 0 28px rgba(255, 92, 122, 0.18)",
  },
};

export const scoreBadgeSx: SxProps<Theme> = {
  backdropFilter: "blur(12px)",
  backgroundColor: "rgba(46, 255, 195, 0.14)",
  border: "1px solid rgba(46, 255, 195, 0.25)",
  color: "#2EFFC3",
  fontWeight: 850,
};

export default medialyTheme;
