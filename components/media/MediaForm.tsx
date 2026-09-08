"use client";

import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useActionState, useMemo, useState } from "react";
import { type MediaType, type TagStatus } from "@prisma/client";
import type { MediaItemDTO } from "@/lib/types";
import {
  CREDIT_ROLES_BY_MEDIA_TYPE,
  creditFieldName,
  creditLabel,
  creditsForRole,
} from "@/lib/credits";
import {
  manualRatingRemoveField,
  manualRatingsForMediaType,
  type ManualExternalRatingDef,
} from "@/lib/external-ratings";
import { formatMediaType } from "@/lib/format";
import { VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import {
  getGenresForMediaType,
  MAX_GENRES_PER_ITEM,
  tagMetadataAllowsMediaType,
} from "@/lib/taxonomy";

type TagOption = {
  name: string;
  status: TagStatus;
  mediaTypesJson?: string | null;
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

/**
 * The shared-catalog metadata form.
 *
 * Deliberately contains *no* per-user fields. It used to carry `personalRating`,
 * `status` and `isFavorite` alongside the catalog data, which meant a non-admin
 * who typed a rating here lost it silently: `updateMediaItem` writes an edit
 * suggestion and returns before `upsertUserMedia` runs, and the suggestion
 * snapshot has nowhere to put a personal score. Rating now lives only on the
 * stars (see `StarRating`), where it writes straight to `UserMedia`.
 */
export function MediaForm({
  action,
  connections,
  isAdmin = false,
  item,
  submitLabel,
  tagOptions = [],
}: {
  action: (
    state: MediaFormActionState,
    formData: FormData,
  ) => MediaFormActionState | Promise<MediaFormActionState>;
  /**
   * Relations / re-releases editor, rendered *inside* this form so its staged
   * hidden inputs are submitted by the same "Save changes" button.
   */
  connections?: React.ReactNode;
  isAdmin?: boolean;
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
    () =>
      tagOptions
        .filter((tag) =>
          tagMetadataAllowsMediaType(tag.mediaTypesJson, mediaType),
        )
        .map((tag) => tag.name),
    [mediaType, tagOptions],
  );
  const tagStatusByName = useMemo(
    () => new Map(tagOptions.map((tag) => [tag.name, tag.status])),
    [tagOptions],
  );
  const manualRatingDefs = useMemo(
    () => manualRatingsForMediaType(mediaType),
    [mediaType],
  );
  const initialRatingValues = useMemo(() => {
    const map = new Map<string, string>();
    for (const rating of item?.externalRatings ?? []) {
      map.set(rating.source, String(rating.score));
    }
    return map;
  }, [item?.externalRatings]);

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
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
                setTags((current) =>
                  current.filter((tag) =>
                    tagOptions.some(
                      (option) =>
                        option.name === tag &&
                        tagMetadataAllowsMediaType(
                          option.mediaTypesJson,
                          nextType,
                        ),
                    ),
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
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              defaultValue={dateValue(item?.releaseDate)}
              fullWidth
              label="Release date"
              name="releaseDate"
              slotProps={{ inputLabel: { shrink: true } }}
              type="date"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              defaultValue={item?.externalUrl ?? ""}
              fullWidth
              label="External URL"
              name="externalUrl"
            />
          </Grid>
          {CREDIT_ROLES_BY_MEDIA_TYPE[mediaType].map((role) => (
            <Grid key={role} size={{ xs: 12, md: 6 }}>
              <TextField
                defaultValue={creditsForRole(item?.credits ?? [], role).join(
                  "; ",
                )}
                fullWidth
                helperText="Separate multiple names with semicolons."
                label={creditLabel(mediaType, role)}
                name={creditFieldName(role)}
              />
            </Grid>
          ))}
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
                setTags([
                  ...new Map(
                    value
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                      .map((tag) => [tag.toLowerCase(), tag]),
                  ).values(),
                ]);
              }}
              options={tagNames}
              renderInput={(params) => (
                <TextField
                  {...params}
                  helperText="Choose approved tags, or type a new tag and press Enter to save it as pending."
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
          {manualRatingDefs.map((def: ManualExternalRatingDef) => {
            const existing = initialRatingValues.get(def.source);
            return (
              <Grid key={def.source} size={{ xs: 12, md: 6 }}>
                <TextField
                  defaultValue={existing ?? ""}
                  fullWidth
                  helperText={
                    existing
                      ? `Score on a 0–${def.scale} scale. Blank leaves the saved score alone.`
                      : `Score on a 0–${def.scale} scale.`
                  }
                  label={def.label}
                  name={def.field}
                  slotProps={{
                    htmlInput: { min: 0, max: def.scale, step: 1 },
                  }}
                  type="number"
                />
                {/* Clearing a score is deliberate now. Blanking the field used
                    to delete it, which turned every stale form into a way to
                    lose curated data. */}
                {existing ? (
                  <FormControlLabel
                    control={
                      <Checkbox name={manualRatingRemoveField(def.source)} />
                    }
                    label={`Remove saved ${def.label} score`}
                    slotProps={{ typography: { variant: "body2" } }}
                  />
                ) : null}
              </Grid>
            );
          })}
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
          {/* Raw JSON is a maintenance hatch, not something to put in front of
              someone adding a film they just watched. Non-admins don't see the
              field — but it still round-trips as a hidden input, because
              submitting it empty would wipe curated metadata on approval. */}
          {isAdmin ? (
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
          ) : (
            <input
              name="metadataJson"
              type="hidden"
              value={item?.metadataJson ?? ""}
            />
          )}
        </Grid>

        {connections ? (
          <>
            <Divider />
            <Typography sx={{ fontWeight: 700 }} variant="h6">
              Connections
            </Typography>
            {connections}
          </>
        ) : null}

        <Button
          disabled={isPending}
          sx={{ alignSelf: "flex-start", minHeight: 44 }}
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
