import {
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { TagCategory } from "@prisma/client";
import { approveTag, rejectTag } from "@/app/admin/tags/actions";
import { StatePanel } from "@/components/shared/StatePanel";
import { ActionToastButton } from "@/components/shared/Toasts";
import { formatMediaType } from "@/lib/format";
import { VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import { prisma } from "@/lib/prisma";
import { mediaTypesFromJson } from "@/lib/taxonomy";
import { requireAdmin } from "@/lib/user";

export const metadata = { title: "Tag Moderation" };
export const dynamic = "force-dynamic";

export default async function AdminTagsPage() {
  await requireAdmin("/admin/tags");
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
                    key={tag.id}
                    spacing={1.2}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: "8px",
                      p: 1.5,
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
                    <form action={approveTag.bind(null, tag.id)}>
                      <Stack spacing={1.2}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                        >
                          <TextField
                            defaultValue={tag.name}
                            label="Canonical name"
                            name="name"
                            size="small"
                            sx={{ minWidth: { md: 220 } }}
                          />
                          <TextField
                            defaultValue={tag.category}
                            label="Category"
                            name="category"
                            select
                            size="small"
                            sx={{ minWidth: { md: 180 } }}
                          >
                            {Object.values(TagCategory).map((category) => (
                              <MenuItem key={category} value={category}>
                                {category}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            defaultValue={tag.countryCode ?? ""}
                            label="Country code"
                            name="countryCode"
                            size="small"
                            sx={{ maxWidth: { md: 140 } }}
                          />
                        </Stack>
                        <Stack
                          direction="row"
                          sx={{ flexWrap: "wrap", gap: 1 }}
                        >
                          {VISIBLE_MEDIA_TYPES.map((mediaType) => (
                            <FormControlLabel
                              control={
                                <Checkbox
                                  defaultChecked={mediaTypesFromJson(
                                    tag.mediaTypesJson,
                                  ).includes(mediaType)}
                                  name="mediaTypes"
                                  size="small"
                                  value={mediaType}
                                />
                              }
                              key={mediaType}
                              label={formatMediaType(mediaType)}
                            />
                          ))}
                          <FormControlLabel
                            control={
                              <Checkbox
                                defaultChecked={tag.discoverable}
                                name="discoverable"
                                size="small"
                              />
                            }
                            label="Discoverable"
                          />
                        </Stack>
                        <Stack direction="row" spacing={1}>
                          <ActionToastButton
                            size="small"
                            successMessage="Tag approved."
                            variant="contained"
                          >
                            Approve
                          </ActionToastButton>
                        </Stack>
                      </Stack>
                    </form>
                    <form action={rejectTag.bind(null, tag.id)}>
                      <Stack direction="row" spacing={1}>
                        <ActionToastButton
                          color="error"
                          size="small"
                          successMessage="Tag rejected."
                          variant="outlined"
                        >
                          Reject
                        </ActionToastButton>
                      </Stack>
                    </form>
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
