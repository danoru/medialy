import { Card, CardContent, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { MediaForm } from "@/components/media/MediaForm";
import { MediaSearchAdd } from "@/components/media/MediaSearchAdd";
import { createMediaItem } from "@/app/media/actions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/user";

export const metadata = { title: "Add Media" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Search-first. The manual metadata form is the fallback for titles the
 * providers don't know about (`?manual=1`), not the front door.
 */
export default async function NewMediaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const manual = params.manual === "1";

  const [tags, user] = await Promise.all([
    manual
      ? prisma.tag.findMany({
          where: { status: { in: ["APPROVED", "PENDING"] } },
          orderBy: [{ status: "asc" }, { name: "asc" }],
          select: { mediaTypesJson: true, name: true, status: true },
        })
      : Promise.resolve([]),
    getCurrentUser(),
  ]);

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          {manual ? (
            <Stack spacing={2.5}>
              <Stack spacing={0.5}>
                <Typography sx={{ fontWeight: 700 }} variant="h6">
                  Enter the details yourself
                </Typography>
                {user?.isAdmin ? null : (
                  <Typography color="text.secondary" variant="body2">
                    An admin will review this before it joins the shared
                    catalog.
                  </Typography>
                )}
                <Typography variant="body2">
                  <Link href="/media/new">Search for it instead</Link>
                </Typography>
              </Stack>
              <MediaForm
                action={createMediaItem}
                isAdmin={user?.isAdmin ?? false}
                submitLabel="Create media"
                tagOptions={tags}
              />
            </Stack>
          ) : (
            <Stack spacing={2.5}>
              <Stack spacing={0.5}>
                <Typography sx={{ fontWeight: 700 }} variant="h6">
                  Add media
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  Search for a film, series, or game by title. If it&apos;s
                  already here, we&apos;ll take you straight to it.
                </Typography>
              </Stack>
              <MediaSearchAdd manualHref="/media/new?manual=1" />
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
