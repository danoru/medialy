"use client";

import { useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { createMedialyTheme, type ThemeMode } from "@/lib/theme";
import { ThemeModeProvider } from "@/lib/theme-mode";
import { ToastProvider } from "@/components/shared/Toasts";

export function Providers({
  children,
  initialThemeMode,
}: {
  children: React.ReactNode;
  initialThemeMode: ThemeMode;
}) {
  // With CSS variables + both color schemes baked in, the theme object is
  // stable across mode switches — toggling the html attribute via
  // `ThemeModeProvider` is what flips the visible palette.
  const theme = useMemo(
    () => createMedialyTheme(initialThemeMode),
    [initialThemeMode],
  );

  return (
    <ThemeModeProvider initialMode={initialThemeMode}>
      <ThemeProvider theme={theme} defaultMode={initialThemeMode}>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </ThemeModeProvider>
  );
}
