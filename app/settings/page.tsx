import {
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { approveTag, rejectTag } from "@/app/settings/actions";
import { StatePanel } from "@/components/shared/StatePanel";
import { ActionToastButton } from "@/components/shared/Toasts";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const pendingTags = await prisma.tag.findMany({
    where: { status: "PENDING" },
    orderBy: { name: "asc" },
  });

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography sx={{ fontWeight: 700 }} variant="h5">
              Tag Moderation
            </Typography>
            {pendingTags.length === 0 ? (
              <StatePanel
                description="New freeform tags created from media forms will appear here for approval."
                minHeight={160}
                title="No pending tag suggestions"
              />
            ) : (
              <Stack spacing={1}>
                {pendingTags.map((tag) => (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    key={tag.id}
                    spacing={1}
                    sx={{
                      alignItems: { sm: "center" },
                      justifyContent: "space-between",
                    }}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center" }}
                    >
                      <Typography sx={{ fontWeight: 650 }}>
                        {tag.name}
                      </Typography>
                      <Chip label="Pending" size="small" />
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <form action={approveTag.bind(null, tag.id)}>
                        <ActionToastButton
                          size="small"
                          successMessage="Tag approved."
                          variant="contained"
                        >
                          Approve
                        </ActionToastButton>
                      </form>
                      <form action={rejectTag.bind(null, tag.id)}>
                        <ActionToastButton
                          color="error"
                          size="small"
                          successMessage="Tag rejected."
                          variant="outlined"
                        >
                          Reject
                        </ActionToastButton>
                      </form>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
