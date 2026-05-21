import {
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import EditNoteIcon from "@mui/icons-material/EditNote";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import { ReleaseCandidateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/user";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

/**
 * Admin landing — a hub for moderation surfaces. Future admin tooling
 * (user management, data health overrides, scoring weights) hangs off
 * `/admin/<thing>` below.
 */
export default async function AdminPage() {
  await requireAdmin("/admin");
  const [pendingTagCount, pendingSuggestionCount, pendingCandidateCount] =
    await Promise.all([
      prisma.tag.count({ where: { status: "PENDING" } }),
      prisma.mediaEditSuggestion.count({ where: { status: "PENDING" } }),
      prisma.releaseCandidate.count({
        where: { status: ReleaseCandidateStatus.PENDING },
      }),
    ]);

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
      <AdminCard
        description="Review user-proposed edits and additions before they apply to shared media data."
        href="/admin/edits"
        icon={<EditNoteIcon color="primary" />}
        pendingCount={pendingSuggestionCount}
        title="Suggested Edits"
      />
      <AdminCard
        description="Items fetched from TMDB / TVMAZE / IGDB / RAWG awaiting approval before they reach the catalog."
        href="/admin/candidates"
        icon={<MovieFilterIcon color="primary" />}
        pendingCount={pendingCandidateCount}
        title="Discovery Candidates"
      />
      <AdminCard
        description="Approve or reject freeform tags users submit from media forms."
        href="/admin/tags"
        icon={<LocalOfferIcon color="primary" />}
        pendingCount={pendingTagCount}
        title="Tag Moderation"
      />
    </Stack>
  );
}

function AdminCard({
  description,
  href,
  icon,
  pendingCount,
  title,
}: {
  description: string;
  href: string;
  icon: React.ReactNode;
  pendingCount: number;
  title: string;
}) {
  return (
    <Card variant="outlined">
      <Link
        href={href}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <CardActionArea>
          <CardContent>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
              {icon}
              <Stack sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
                <Typography color="text.secondary" variant="body2">
                  {description}
                </Typography>
              </Stack>
              <Typography
                color={pendingCount > 0 ? "warning.main" : "text.secondary"}
                sx={{ fontWeight: 600 }}
                variant="body2"
              >
                {pendingCount} pending
              </Typography>
            </Stack>
          </CardContent>
        </CardActionArea>
      </Link>
    </Card>
  );
}
