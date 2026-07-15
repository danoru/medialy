"use client";

import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

/**
 * The library's eight filter fields.
 *
 * On desktop they sit inline, as before. On a phone they used to stack
 * vertically and fill the entire first screen — the first actual movie was
 * below the fold — so there they collapse behind a "Filters" row instead.
 */
export function LibraryFilters({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  // noSsr: evaluate on the client only. The server has no viewport, and
  // guessing wrong here would mean a hydration mismatch on every load.
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"), { noSsr: true });

  const fields = (
    <Stack
      component="form"
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      sx={{ flexWrap: "wrap", width: "100%" }}
    >
      {children}
    </Stack>
  );

  if (isDesktop) return fields;

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        backgroundColor: "transparent",
        "&::before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreRoundedIcon />}
        sx={{ minHeight: 44, px: 0 }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <TuneRoundedIcon fontSize="small" />
          <Typography sx={{ fontWeight: 600 }}>Filters</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0 }}>{fields}</AccordionDetails>
    </Accordion>
  );
}
