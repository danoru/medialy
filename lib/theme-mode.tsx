"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ThemeMode } from "@/lib/theme";

const THEME_COOKIE = "medialy_theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type ThemeModeContextValue = {
  mode: ThemeMode;
  toggleMode: () => void;
  setMode: (next: ThemeMode) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({
  initialMode,
  children,
}: {
  initialMode: ThemeMode;
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, toggleMode, setMode }),
    [mode, toggleMode, setMode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode must be used inside ThemeModeProvider.");
  }
  return context;
}

export function readThemeModeFromCookie(
  cookieHeader: string | undefined | null,
): ThemeMode {
  if (!cookieHeader) return "dark";
  const match = cookieHeader
    .split("; ")
    .find((entry) => entry.startsWith(`${THEME_COOKIE}=`));
  if (!match) return "dark";
  const value = match.slice(THEME_COOKIE.length + 1);
  return value === "light" ? "light" : "dark";
}
