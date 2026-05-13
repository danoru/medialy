"use client";

import ArchiveIcon from "@mui/icons-material/Archive";
import DeleteIcon from "@mui/icons-material/Delete";
import UnarchiveIcon from "@mui/icons-material/Unarchive";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useState } from "react";

type ConfirmMediaActionProps = {
  action: () => void | Promise<void>;
  actionLabel: string;
  confirmLabel?: string;
  description: string;
  tone?: "default" | "danger";
  variant: "archive" | "delete" | "unarchive";
};

export function ConfirmMediaAction({
  action,
  actionLabel,
  confirmLabel = actionLabel,
  description,
  tone = "default",
  variant,
}: ConfirmMediaActionProps) {
  const [open, setOpen] = useState(false);
  const Icon =
    variant === "delete"
      ? DeleteIcon
      : variant === "unarchive"
        ? UnarchiveIcon
        : ArchiveIcon;

  return (
    <>
      <Button
        color={tone === "danger" ? "error" : "primary"}
        onClick={() => setOpen(true)}
        startIcon={<Icon />}
        variant="outlined"
      >
        {actionLabel}
      </Button>
      <Dialog onClose={() => setOpen(false)} open={open}>
        <DialogTitle>{actionLabel}</DialogTitle>
        <DialogContent>
          <DialogContentText>{description}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <form action={action}>
            <Button
              color={tone === "danger" ? "error" : "primary"}
              type="submit"
              variant="contained"
            >
              {confirmLabel}
            </Button>
          </form>
        </DialogActions>
      </Dialog>
    </>
  );
}
