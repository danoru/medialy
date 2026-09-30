"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  InputBase,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { MediaThumb } from "@/components/media/MediaThumb";
import type { PersonSummary } from "@/lib/db/people";
import { mediaAccent, shortMediaTypeLabel } from "@/lib/media-ui-helpers";
import { titleNoun } from "@/lib/people";
import { experiencedWord } from "@/lib/status-labels";

/** Initials in a quiet disc. We hold no portraits, and a stand-in face would lie. */
export function PersonAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word.charAt(0)))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return (
    <Box
      aria-hidden
      sx={{
        alignItems: "center",
        bgcolor: "surface.2",
        border: "1px solid",
        borderColor: "border.default",
        borderRadius: "50%",
        color: "text.secondary",
        display: "flex",
        flexShrink: 0,
        fontFamily: (theme) => theme.typography.h5.fontFamily,
        fontSize: size * 0.36,
        fontWeight: 650,
        height: size,
        justifyContent: "center",
        letterSpacing: "-0.02em",
        width: size,
      }}
    >
      {initials || "?"}
    </Box>
  );
}

/** A person's name as a link: neutral at rest, peach on hover. */
export function PersonLink({
  basePath,
  children,
  id,
}: {
  basePath: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <Box
      component={Link}
      href={`${basePath}/${id}`}
      sx={{
        color: "inherit",
        fontWeight: 600,
        textDecoration: "none",
        "&:hover": { color: "primary.main" },
      }}
    >
      {children}
    </Box>
  );
}

/** Your average for a person, with how far it sits from your usual score. */
export function PersonScore({
  average,
  delta,
}: {
  average: number | null;
  delta: number | null;
}) {
  if (average == null) return null;
  return (
    <Box sx={{ flexShrink: 0, textAlign: "right" }}>
      <Typography
        sx={{
          fontFamily: (theme) => theme.typography.statValue.fontFamily,
          fontSize: "1.25rem",
          fontWeight: 700,
          letterSpacing: "-0.035em",
          lineHeight: 1,
        }}
      >
        {average.toFixed(1)}
      </Typography>
      {delta != null ? (
        <Typography
          sx={{
            color: delta >= 0.25 ? "success.main" : "text.secondary",
            fontSize: "0.8125rem",
            fontWeight: 600,
            mt: 0.35,
            whiteSpace: "nowrap",
          }}
        >
          {formatDelta(delta)} vs you
        </Typography>
      ) : null}
    </Box>
  );
}

export function formatDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) return "±0.0";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(1)}`;
}

/** Media-colour squares with counts: where a person's credits sit. */
export function TypeDots({ types }: { types: PersonSummary["types"] }) {
  return (
    <Stack
      direction="row"
      // Secondary detail: on phones the name needs the room more.
      sx={{ alignItems: "center", display: { xs: "none", sm: "flex" }, flexShrink: 0, gap: 1.25 }}
    >
      {types.map((entry) => (
        <Stack
          direction="row"
          key={entry.mediaType}
          sx={{ alignItems: "center", gap: 0.6 }}
          title={`${entry.count} ${shortMediaTypeLabel(entry.mediaType).toLowerCase()}`}
        >
          <Box
            sx={{
              bgcolor: mediaAccent(entry.mediaType),
              borderRadius: "3px",
              height: 9,
              width: 9,
            }}
          />
          <Typography color="text.secondary" sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
            {entry.count}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

/**
 * One person in a panel list. The row mirrors the profile's activity rows:
 * a leading mark, two lines of text, and a trailing figure.
 */
export function PersonRow({
  action,
  basePath,
  last,
  mediaType,
  person,
  trailing = "score",
}: {
  /** A link or button after the trailing figure, e.g. "Their titles". */
  action?: ReactNode;
  basePath: string;
  last: boolean;
  /** The type in view; drives the noun in the subline. Omit on search results. */
  mediaType?: PersonSummary["types"][number]["mediaType"];
  person: PersonSummary;
  trailing?: "score" | "types";
}) {
  // Search results span types; a person known only for games still "played".
  const countType =
    mediaType ?? (person.types.length === 1 ? person.types[0].mediaType : undefined);
  const parts = [
    person.roles,
    countType
      ? `${person.titleCount} ${titleNoun(countType, person.titleCount)}`
      : `${person.titleCount} ${person.titleCount === 1 ? "title" : "titles"}`,
    person.seenCount ? `${person.seenCount} ${experiencedWord(countType)}` : null,
    person.note,
  ].filter(Boolean);
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "center",
        borderBottom: last ? 0 : "1px solid",
        borderColor: "divider",
        gap: 1.5,
        py: 1,
      }}
    >
      <Box component={Link} href={`${basePath}/${person.id}`} sx={{ lineHeight: 0 }} tabIndex={-1}>
        <PersonAvatar name={person.name} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: "0.9375rem", lineHeight: 1.35 }}>
          <PersonLink basePath={basePath} id={person.id}>
            {person.name}
          </PersonLink>
        </Typography>
        <Typography color="text.secondary" noWrap sx={{ fontSize: "0.875rem" }}>
          {parts.join(" · ")}
        </Typography>
      </Box>
      {person.tiles.length ? (
        <Stack direction="row" sx={{ display: { xs: "none", sm: "flex" }, flexShrink: 0, gap: 0.75 }}>
          {person.tiles.map((item) => (
            <MediaThumb item={item} key={item.id} />
          ))}
        </Stack>
      ) : null}
      {trailing === "types" ? (
        <TypeDots types={person.types} />
      ) : (
        <PersonScore average={person.average} delta={person.delta} />
      )}
      {action}
    </Stack>
  );
}

/**
 * A neutral filter for a panel header (Directors / Cast). Deliberately plainer
 * than the media-type switcher: it narrows one panel, it doesn't change the page.
 */
export function PanelFilter<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: Array<{ key: T; label: string }>;
  value: T;
}) {
  if (options.length < 2) return null;
  return (
    <ToggleButtonGroup
      exclusive
      onChange={(_, next: T | null) => {
        if (next) onChange(next);
      }}
      size="small"
      sx={{
        bgcolor: "surface.1",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 1.5,
        flexShrink: 0,
        p: 0.25,
        "& .MuiToggleButton-root": {
          border: 0,
          borderRadius: 1,
          color: "text.secondary",
          fontSize: "0.8125rem",
          fontWeight: 550,
          lineHeight: 1.2,
          px: 1,
          py: 0.35,
          textTransform: "none",
          "&.Mui-selected": {
            bgcolor: "background.paper",
            color: "text.primary",
            "&:hover": { bgcolor: "background.paper" },
          },
        },
      }}
      value={value}
    >
      {options.map((option) => (
        <ToggleButton key={option.key} value={option.key}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** The people search box — the header search's pill, submitting to this page. */
export function PeopleSearchField({
  action,
  defaultValue,
}: {
  action: string;
  defaultValue: string;
}) {
  return (
    <Box
      action={action}
      component="form"
      method="get"
      role="search"
      sx={{
        alignItems: "center",
        bgcolor: "surface.1",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 2,
        color: "text.secondary",
        display: "flex",
        flex: { xs: "0 0 auto", sm: "0 1 300px" },
        gap: 1,
        height: 44,
        minWidth: 0,
        px: 1.25,
        transition: "border-color 160ms ease, background-color 160ms ease",
        "&:focus-within": {
          bgcolor: "surface.2",
          borderColor: "border.strong",
          color: "text.primary",
        },
      }}
    >
      <SearchIcon sx={{ fontSize: 18 }} />
      <InputBase
        defaultValue={defaultValue}
        inputProps={{ "aria-label": "Search people" }}
        name="q"
        placeholder="Search directors, cast, studios"
        sx={{ color: "text.primary", flex: 1, fontSize: "0.875rem", minWidth: 0 }}
      />
    </Box>
  );
}
