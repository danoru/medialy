"use client";

import {
  Alert,
  Button,
  FormControlLabel,
  Snackbar,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { useActionState, useState } from "react";
import type { CollectionFormActionState } from "@/app/discover/collections/actions";

const initialActionState: CollectionFormActionState = {
  message: "",
  severity: "error",
  submittedAt: 0,
};

export type CollectionFormValues = {
  name: string;
  subtitle: string | null;
  description: string | null;
  coverUrl: string | null;
  isPublished: boolean;
};

export function CollectionForm({
  action,
  collection,
  submitLabel,
}: {
  action: (
    state: CollectionFormActionState,
    formData: FormData,
  ) => CollectionFormActionState | Promise<CollectionFormActionState>;
  collection?: CollectionFormValues;
  submitLabel: string;
}) {
  const [actionState, formAction, isPending] = useActionState(
    action,
    initialActionState,
  );
  const [dismissedSubmission, setDismissedSubmission] = useState(0);

  const snackbarOpen =
    actionState.submittedAt > 0 &&
    actionState.submittedAt !== dismissedSubmission;

  return (
    <form action={formAction}>
      <Stack spacing={2.5}>
        <TextField
          defaultValue={collection?.name ?? ""}
          fullWidth
          label="Title"
          name="name"
          required
        />
        <TextField
          defaultValue={collection?.subtitle ?? ""}
          fullWidth
          helperText="A short dek shown under the title."
          label="Subtitle"
          name="subtitle"
        />
        <TextField
          defaultValue={collection?.description ?? ""}
          fullWidth
          helperText="Intro / lede. Line breaks are preserved."
          label="Intro"
          minRows={3}
          multiline
          name="description"
        />
        <TextField
          defaultValue={collection?.coverUrl ?? ""}
          fullWidth
          helperText="Optional cover image URL."
          label="Cover image URL"
          name="coverUrl"
        />
        <FormControlLabel
          control={
            <Switch
              defaultChecked={collection?.isPublished ?? false}
              name="isPublished"
            />
          }
          label="Published (visible to signed-in users)"
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
