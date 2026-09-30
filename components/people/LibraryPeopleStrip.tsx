"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { panelActionSx } from "@/components/cinematic/CinematicPrimitives";
import type { LibraryPeopleMatches } from "@/lib/db/people";
import { PersonRow } from "./PersonParts";

/**
 * People matching a library search, in the library's own card treatment. When
 * a matching name's titles were folded into the results, it says so, so the
 * list never shows titles without saying why.
 */
export function LibraryPeopleStrip({
  matches,
  personHref,
}: {
  matches: LibraryPeopleMatches;
  /** Library URL filtered to one person's titles. */
  personHref: Record<string, string>;
}) {
  if (!matches.people.length) return null;
  const merged = matches.merged;
  return (
    <Card sx={{ borderLeft: "2px solid", borderLeftColor: "primary.main" }} variant="outlined">
      <CardContent>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, mb: merged.length ? 0.75 : 0.5 }}>
          <Typography component="h2" variant="eyebrow" sx={{ flexShrink: 0 }}>
            People
          </Typography>
          <Box sx={{ bgcolor: "border.subtle", flex: 1, height: "1px", minWidth: 24 }} />
          <Button component={Link} href="/people" size="small" sx={panelActionSx}>
            Open People
          </Button>
        </Stack>
        {merged.length ? (
          <Typography color="text.secondary" sx={{ fontSize: "0.875rem", mb: 0.5 }}>
            Results include titles credited to{" "}
            {merged.map((person, index) => (
              <Box component="span" key={person.id}>
                {index > 0 ? (index === merged.length - 1 ? " and " : ", ") : null}
                <Box component="strong" sx={{ color: "text.primary", fontWeight: 600 }}>
                  {person.name}
                </Box>
              </Box>
            ))}
            .
          </Typography>
        ) : null}
        <Box
          sx={{
            columnGap: 3,
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              lg: matches.people.length > 1 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
            },
          }}
        >
          {matches.people.map((person, index) => (
            <PersonRow
              action={
                <Button
                  component={Link}
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                  href={personHref[person.id]}
                  size="small"
                  sx={{ ...panelActionSx, flexShrink: 0 }}
                >
                  Their titles
                </Button>
              }
              basePath="/people"
              key={person.id}
              last={
                index === matches.people.length - 1 ||
                (index === matches.people.length - 2 && matches.people.length % 2 === 0)
              }
              person={person}
              trailing="types"
            />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

/** The active person filter, removable like any other filter. */
export function PersonFilterChip({ clearHref, name }: { clearHref: string; name: string }) {
  const router = useRouter();
  return (
    <Chip
      color="primary"
      icon={<PersonRoundedIcon />}
      label={`Credited to ${name}`}
      onDelete={() => router.push(clearHref)}
      sx={{ alignSelf: "flex-start" }}
      variant="outlined"
    />
  );
}
