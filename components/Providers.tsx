"use client";

import { useMemo } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { createMedialyTheme, type ThemeMode } from "@/lib/theme";
import { ThemeModeProvider, useThemeMode } from "@/lib/theme-mode";
import { ToastProvider } from "@/components/shared/Toasts";

export function Providers({
  children,
  initialThemeMode,
}: {
  children: React.ReactNode;
  initialThemeMode: ThemeMode;
}) {
  return (
    <ThemeModeProvider initialMode={initialThemeMode}>
      <ThemedTree>{children}</ThemedTree>
    </ThemeModeProvider>
  );
}

function ThemedTree({ children }: { children: React.ReactNode }) {
  const { mode } = useThemeMode();
  const theme = useMemo(() => createMedialyTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}
