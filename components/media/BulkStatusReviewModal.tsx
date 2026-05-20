"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { type MediaStatus, type MediaType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { updateMediaStatuses } from "@/app/media/actions";
import { availableStatuses, statusLabel } from "@/lib/status-labels";

export type BulkStatusReviewItem = {
  id: string;
  title: string;
  mediaType: MediaType;
};

export function BulkStatusReviewModal({
  items,
  returnTo,
}: {
  items: BulkStatusReviewItem[];
  returnTo: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [bulk, setBulk] = useState<MediaStatus | "">("");
  const [perItem, setPerItem] = useState<Record<string, MediaStatus | "">>(
    () => Object.fromEntries(items.map((item) => [item.id, ""])),
  );

  const allTypes = useMemo(
    () => Array.from(new Set(items.map((item) => item.mediaType))),
    [items],
  );
  const sharedStatuses = useMemo(() => {
    if (allTypes.length === 0) return [] as MediaStatus[];
    const sets = allTypes.map(
      (type) =>
        new Set(
          availableStatuses(type).filter((value) => value !== "UNTRACKED"),
        ),
    );
    return Array.from(sets[0]).filter((status) =>
      sets.every((set) => set.has(status)),
    );
  }, [allTypes]);

  const dismiss = () => {
    setOpen(false);
    // Strip the reviewStatus query param without a full reload.
    router.replace(returnTo);
  };

  const applyBulk = (value: MediaStatus | "") => {
    setBulk(value);
    if (!value) return;
    setPerItem((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (availableStatuses(item.mediaType).includes(value)) {
          next[item.id] = value;
        }
      }
      return next;
    });
  };

  if (items.length === 0) return null;

  return (
    <Dialog fullWidth maxWidth="sm" onClose={dismiss} open={open}>
      <form action={updateMediaStatuses}>
        <input name="returnTo" type="hidden" value={returnTo} />
        <DialogTitle>Set a status</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            You just rated {items.length} item{items.length === 1 ? "" : "s"}{" "}
            still marked Untracked. Pick a status so they stop showing up as
            recommendations.
          </DialogContentText>

          {sharedStatuses.length > 0 ? (
            <TextField
              fullWidth
              label="Set all to…"
              onChange={(event) =>
                applyBulk(event.target.value as MediaStatus | "")
              }
              select
              size="small"
              sx={{ mb: 2 }}
              value={bulk}
            >
              <MenuItem value="">—</MenuItem>
              {sharedStatuses.map((status) => (
                <MenuItem key={status} value={status}>
                  {statusLabel(status)}
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          <Stack spacing={1.5}>
            {items.map((item) => {
              const options = availableStatuses(item.mediaType).filter(
                (value) => value !== "UNTRACKED",
              );
              return (
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  key={item.id}
                  spacing={1}
                  sx={{ alignItems: { sm: "center" } }}
                >
                  <input name="mediaId" type="hidden" value={item.id} />
                  <Typography sx={{ flex: 1, fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                  <TextField
                    name={`status:${item.id}`}
                    onChange={(event) =>
                      setPerItem((prev) => ({
                        ...prev,
                        [item.id]: event.target.value as MediaStatus | "",
                      }))
                    }
                    select
                    size="small"
                    sx={{ minWidth: 180 }}
                    value={perItem[item.id] ?? ""}
                  >
                    <MenuItem value="">Keep untracked</MenuItem>
                    {options.map((value) => (
                      <MenuItem key={value} value={value}>
                        {statusLabel(value, item.mediaType)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={dismiss} type="button">
            Skip
          </Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
