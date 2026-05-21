import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import type { MediaType } from "@prisma/client";
import {
  approveMediaEditSuggestion,
  rejectMediaEditSuggestion,
} from "@/app/admin/edits/actions";
import { prisma } from "@/lib/prisma";
import { formatMediaType } from "@/lib/format";
import { StatePanel } from "@/components/shared/StatePanel";
import { ActionToastButton } from "@/components/shared/Toasts";
import { requireAdmin } from "@/lib/user";
import {
  diffSnapshots,
  type EditSuggestionSnapshot,
  type SuggestionDiffField,
} from "@/lib/edit-suggestions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Suggested Edits" };

export default async function AdminEditsPage() {
  await requireAdmin("/admin/edits");

  const suggestions = await prisma.mediaEditSuggestion.findMany({
    where: { status: "PENDING" },
    include: {
      media: { select: { id: true, title: true, mediaType: true } },
      user: { select: { displayName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="eyebrow">Admin</Typography>
        <Typography component="h1" sx={{ fontWeight: 650 }} variant="h4">
          Suggested Edits
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Edits and additions proposed by signed-in users. Review the diff
          before applying.
        </Typography>
      </Stack>

      <Card variant="outlined">
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
            <Typography sx={{ flex: 1, fontWeight: 650 }} variant="h6">
              Pending
            </Typography>
            <Chip label={suggestions.length} size="small" />
          </Stack>
          {suggestions.length > 0 ? (
            <Stack spacing={1.25}>
              {suggestions.map((suggestion) => (
                <SuggestionRow key={suggestion.id} suggestion={suggestion} />
              ))}
            </Stack>
          ) : (
            <StatePanel
              description="Nothing waiting on you. New user-submitted edits will land here."
              minHeight={140}
              title="All caught up"
            />
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

type SuggestionRowData = {
  id: string;
  mediaId: string | null;
  beforeJson: string | null;
  afterJson: string;
  createdAt: Date;
  media: { id: string; title: string; mediaType: MediaType } | null;
  user: { displayName: string; email: string | null };
};

function SuggestionRow({ suggestion }: { suggestion: SuggestionRowData }) {
  const before = suggestion.beforeJson
    ? (JSON.parse(suggestion.beforeJson) as EditSuggestionSnapshot)
    : null;
  const after = JSON.parse(suggestion.afterJson) as EditSuggestionSnapshot;
  const diff = diffSnapshots(before, after);
  const title = suggestion.media?.title ?? after.title;
  const isAddition = !suggestion.mediaId;
  const author =
    suggestion.user.displayName || suggestion.user.email || "Unknown user";

  return (
    <Stack
      spacing={1}
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        pb: 1.25,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ alignItems: { sm: "center" }, flexWrap: "wrap" }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {suggestion.media ? (
            <Link
              href={`/media/${suggestion.media.id}`}
              style={{ textDecoration: "none" }}
            >
              <Typography sx={{ color: "primary.main", fontWeight: 650 }}>
                {title}
              </Typography>
            </Link>
          ) : (
            <Typography sx={{ fontWeight: 650 }}>{title}</Typography>
          )}
          <Stack direction="row" spacing={0.6} sx={{ flexWrap: "wrap", mt: 0.5 }}>
            <Chip
              color={isAddition ? "secondary" : "default"}
              label={isAddition ? "New item" : "Edit"}
              size="small"
            />
            <Chip
              label={formatMediaType(after.mediaType as MediaType)}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`Suggested by ${author}`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={suggestion.createdAt.toLocaleDateString()}
              size="small"
              variant="outlined"
            />
          </Stack>
        </Box>
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap" }}>
          <form action={approveMediaEditSuggestion.bind(null, suggestion.id)}>
            <ActionToastButton
              color="success"
              size="small"
              successMessage="Suggestion applied."
              variant="contained"
            >
              Approve
            </ActionToastButton>
          </form>
          <form action={rejectMediaEditSuggestion.bind(null, suggestion.id)}>
            <ActionToastButton
              color="warning"
              size="small"
              successMessage="Suggestion rejected."
              variant="outlined"
            >
              Reject
            </ActionToastButton>
          </form>
        </Stack>
      </Stack>
      <SuggestionDiff diff={diff} isAddition={isAddition} />
    </Stack>
  );
}

function SuggestionDiff({
  diff,
  isAddition,
}: {
  diff: SuggestionDiffField[];
  isAddition: boolean;
}) {
  if (diff.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2">
        No field changes detected.
      </Typography>
    );
  }
  return (
    <Stack spacing={0.5}>
      {diff.map((field) => (
        <Stack
          direction={{ xs: "column", md: "row" }}
          key={field.field}
          spacing={1}
          sx={{ alignItems: { md: "flex-start" } }}
        >
          <Typography
            sx={{ fontWeight: 600, minWidth: { md: 140 } }}
            variant="body2"
          >
            {field.label}
          </Typography>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            sx={{ flex: 1, minWidth: 0 }}
          >
            {!isAddition ? (
              <Box
                sx={{
                  borderLeft: "3px solid",
                  borderColor: "error.main",
                  borderRadius: 0.5,
                  flex: 1,
                  px: 1,
                  py: 0.5,
                }}
              >
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: 11, fontWeight: 600 }}
                >
                  Before
                </Typography>
                <Typography sx={{ whiteSpace: "pre-wrap" }} variant="body2">
                  {field.before || "—"}
                </Typography>
              </Box>
            ) : null}
            <Box
              sx={{
                borderLeft: "3px solid",
                borderColor: "success.main",
                borderRadius: 0.5,
                flex: 1,
                px: 1,
                py: 0.5,
              }}
            >
              <Typography
                color="text.secondary"
                sx={{ fontSize: 11, fontWeight: 600 }}
              >
                {isAddition ? "Proposed" : "After"}
              </Typography>
              <Typography sx={{ whiteSpace: "pre-wrap" }} variant="body2">
                {field.after || "—"}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}
