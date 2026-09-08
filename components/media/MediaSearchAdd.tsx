"use client";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { MediaType } from "@prisma/client";
import { useState, useTransition } from "react";
import {
  addMediaFromProvider,
  searchMediaProviders,
} from "@/app/media/new/actions";
import type {
  ProviderCandidate,
  ProviderIssue,
  ProviderSearchOutcome,
} from "@/lib/metadata/providers";
import { formatMediaType } from "@/lib/format";
import { SEARCHABLE_MEDIA_TYPES } from "@/lib/metadata/providers";

/**
 * Type a title, pick it from the results, done.
 *
 * The media type is optional: leaving it on "Any" searches films, series and
 * games together. Someone adding a film they just watched shouldn't have to
 * classify it first.
 */
export function MediaSearchAdd({ manualHref }: { manualHref: string }) {
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<MediaType | "">("");
  const [outcome, setOutcome] = useState<ProviderSearchOutcome | null>(null);
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();

  const runSearch = () => {
    if (query.trim().length < 2) return;
    startSearch(async () => {
      setOutcome(await searchMediaProviders(query, mediaType || null));
    });
  };

  const add = (candidate: ProviderCandidate) => {
    startAdd(async () => {
      const formData = new FormData();
      formData.set("source", candidate.source);
      formData.set("sourceId", candidate.sourceId);
      formData.set("mediaType", candidate.mediaType);
      await addMediaFromProvider(formData);
    });
  };

  return (
    <Stack spacing={3}>
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ alignItems: { sm: "flex-start" } }}
        >
          <TextField
            autoFocus
            fullWidth
            label="Title"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. The Godfather"
            value={query}
          />
          <TextField
            label="Type"
            onChange={(event) =>
              setMediaType(event.target.value as MediaType | "")
            }
            select
            sx={{ minWidth: 160 }}
            value={mediaType}
          >
            <MenuItem value="">Any</MenuItem>
            {SEARCHABLE_MEDIA_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {formatMediaType(type)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            disabled={query.trim().length < 2 || searching}
            startIcon={<SearchRoundedIcon />}
            sx={{ minHeight: 56, px: 3 }}
            type="submit"
            variant="contained"
          >
            Search
          </Button>
        </Stack>
      </Box>

      {searching ? (
        <Stack sx={{ alignItems: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Stack>
      ) : null}

      {!searching && outcome != null && outcome.issues.length > 0 ? (
        <Alert severity="warning">{issueMessage(outcome.issues)}</Alert>
      ) : null}

      {!searching && outcome != null ? (
        outcome.candidates.length > 0 ? (
          <Stack spacing={1}>
            {outcome.candidates.map((candidate) => (
              <ResultRow
                candidate={candidate}
                disabled={adding}
                key={`${candidate.source}:${candidate.sourceId}`}
                onAdd={() => add(candidate)}
              />
            ))}
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={emptySx}>
            <Typography sx={{ fontWeight: 600 }}>
              Nothing found for “{query}”.
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {outcome.issues.length > 0
                ? "Some searches couldn’t run, so this may not be the whole picture. You can still enter the details yourself — an admin will review it before it joins the catalog."
                : "Check the spelling, or enter the details yourself — an admin will review it before it joins the catalog."}
            </Typography>
            <Button
              href={manualHref}
              sx={{ alignSelf: "flex-start", minHeight: 44 }}
              variant="outlined"
            >
              Enter it manually
            </Button>
          </Stack>
        )
      ) : null}
    </Stack>
  );
}

/**
 * A missing API key and a genuine miss look identical in a list of zero
 * results, so name the searches that couldn't run. The wording stays
 * user-facing — "isn't configured", not "RAWG_API_KEY is unset" — but it's
 * enough of a signal to send an operator to the env vars rather than to the
 * spelling of the title they just typed.
 */
function issueMessage(issues: ProviderIssue[]) {
  const types = issues.map((issue) => formatMediaType(issue.mediaType));
  const list =
    types.length > 1
      ? `${types.slice(0, -1).join(", ")} and ${types[types.length - 1]}`
      : types[0];

  return issues.every((issue) => issue.reason === "not_configured")
    ? `${list} search isn’t configured on this server, so those results are missing.`
    : `${list} search is temporarily unavailable, so those results are missing.`;
}

function ResultRow({
  candidate,
  disabled,
  onAdd,
}: {
  candidate: ProviderCandidate;
  disabled: boolean;
  onAdd: () => void;
}) {
  return (
    <Box sx={rowSx}>
      <Box
        sx={{
          backgroundImage: candidate.posterUrl
            ? `url(${candidate.posterUrl})`
            : "none",
          backgroundColor: "surface.2",
          backgroundPosition: "center",
          backgroundSize: "cover",
          borderRadius: 1,
          flexShrink: 0,
          height: 72,
          width: 48,
        }}
      />
      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {candidate.title}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {formatMediaType(candidate.mediaType)}
          {candidate.year ? ` · ${candidate.year}` : ""}
        </Typography>
        {candidate.overview ? (
          <Typography
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
            }}
            variant="body2"
          >
            {candidate.overview}
          </Typography>
        ) : null}
      </Stack>
      <Button
        disabled={disabled}
        onClick={onAdd}
        sx={{ flexShrink: 0, minHeight: 44 }}
        variant="contained"
      >
        Add
      </Button>
    </Box>
  );
}

const rowSx = {
  alignItems: "center",
  bgcolor: "surface.1",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 1,
  display: "flex",
  gap: 1.5,
  p: 1.5,
};

const emptySx = {
  border: "1px dashed",
  borderColor: "border.subtle",
  borderRadius: 1,
  p: 2.5,
};
