"use client";

import { useState, type ReactNode } from "react";
import {
  Box,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import styles from "./preview.module.css";

export function DashboardStylePreview({ children }: { children: ReactNode }) {
  const [treatment, setTreatment] = useState("refined");

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          gap: 1.5,
          justifyContent: "space-between",
          alignItems: { sm: "center" },
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: "0.875rem" }}>
            Dashboard style study
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Same content, scores, and sections. Switch to compare the
            presentation.
          </Typography>
        </Box>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={treatment}
          aria-label="Dashboard presentation"
          onChange={(_, value: string | null) => {
            if (value) setTreatment(value);
          }}
          sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "auto" } }}
        >
          <ToggleButton value="original">Original</ToggleButton>
          <ToggleButton value="refined">Refined</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Box
        data-preview-treatment={treatment}
        className={treatment === "refined" ? styles.refined : undefined}
      >
        {children}
      </Box>
    </Stack>
  );
}
