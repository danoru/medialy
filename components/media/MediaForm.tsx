import {
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { MediaStatus } from "@prisma/client";
import type { MediaItemDTO } from "@/lib/types";
import { formatMediaType, formatStatus } from "@/lib/format";
import { VISIBLE_MEDIA_TYPES } from "@/lib/media-types";

export function MediaForm({
  action,
  item,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  item?: MediaItemDTO;
  submitLabel: string;
}) {
  return (
    <form action={action}>
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
              defaultValue={item?.mediaType ?? "MOVIE"}
              fullWidth
              label="Type"
              name="mediaType"
              select
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
            <TextField
              defaultValue={dateValue(item?.upcomingDate)}
              fullWidth
              label="Upcoming date"
              name="upcomingDate"
              slotProps={{ inputLabel: { shrink: true } }}
              type="date"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              defaultValue={item?.genres.join("; ") ?? ""}
              fullWidth
              label="Genres"
              name="genres"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              defaultValue={item?.tags.join("; ") ?? ""}
              fullWidth
              label="Tags"
              name="tags"
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
          sx={{ alignSelf: "flex-start" }}
          type="submit"
          variant="contained"
        >
          {submitLabel}
        </Button>
      </Stack>
    </form>
  );
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}
