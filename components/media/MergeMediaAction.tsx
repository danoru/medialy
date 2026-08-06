"use client";

import MergeTypeIcon from "@mui/icons-material/MergeType";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { MediaType } from "@prisma/client";
import { useState, useTransition } from "react";
import { formatMediaType } from "@/lib/format";
import type { MergePreview } from "@/lib/media-merge";

type SearchOption = { id: string; title: string; mediaType: MediaType };

/**
 * Fold this entry into another one. The item being edited is the one that
 * disappears, which is the opposite of what "merge" usually implies in a list
 * UI, so every label here names both sides explicitly.
 *
 * Selecting a target runs a server-side dry run rather than describing the
 * merge from client-side guesses — the counts include other users' libraries,
 * which this component can't see.
 */
export function MergeMediaAction({
  action,
  duplicateTitle,
  previewAction,
  searchAction,
}: {
  action: (formData: FormData) => void | Promise<void>;
  duplicateTitle: string;
  previewAction: (survivorId: string) => Promise<MergePreview | null>;
  searchAction: (query: string) => Promise<SearchOption[]>;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<SearchOption | null>(null);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [previewing, startPreview] = useTransition();
  const [, startSearch] = useTransition();

  const close = () => {
    setOpen(false);
    setTarget(null);
    setPreview(null);
    setOptions([]);
  };

  const onSearch = (value: string) => {
    if (value.trim().length < 2) {
      setOptions([]);
      return;
    }
    setSearching(true);
    startSearch(async () => {
      const found = await searchAction(value);
      setOptions(found);
      setSearching(false);
    });
  };

  const onPick = (value: SearchOption | null) => {
    setTarget(value);
    setPreview(null);
    if (!value) return;
    startPreview(async () => {
      setPreview(await previewAction(value.id));
    });
  };

  const typeMismatch =
    target &&
    preview &&
    preview.duplicate.mediaType !== preview.survivor.mediaType;

  return (
    <>
      <Button
        color="primary"
        onClick={() => setOpen(true)}
        startIcon={<MergeTypeIcon />}
        variant="outlined"
      >
        Merge into another item
      </Button>

      <Dialog fullWidth maxWidth="sm" onClose={close} open={open}>
        <DialogTitle>Merge &ldquo;{duplicateTitle}&rdquo; into…</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <DialogContentText>
              Everything attached to &ldquo;{duplicateTitle}&rdquo; moves onto
              the item you pick, and this entry is deleted. Where both already
              have a value, the one you pick keeps its own.
            </DialogContentText>
            <Autocomplete
              filterOptions={(options) => options}
              getOptionLabel={(option) =>
                `${option.title} (${formatMediaType(option.mediaType)})`
              }
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={searching}
              onChange={(_, value) => onPick(value)}
              onInputChange={(_, value) => onSearch(value)}
              options={options}
              renderInput={(params) => (
                <TextField {...params} label="Keep this item" autoFocus />
              )}
              value={target}
            />

            {previewing ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <CircularProgress size={18} />
                <Typography color="text.secondary" variant="body2">
                  Checking what will move…
                </Typography>
              </Stack>
            ) : null}

            {typeMismatch ? (
              <Alert severity="error">
                These are different media types. Link them as related titles
                instead of merging.
              </Alert>
            ) : null}

            {preview && !typeMismatch ? (
              <MergeSummary preview={preview} />
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Cancel</Button>
          <form action={action}>
            <input name="survivorId" type="hidden" value={target?.id ?? ""} />
            <Button
              color="error"
              disabled={!target || previewing || Boolean(typeMismatch)}
              type="submit"
              variant="contained"
            >
              Merge and delete
            </Button>
          </form>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** What the merge will actually do, in the order an admin cares about:
 *  other people's data first, catalog metadata second. */
function MergeSummary({ preview }: { preview: MergePreview }) {
  const lines: string[] = [];

  if (preview.statusesMoved > 0) {
    lines.push(
      `${count(preview.statusesMoved, "status")} carried over to "${preview.survivor.title}"`,
    );
  }
  if (preview.statusesMerged > 0) {
    lines.push(
      `${count(preview.statusesMerged, "user")} already tracking both — their two entries get combined`,
    );
  }
  if (preview.comparisonsDropped > 0) {
    lines.push(
      `${count(preview.comparisonsDropped, "comparison")} discarded (rankings can't be transferred)`,
    );
  }
  if (preview.notesMoved > 0)
    lines.push(`${count(preview.notesMoved, "note")} moved`);
  if (preview.listsMoved > 0) {
    lines.push(`moved in ${count(preview.listsMoved, "list")}`);
  }
  if (preview.genresAdded > 0)
    lines.push(`${count(preview.genresAdded, "genre")} added`);
  if (preview.tagsAdded > 0)
    lines.push(`${count(preview.tagsAdded, "tag")} added`);
  if (preview.creditsAdded > 0) {
    lines.push(`${count(preview.creditsAdded, "credit")} added`);
  }
  if (preview.externalRatingsAdded > 0) {
    lines.push(
      `${count(preview.externalRatingsAdded, "external rating")} added`,
    );
  }
  if (preview.relationsMoved > 0) {
    lines.push(`${count(preview.relationsMoved, "related title")} relinked`);
  }
  if (preview.releaseEventsMoved > 0) {
    lines.push(`${count(preview.releaseEventsMoved, "re-release")} moved`);
  }
  if (preview.fieldsInherited.length > 0) {
    lines.push(
      `fills in blank ${preview.fieldsInherited.map(fieldLabel).join(", ")}`,
    );
  }

  return (
    <Box
      sx={{
        bgcolor: "surface.1",
        border: "1px solid",
        borderColor: "border.subtle",
        borderRadius: 1,
        p: 1.5,
      }}
    >
      <Typography
        sx={{ color: "text.secondary", display: "block", mb: 1 }}
        variant="labelMd"
      >
        What this will do
      </Typography>
      {lines.length > 0 ? (
        <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
          {lines.map((line) => (
            <Typography component="li" key={line} variant="body2">
              {line}
            </Typography>
          ))}
        </Stack>
      ) : (
        <Typography color="text.secondary" variant="body2">
          Nothing to carry over — this entry is empty. It will just be deleted.
        </Typography>
      )}
    </Box>
  );
}

function count(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

const FIELD_LABELS: Record<string, string> = {
  originalTitle: "original title",
  description: "description",
  releaseDate: "release date",
  posterUrl: "poster",
  externalUrl: "external link",
  metadataJson: "metadata",
  platformsJson: "platforms",
};

function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field;
}
