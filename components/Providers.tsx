"use client";

import { ThemeProvider } from "@mui/material/styles";
import { medialyTheme } from "@/lib/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={medialyTheme}>{children}</ThemeProvider>;
}
