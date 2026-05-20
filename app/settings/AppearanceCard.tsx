"use client";

import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import {
  Card,
  CardContent,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useThemeMode } from "@/lib/theme-mode";
import type { ThemeMode } from "@/lib/theme";

export function AppearanceCard() {
  const { mode, setMode } = useThemeMode();

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography sx={{ fontWeight: 700 }} variant="h6">
              Appearance
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Choose how Medialy looks on this device. Saved to a cookie so
              it sticks across sessions in this browser.
            </Typography>
          </Stack>
          <ToggleButtonGroup
            aria-label="Theme mode"
            exclusive
            onChange={(_, next: ThemeMode | null) => {
              if (next) setMode(next);
            }}
            size="small"
            value={mode}
          >
            <ToggleButton sx={{ gap: 0.75, px: 1.5 }} value="dark">
              <DarkModeIcon sx={{ fontSize: 16 }} />
              Dark
            </ToggleButton>
            <ToggleButton sx={{ gap: 0.75, px: 1.5 }} value="light">
              <LightModeIcon sx={{ fontSize: 16 }} />
              Light
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </CardContent>
    </Card>
  );
}
