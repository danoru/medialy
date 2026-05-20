import {
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/user";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

/**
 * Admin landing — a hub for moderation surfaces. Today this is just tag
 * moderation; future admin tooling (user management, data health overrides,
 * scoring weights) hangs off `/admin/<thing>` below.
 */
export default async function AdminPage() {
  await requireAdmin("/admin");
  const pendingTagCount = await prisma.tag.count({
    where: { status: "PENDING" },
  });

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="eyebrow">Admin</Typography>
        <Typography component="h1" sx={{ fontWeight: 650 }} variant="h4">
          Moderation
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Tools that affect every user — visible only to admins.
        </Typography>
      </Stack>
      <Card variant="outlined">
        <CardActionArea component={Link} href="/admin/tags">
          <CardContent>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              <LocalOfferIcon color="primary" />
              <Stack sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>Tag Moderation</Typography>
                <Typography color="text.secondary" variant="body2">
                  Approve or reject freeform tags users submit from media
                  forms.
                </Typography>
              </Stack>
              <Typography
                color={pendingTagCount > 0 ? "warning.main" : "text.secondary"}
                sx={{ fontWeight: 600 }}
                variant="body2"
              >
                {pendingTagCount} pending
              </Typography>
            </Stack>
          </CardContent>
        </CardActionArea>
      </Card>
    </Stack>
  );
}
