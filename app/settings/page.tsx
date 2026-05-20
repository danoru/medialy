import {
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { updateDisplayName } from "@/app/settings/actions";
import { AppearanceCard } from "@/app/settings/AppearanceCard";
import { signOutAction } from "@/app/auth-actions";
import { ActionToastButton } from "@/components/shared/Toasts";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser("/settings");

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="eyebrow">Settings</Typography>
        <Typography component="h1" sx={{ fontWeight: 650 }} variant="h4">
          Account
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Update how Medialy refers to you and manage your session.
        </Typography>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography sx={{ fontWeight: 700 }} variant="h6">
              Profile
            </Typography>
            <form action={updateDisplayName}>
              <Stack spacing={2}>
                <TextField
                  defaultValue={user.displayName}
                  helperText="Shown in the top bar, profile header, and anywhere Medialy needs to address you."
                  label="Display name"
                  name="displayName"
                  required
                  slotProps={{ htmlInput: { maxLength: 64 } }}
                />
                <Stack direction="row">
                  <ActionToastButton
                    successMessage="Display name updated."
                    variant="contained"
                  >
                    Save
                  </ActionToastButton>
                </Stack>
              </Stack>
            </form>
          </Stack>
        </CardContent>
      </Card>

      <AppearanceCard />

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography sx={{ fontWeight: 700 }} variant="h6">
              Linked account
            </Typography>
            <Stack spacing={0.5}>
              <Typography color="text.secondary" variant="caption">
                Google
              </Typography>
              <Typography>{user.email ?? "Not linked"}</Typography>
              {user.name ? (
                <Typography color="text.secondary" variant="body2">
                  {user.name}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography sx={{ fontWeight: 700 }} variant="h6">
              Session
            </Typography>
            <Typography color="text.secondary" variant="body2">
              End your session on this device. You can sign back in at any
              time from the top bar.
            </Typography>
            <form action={signOutAction}>
              <Stack direction="row">
                <ActionToastButton
                  color="error"
                  successMessage="Signed out."
                  variant="outlined"
                >
                  Sign Out
                </ActionToastButton>
              </Stack>
            </form>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
