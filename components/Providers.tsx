"use client";

import { ThemeProvider } from "@mui/material/styles";
import { medialyTheme } from "@/lib/theme";
import { ToastProvider } from "@/components/shared/Toasts";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={medialyTheme}>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}
