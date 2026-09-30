"use client";

import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  accordionClasses,
  collapseClasses,
  Stack,
  Typography,
} from "@mui/material";

/**
 * The library's eight filter fields.
 *
 * On desktop they sit inline, as before. On a phone they used to stack
 * vertically and fill the entire first screen — the first actual movie was
 * below the fold — so there they collapse behind a "Filters" row instead.
 *
 * One tree serves both, switched by CSS at the breakpoint: from `md` up the
 * "Filters" row is hidden and the panel is forced open. Choosing between two
 * trees in JavaScript meant the server (which has no viewport) and the browser
 * rendered different markup, a hydration mismatch on every desktop load.
 */
export function LibraryFilters({ children }: { children: React.ReactNode }) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={(theme) => ({
        backgroundColor: "transparent",
        "&::before": { display: "none" },
        [theme.breakpoints.up("md")]: {
          [`& .${accordionClasses.heading}`]: { display: "none" },
          [`& > .${collapseClasses.root}`]: {
            height: "auto !important",
            visibility: "visible !important",
          },
        },
      })}
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
      <AccordionDetails sx={{ p: 0, pb: { xs: 2, md: 0 } }}>
        <Stack
          component="form"
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ flexWrap: "wrap", width: "100%" }}
        >
          {children}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
