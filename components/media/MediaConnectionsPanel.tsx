"use client";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import type { MediaType, RelationKind, ReleaseKind } from "@prisma/client";
import { useRef, useState, useTransition } from "react";
import { formatMediaType } from "@/lib/format";
import {
  RELATION_FORWARD_LABEL,
  RELATION_INVERSE_LABEL,
  RELATION_KIND_OPTIONS,
  RELEASE_KIND_LABEL,
  RELEASE_KIND_OPTIONS,
} from "@/lib/media-relations";

export type RelationView = {
  id: string;
  kind: RelationKind;
  /** "forward" = this item is the `from` side (use the forward label);
   *  "inverse" = this item is the `to` side (use the inverse label). */
  direction: "forward" | "inverse";
  other: { id: string; title: string; mediaType: MediaType };
};

export type ReleaseEventView = {
  id: string;
  kind: ReleaseKind;
  date: string; // ISO
  title: string | null;
};

type SearchOption = { id: string; title: string; mediaType: MediaType };

type BoundFormAction = (formData: FormData) => void | Promise<void>;

export function MediaConnectionsPanel({
  canEdit,
  fallbackTitle,
  relations,
  events,
  addRelationAction,
  removeRelationAction,
  addEventAction,
  removeEventAction,
  searchAction,
}: {
  canEdit: boolean;
  /** Item's own title, used when a release event has no distinct name. */
  fallbackTitle: string;
  relations: RelationView[];
  events: ReleaseEventView[];
  addRelationAction: BoundFormAction;
  removeRelationAction: (relationId: string) => void | Promise<void>;
  addEventAction: BoundFormAction;
  removeEventAction: (eventId: string) => void | Promise<void>;
  searchAction: (query: string) => Promise<SearchOption[]>;
}) {
  const hasAny = relations.length > 0 || events.length > 0;
  // Nothing to show and nothing to add (anonymous viewer) — render nothing.
  if (!hasAny && !canEdit) return null;

  return (
    <Box>
      <Stack spacing={2.5}>
        <RelationsSection
          addAction={addRelationAction}
          canEdit={canEdit}
          relations={relations}
          removeAction={removeRelationAction}
          searchAction={searchAction}
        />
        <ReleaseEventsSection
          addAction={addEventAction}
          canEdit={canEdit}
          events={events}
          fallbackTitle={fallbackTitle}
          removeAction={removeEventAction}
        />
      </Stack>
    </Box>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontWeight: 650 }} variant="h6">
      {children}
    </Typography>
  );
}

function RelationsSection({
  addAction,
  canEdit,
  relations,
  removeAction,
  searchAction,
}: {
  addAction: BoundFormAction;
  canEdit: boolean;
  relations: RelationView[];
  removeAction: (relationId: string) => void | Promise<void>;
  searchAction: (query: string) => Promise<SearchOption[]>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Stack spacing={1.25}>
      <SectionHeading>Related titles</SectionHeading>
      {relations.length > 0 ? (
        <Stack spacing={1}>
          {relations.map((relation) => {
            const label =
              relation.direction === "forward"
                ? RELATION_FORWARD_LABEL[relation.kind]
                : RELATION_INVERSE_LABEL[relation.kind];
            return (
              <Stack
                direction="row"
                key={relation.id}
                spacing={1}
                sx={{ alignItems: "center" }}
              >
                <Chip label={label} size="small" />
                <Link
                  href={`/media/${relation.other.id}`}
                  style={{ textDecoration: "none", minWidth: 0 }}
                >
                  <Typography
                    noWrap
                    sx={{ color: "primary.main", fontWeight: 600 }}
                  >
                    {relation.other.title}
                  </Typography>
                </Link>
                <Chip
                  label={formatMediaType(relation.other.mediaType)}
                  size="small"
                  variant="outlined"
                />
                {canEdit ? (
                  <IconButton
                    aria-label="Remove link"
                    onClick={() =>
                      startTransition(() => removeAction(relation.id))
                    }
                    size="small"
                    sx={{ ml: "auto" }}
                  >
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </Stack>
            );
          })}
        </Stack>
      ) : (
        <Typography color="text.secondary" variant="body2">
          No related titles yet.
        </Typography>
      )}
      {canEdit ? (
        <AddRelationForm
          addAction={addAction}
          disabled={isPending}
          searchAction={searchAction}
        />
      ) : null}
    </Stack>
  );
}

function AddRelationForm({
  addAction,
  disabled,
  searchAction,
}: {
  addAction: BoundFormAction;
  disabled: boolean;
  searchAction: (query: string) => Promise<SearchOption[]>;
}) {
  // Start blank so a relationship is a deliberate choice — never defaults to a
  // kind the user didn't pick.
  const [kind, setKind] = useState<RelationKind | "">("");
  const [target, setTarget] = useState<SearchOption | null>(null);
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [, startSearch] = useTransition();

  const onSearch = (value: string) => {
    if (value.trim().length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    startSearch(async () => {
      const found = await searchAction(value);
      setOptions(found);
      setLoading(false);
    });
  };

  return (
    <Box
      action={(formData: FormData) => {
        if (!target || !kind) return;
        formData.set("kind", kind);
        formData.set("toId", target.id);
        addAction(formData);
        setTarget(null);
        setKind("");
        setOptions([]);
      }}
      component="form"
      sx={{ mt: 0.5 }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ alignItems: { sm: "flex-start" } }}
      >
        <TextField
          label="This title is a…"
          onChange={(event) => setKind(event.target.value as RelationKind)}
          select
          size="small"
          sx={{ minWidth: 160 }}
          value={kind}
        >
          <MenuItem value="">
            <em>Select relationship…</em>
          </MenuItem>
          {RELATION_KIND_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Autocomplete
          filterOptions={(options) => options}
          getOptionLabel={(option) =>
            `${option.title} (${formatMediaType(option.mediaType)})`
          }
          isOptionEqualToValue={(option, value) => option.id === value.id}
          loading={loading}
          onChange={(_, value) => setTarget(value)}
          onInputChange={(_, value) => onSearch(value)}
          options={options}
          renderInput={(params) => (
            <TextField {...params} label="…of this title" />
          )}
          size="small"
          sx={{ flex: 1, minWidth: 220 }}
          value={target}
        />
        <Button
          disabled={disabled || !target || !kind}
          size="medium"
          type="submit"
          variant="contained"
        >
          Add link
        </Button>
      </Stack>
    </Box>
  );
}

function ReleaseEventsSection({
  addAction,
  canEdit,
  events,
  fallbackTitle,
  removeAction,
}: {
  addAction: BoundFormAction;
  canEdit: boolean;
  events: ReleaseEventView[];
  fallbackTitle: string;
  removeAction: (eventId: string) => void | Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Stack spacing={1.25}>
      <SectionHeading>Re-releases &amp; editions</SectionHeading>
      {events.length > 0 ? (
        <Stack spacing={1}>
          {events.map((event) => (
            <Stack
              direction="row"
              key={event.id}
              spacing={1}
              sx={{ alignItems: "center" }}
            >
              <Chip
                color="secondary"
                label={RELEASE_KIND_LABEL[event.kind]}
                size="small"
              />
              <Typography sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                {event.title ?? fallbackTitle}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {new Date(event.date).toLocaleDateString()}
              </Typography>
              {canEdit ? (
                <IconButton
                  aria-label="Remove re-release"
                  onClick={() => startTransition(() => removeAction(event.id))}
                  size="small"
                  sx={{ ml: "auto" }}
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography color="text.secondary" variant="body2">
          No remasters, ports, or re-releases recorded.
        </Typography>
      )}
      {canEdit ? (
        <AddReleaseEventForm addAction={addAction} disabled={isPending} />
      ) : null}
    </Stack>
  );
}

function AddReleaseEventForm({
  addAction,
  disabled,
}: {
  addAction: BoundFormAction;
  disabled: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  // Blank by default — the type must be chosen explicitly before this can save.
  const [kind, setKind] = useState<ReleaseKind | "">("");

  return (
    <Box
      action={(formData: FormData) => {
        if (!kind) return;
        addAction(formData);
        formRef.current?.reset();
        setKind("");
      }}
      component="form"
      ref={formRef}
      sx={{ mt: 0.5 }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ alignItems: { sm: "flex-start" } }}
      >
        <TextField
          label="Type"
          name="kind"
          onChange={(event) => setKind(event.target.value as ReleaseKind)}
          select
          size="small"
          sx={{ minWidth: 130 }}
          value={kind}
        >
          <MenuItem value="">
            <em>Select type…</em>
          </MenuItem>
          {RELEASE_KIND_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Name (optional)"
          name="title"
          placeholder="e.g. Anniversary, Switch 2"
          size="small"
          sx={{ flex: 1, minWidth: 180 }}
        />
        <TextField
          label="Release date"
          name="date"
          required
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          type="date"
        />
        <Button
          disabled={disabled || !kind}
          size="medium"
          type="submit"
          variant="contained"
        >
          Add
        </Button>
      </Stack>
    </Box>
  );
}
