"use client";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import Link from "next/link";
import type { MediaType, RelationKind, ReleaseKind } from "@prisma/client";
import { useState, useTransition } from "react";
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

/**
 * Relations and re-releases, staged as part of the parent metadata form.
 *
 * These used to be self-submitting forms with their own "Add link" / "Add"
 * buttons, which meant editing a title *and* its sequel *and* a re-release took
 * three separate saves — and, for a non-admin, the connections wrote straight to
 * the shared catalog while the metadata went to review. Now everything is
 * staged in local state, serialized into hidden inputs, and committed by the
 * form's single "Save changes" button, through the same review pipeline.
 */
export function MediaConnectionsPanel({
  canEdit,
  fallbackTitle,
  relations: initialRelations,
  events: initialEvents,
  searchAction,
}: {
  canEdit: boolean;
  /** Item's own title, used when a release event has no distinct name. */
  fallbackTitle: string;
  relations: RelationView[];
  events: ReleaseEventView[];
  searchAction: (query: string) => Promise<SearchOption[]>;
}) {
  const [relations, setRelations] = useState<RelationView[]>(initialRelations);
  const [events, setEvents] = useState<ReleaseEventView[]>(initialEvents);

  const hasAny = relations.length > 0 || events.length > 0;
  if (!hasAny && !canEdit) return null;

  return (
    <Stack spacing={3}>
      {/* The staged sets, handed to the parent <form> on submit. Always present
          (even when empty) so the server can tell "no connections" apart from
          "this caller doesn't manage connections" (e.g. CSV import). */}
      <input
        name="relationsJson"
        type="hidden"
        value={JSON.stringify(
          relations.map((relation) => ({
            kind: relation.kind,
            direction: relation.direction,
            otherId: relation.other.id,
            otherTitle: relation.other.title,
          })),
        )}
      />
      <input
        name="releaseEventsJson"
        type="hidden"
        value={JSON.stringify(
          events.map((event) => ({
            kind: event.kind,
            date: event.date,
            title: event.title,
          })),
        )}
      />

      <RelationsSection
        canEdit={canEdit}
        onAdd={(relation) => setRelations((current) => [...current, relation])}
        onRemove={(id) =>
          setRelations((current) => current.filter((r) => r.id !== id))
        }
        relations={relations}
        searchAction={searchAction}
      />
      <Divider />
      <ReleaseEventsSection
        canEdit={canEdit}
        events={events}
        fallbackTitle={fallbackTitle}
        onAdd={(event) => setEvents((current) => [...current, event])}
        onRemove={(id) =>
          setEvents((current) => current.filter((e) => e.id !== id))
        }
      />
    </Stack>
  );
}

/** Eyebrow-style subsection label, subordinate to the card's "Connections"
 *  title (uppercase, small, tracked — see the theme `eyebrow` variant). */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return <Typography variant="eyebrow">{children}</Typography>;
}

/** Compact muted placeholder shown when a subsection has no entries. */
function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={emptyRowSx}>
      <Typography color="text.secondary" variant="body2">
        {children}
      </Typography>
    </Box>
  );
}

function RelationsSection({
  canEdit,
  onAdd,
  onRemove,
  relations,
  searchAction,
}: {
  canEdit: boolean;
  onAdd: (relation: RelationView) => void;
  onRemove: (id: string) => void;
  relations: RelationView[];
  searchAction: (query: string) => Promise<SearchOption[]>;
}) {
  return (
    <Stack spacing={1.5}>
      <SectionHeading>Related titles</SectionHeading>
      {relations.length > 0 ? (
        <Stack spacing={1}>
          {relations.map((relation) => {
            const label =
              relation.direction === "forward"
                ? RELATION_FORWARD_LABEL[relation.kind]
                : RELATION_INVERSE_LABEL[relation.kind];
            return (
              <Box key={relation.id} sx={rowSx}>
                <Chip label={label} size="small" sx={{ flexShrink: 0 }} />
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
                  sx={{ flexShrink: 0, ml: canEdit ? 0 : "auto" }}
                  variant="outlined"
                />
                {canEdit ? (
                  <IconButton
                    aria-label={`Remove link to ${relation.other.title}`}
                    onClick={() => onRemove(relation.id)}
                    sx={{ height: 44, ml: "auto", width: 44 }}
                  >
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </Box>
            );
          })}
        </Stack>
      ) : (
        <EmptyRow>No related titles yet.</EmptyRow>
      )}
      {canEdit ? (
        <AddRelationRow onAdd={onAdd} searchAction={searchAction} />
      ) : null}
    </Stack>
  );
}

function AddRelationRow({
  onAdd,
  searchAction,
}: {
  onAdd: (relation: RelationView) => void;
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

  const stage = () => {
    if (!target || !kind) return;
    onAdd({
      // Local-only id: this row doesn't exist in the DB until the form saves.
      id: `new:${kind}:${target.id}`,
      kind,
      direction: "forward",
      other: target,
    });
    setTarget(null);
    setKind("");
    setOptions([]);
  };

  return (
    <Box sx={addFormSx}>
      <Typography sx={addFormCaptionSx} variant="labelMd">
        Add a related title
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ alignItems: { sm: "center" } }}
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
        {/* type="button": staging must not submit the parent form. */}
        <Button
          disabled={!target || !kind}
          onClick={stage}
          sx={{ minHeight: 44 }}
          type="button"
          variant="outlined"
        >
          Add link
        </Button>
      </Stack>
    </Box>
  );
}

function ReleaseEventsSection({
  canEdit,
  events,
  fallbackTitle,
  onAdd,
  onRemove,
}: {
  canEdit: boolean;
  events: ReleaseEventView[];
  fallbackTitle: string;
  onAdd: (event: ReleaseEventView) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Stack spacing={1.5}>
      <SectionHeading>Re-releases &amp; editions</SectionHeading>
      {events.length > 0 ? (
        <Stack spacing={1}>
          {events.map((event) => (
            <Box key={event.id} sx={rowSx}>
              <Chip
                color="secondary"
                label={RELEASE_KIND_LABEL[event.kind]}
                size="small"
                sx={{ flexShrink: 0 }}
              />
              <Typography sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                {event.title ?? fallbackTitle}
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ ml: "auto", whiteSpace: "nowrap" }}
                variant="body2"
              >
                {new Date(event.date).toLocaleDateString()}
              </Typography>
              {canEdit ? (
                <IconButton
                  aria-label={`Remove ${RELEASE_KIND_LABEL[event.kind]}`}
                  onClick={() => onRemove(event.id)}
                  sx={{ height: 44, width: 44 }}
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              ) : null}
            </Box>
          ))}
        </Stack>
      ) : (
        <EmptyRow>No remasters, ports, or re-releases recorded.</EmptyRow>
      )}
      {canEdit ? <AddReleaseEventRow onAdd={onAdd} /> : null}
    </Stack>
  );
}

function AddReleaseEventRow({
  onAdd,
}: {
  onAdd: (event: ReleaseEventView) => void;
}) {
  // Blank by default — the type must be chosen explicitly before this can save.
  const [kind, setKind] = useState<ReleaseKind | "">("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");

  const stage = () => {
    if (!kind || !date) return;
    onAdd({
      id: `new:${kind}:${date}:${title}`,
      kind,
      date: new Date(`${date}T00:00:00`).toISOString(),
      title: title.trim() || null,
    });
    setKind("");
    setTitle("");
    setDate("");
  };

  return (
    <Box sx={addFormSx}>
      <Typography sx={addFormCaptionSx} variant="labelMd">
        Add a re-release
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ alignItems: { sm: "center" } }}
      >
        <TextField
          label="Type"
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
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Anniversary, Switch 2"
          size="small"
          sx={{ flex: 1, minWidth: 180 }}
          value={title}
        />
        <TextField
          label="Release date"
          onChange={(event) => setDate(event.target.value)}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          type="date"
          value={date}
        />
        <Button
          disabled={!kind || !date}
          onClick={stage}
          sx={{ minHeight: 44 }}
          type="button"
          variant="outlined"
        >
          Add
        </Button>
      </Stack>
    </Box>
  );
}

const rowSx: SxProps<Theme> = {
  alignItems: "center",
  bgcolor: "surface.1",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 1,
  display: "flex",
  gap: 1,
  px: 1.5,
  py: 1,
};

const emptyRowSx: SxProps<Theme> = {
  border: "1px dashed",
  borderColor: "border.subtle",
  borderRadius: 1,
  px: 1.5,
  py: 1,
};

const addFormSx: SxProps<Theme> = {
  bgcolor: "surface.1",
  border: "1px solid",
  borderColor: "border.subtle",
  borderRadius: 1,
  p: 1.5,
};

const addFormCaptionSx: SxProps<Theme> = {
  color: "text.secondary",
  display: "block",
  mb: 1,
};
