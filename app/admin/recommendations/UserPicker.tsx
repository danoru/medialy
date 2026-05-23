"use client";

import { Autocomplete, Avatar, Box, Stack, TextField, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

export type UserPickerOption = {
  id: string;
  displayName: string;
  name: string | null;
  email: string | null;
  image: string | null;
  avatarColor: string | null;
  isAdmin: boolean;
};

export function UserPicker({
  users,
  selectedUserId,
}: {
  users: UserPickerOption[];
  selectedUserId: string | null;
}) {
  const router = useRouter();
  const selected = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  return (
    <Autocomplete
      fullWidth
      getOptionLabel={(option) =>
        `${option.displayName}${option.email ? ` (${option.email})` : ""}`
      }
      isOptionEqualToValue={(option, value) => option.id === value.id}
      onChange={(_, value) => {
        if (value) {
          router.push(`/admin/recommendations?userId=${value.id}`);
        } else {
          router.push(`/admin/recommendations`);
        }
      }}
      options={users}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Select a user"
          placeholder="Search by display name or email"
        />
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", width: "100%" }}>
            <Avatar
              src={option.image ?? undefined}
              sx={{ bgcolor: option.avatarColor ?? undefined, height: 28, width: 28 }}
            >
              {option.displayName.slice(0, 1).toUpperCase()}
            </Avatar>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2">
                {option.displayName}
                {option.isAdmin ? " · admin" : ""}
              </Typography>
              <Typography color="text.secondary" variant="caption">
                {option.email ?? "—"}
              </Typography>
            </Stack>
          </Stack>
        </Box>
      )}
      value={selected}
    />
  );
}
