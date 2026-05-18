"use client";

import StarRoundedIcon from "@mui/icons-material/StarRounded";
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { MediaStatus } from "@prisma/client";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { formatStatus } from "@/lib/format";

type FormAction = (formData: FormData) => void | Promise<void>;
type ToggleAction = () => void | Promise<void>;

export function MediaDetailActions({
  favoriteAction,
  isFavorite,
  status,
  statusAction,
}: {
  favoriteAction: ToggleAction;
  isFavorite: boolean;
  status: MediaStatus;
  statusAction: FormAction;
}) {
  const statusFormRef = useRef<HTMLFormElement>(null);
  const [selectedStatus, setSelectedStatus] = useState<MediaStatus>(status);

  return (
    <Stack spacing={1.25}>
      <form action={favoriteAction}>
        <ActionButton
          active={isFavorite}
          fullWidth
          icon={<StarRoundedIcon />}
          label={isFavorite ? "Favorite" : "Favorite"}
        />
      </form>

      <Box
        action={statusAction}
        component="form"
        ref={statusFormRef}
        sx={actionPanelSx}
      >
        <Stack spacing={1}>
          <Typography sx={railLabelSx}>Status</Typography>
          <TextField
            fullWidth
            name="status"
            onChange={(event) => {
              setSelectedStatus(event.target.value as MediaStatus);
              window.requestAnimationFrame(() => {
                statusFormRef.current?.requestSubmit();
              });
            }}
            select
            size="small"
            sx={selectSx}
            value={selectedStatus}
          >
            {Object.values(MediaStatus).map((value) => (
              <MenuItem key={value} value={value}>
                {formatStatus(value)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Box>
    </Stack>
  );
}

function ActionButton({
  active = false,
  icon,
  label,
  ...props
}: React.ComponentProps<typeof Button> & {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      {...props}
      disabled={props.disabled || pending}
      startIcon={icon}
      sx={{
        ...actionButtonSx,
        ...(active ? activeActionButtonSx : {}),
        ...props.sx,
      }}
      type={props.type ?? "submit"}
      variant="outlined"
    >
      {pending ? "Saving..." : label}
    </Button>
  );
}

const actionPanelSx = {
  backgroundColor: "rgba(216,230,255,0.055)",
  border: "1px solid rgba(216,230,255,0.1)",
  borderRadius: "8px",
  p: 1.25,
};

const actionButtonSx = {
  backgroundColor: "rgba(216,230,255,0.055)",
  borderColor: "rgba(216,230,255,0.1)",
  borderRadius: "8px",
  color: "text.primary",
  justifyContent: "flex-start",
  minHeight: 44,
  textTransform: "none",
  "&:hover": {
    backgroundColor: "rgba(90,231,255,0.1)",
    borderColor: "rgba(90,231,255,0.25)",
  },
};

const activeActionButtonSx = {
  backgroundColor: "rgba(245,158,11,0.12)",
  borderColor: "rgba(245,158,11,0.35)",
  color: "#FDE68A",
};

const railLabelSx = {
  color: "text.secondary",
  fontSize: 12,
  fontWeight: 650,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const selectSx = {
  "& .MuiOutlinedInput-root": {
    backgroundColor: "rgba(2,6,23,0.42)",
    borderRadius: "8px",
  },
};
