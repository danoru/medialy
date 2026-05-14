"use client";

import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
} from "@mui/material";
import { useActionState, useMemo, useState } from "react";
import { MediaStatus, type MediaType, type TagStatus } from "@prisma/client";
import type { MediaItemDTO } from "@/lib/types";
import { formatMediaType, formatStatus } from "@/lib/format";
import { VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import { getGenresForMediaType, MAX_GENRES_PER_ITEM } from "@/lib/taxonomy";

type TagOption = {
  name: string;
  status: TagStatus;
};

type MediaFormActionState = {
  message: string;
  severity: "error" | "success";
  submittedAt: number;
};

const initialActionState: MediaFormActionState = {
  message: "",
  severity: "error",
  submittedAt: 0,
};

export function MediaForm({
  action,
  item,
  submitLabel,
  tagOptions = [],
}: {
  action: (
    state: MediaFormActionState,
    formData: FormData,
  ) => MediaFormActionState | Promise<MediaFormActionState>;
  item?: MediaItemDTO;
  submitLabel: string;
  tagOptions?: TagOption[];
}) {
  const [actionState, formAction, isPending] = useActionState(
    action,
    initialActionState,
  );
  const [dismissedSubmission, setDismissedSubmission] = useState(0);
  const [mediaType, setMediaType] = useState<MediaType>(
    item?.mediaType ?? "MOVIE",
  );
  const [genres, setGenres] = useState<string[]>(item?.genres ?? []);
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const genreOptions = useMemo(
    () => getGenresForMediaType(mediaType),
    [mediaType],
  );
  const tagNames = useMemo(
    () => tagOptions.map((tag) => tag.name),
    [tagOptions],
  );
  const tagStatusByName = useMemo(
    () => new Map(tagOptions.map((tag) => [tag.name, tag.status])),
    [tagOptions],
  );

  const snackbarOpen =
    actionState.submittedAt > 0 &&
    actionState.submittedAt !== dismissedSubmission;

  return (
    <form action={formAction}>
      {genres.map((genre) => (
        <input key={genre} name="genres" type="hidden" value={genre} />
      ))}
      <input name="tags" type="hidden" value={tags.join(";")} />
      <Stack spacing={3}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              defaultValue={item?.title ?? ""}
              fullWidth
              label="Title"
              name="title"
              required
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              defaultValue={item?.originalTitle ?? ""}
              fullWidth
              label="Original title"
              name="originalTitle"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Type"
              name="mediaType"
              onChange={(event) => {
                const nextType = event.target.value as MediaType;
                setMediaType(nextType);
                setGenres((current) =>
                  current.filter((genre) =>
                    getGenresForMediaType(nextType).includes(genre),
                  ),
                );
              }}
              select
              value={mediaType}
            >
              {VISIBLE_MEDIA_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {formatMediaType(type)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              defaultValue={item?.status ?? "UNTRACKED"}
              fullWidth
              label="Status"
              name="status"
              select
            >
              {Object.values(MediaStatus).map((status) => (
                <MenuItem key={status} value={status}>
                  {formatStatus(status)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              defaultValue={item?.personalRating ?? ""}
              fullWidth
              label="Personal rating"
              name="personalRating"
              slotProps={{ htmlInput: { min: 0, max: 10, step: 0.1 } }}
              type="number"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              defaultValue={dateValue(item?.releaseDate)}
              fullWidth
              label="Release date"
              name="releaseDate"
              slotProps={{ inputLabel: { shrink: true } }}
              type="date"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Autocomplete
              getOptionDisabled={(option) =>
                genres.length >= MAX_GENRES_PER_ITEM && !genres.includes(option)
              }
              multiple
              onChange={(_, value) => {
                setGenres(value.slice(0, MAX_GENRES_PER_ITEM));
              }}
              options={genreOptions}
              renderInput={(params) => (
                <TextField
                  {...params}
                  helperText={`Choose up to ${MAX_GENRES_PER_ITEM} canonical genres.`}
                  label="Genres"
                />
              )}
              value={genres}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Autocomplete
              freeSolo
              fullWidth
              multiple
              onChange={(_, value) => {
                setTags(value.filter(Boolean));
              }}
              options={tagNames}
              renderInput={(params) => (
                <TextField
                  {...params}
                  helperText="Existing tags autocomplete; new tags save as pending."
                  label="Tags"
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option}>
                  {option}
                  {tagStatusByName.get(option) === "PENDING"
                    ? " (pending)"
                    : ""}
                </li>
              )}
              value={tags}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              defaultValue={item?.externalUrl ?? ""}
              fullWidth
              label="External URL"
              name="externalUrl"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              defaultValue={item?.description ?? ""}
              fullWidth
              label="Description"
              minRows={3}
              multiline
              name="description"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              defaultValue={item?.metadataJson ?? ""}
              fullWidth
              label="Metadata JSON"
              minRows={3}
              multiline
              name="metadataJson"
            />
          </Grid>
        </Grid>
        <FormControlLabel
          control={
            <Checkbox
              defaultChecked={item?.isFavorite ?? false}
              name="isFavorite"
            />
          }
          label="Favorite"
        />
        <Button
          disabled={isPending}
          sx={{ alignSelf: "flex-start" }}
          type="submit"
          variant="contained"
        >
          {submitLabel}
        </Button>
      </Stack>
      <Snackbar
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        autoHideDuration={4000}
        onClose={() => setDismissedSubmission(actionState.submittedAt)}
        open={snackbarOpen}
      >
        <Alert
          onClose={() => setDismissedSubmission(actionState.submittedAt)}
          severity={actionState.severity}
          variant="filled"
        >
          {actionState.message}
        </Alert>
      </Snackbar>
    </form>
  );
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}
