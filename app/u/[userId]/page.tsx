import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Box,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/user";
import { getPublicUserMedia, getPublicUserStats } from "@/lib/social/visibility";
import { getUserOverlap } from "@/lib/social/overlap";
import { isFollowing } from "@/lib/social/follows";
import { UserAvatar } from "@/components/social/UserAvatar";
import { FollowButton } from "@/components/social/FollowButton";
import {
  CinematicCard,
  CompactStatCard,
  DashboardSection,
} from "@/components/cinematic/CinematicPrimitives";
import { ACCENTS } from "@/lib/media-ui-helpers";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true },
  });
  return { title: user ? `${user.displayName} · Medialy` : "User not found" };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: targetId } = await params;
  const viewerId = await requireUserId(`/u/${targetId}`);
  // Looking at your own profile? Send the user to the canonical /profile page.
  if (targetId === viewerId) redirect("/profile");

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, displayName: true, image: true, avatarColor: true, createdAt: true },
  });
  if (!target) notFound();

  const [stats, overlap, viewerFollowsTarget, recentPublic] = await Promise.all([
    getPublicUserStats(targetId),
    getUserOverlap(viewerId, targetId),
    isFollowing(viewerId, targetId),
    getPublicUserMedia(targetId, { limit: 12 }),
  ]);

  // Hydrate the media metadata for the recently-public rows in one query.
  const recentMediaIds = recentPublic.map((row) => row.mediaId);
  const recentMedia = recentMediaIds.length
    ? await prisma.mediaItem.findMany({
        where: { id: { in: recentMediaIds } },
        select: { id: true, title: true, posterUrl: true, mediaType: true },
      })
    : [];
  const mediaById = new Map(recentMedia.map((row) => [row.id, row]));

  return (
    <Stack spacing={3}>
      <CinematicCard>
        <Box sx={{ p: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} sx={{ alignItems: { md: "center" } }}>
            <UserAvatar
              avatarColor={target.avatarColor}
              displayName={target.displayName}
              image={target.image}
              size={72}
            />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700 }} variant="h4">
                {target.displayName}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                On Medialy since{" "}
                {target.createdAt.toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </Typography>
              {overlap.overlapCount > 0 ? (
                <Chip
                  color={
                    overlap.compatibilityScore >= 70
                      ? "success"
                      : overlap.compatibilityScore >= 40
                        ? "default"
                        : "warning"
                  }
                  label={`${overlap.compatibilityScore}% match with you`}
                  size="small"
                  sx={{ mt: 1 }}
                />
              ) : null}
            </Box>
            <FollowButton
              isFollowing={viewerFollowsTarget}
              size="medium"
              targetUserId={target.id}
            />
          </Stack>
        </Box>
      </CinematicCard>

      <Stack direction="row" spacing={1.5}>
        <CompactStatCard
          accent={ACCENTS.mint}
          label="Completed"
          value={stats.completedCount.toString()}
        />
        <CompactStatCard
          accent={ACCENTS.pink}
          label="Rated"
          value={stats.ratedCount.toString()}
        />
        <CompactStatCard
          accent={ACCENTS.yellow}
          label="Shared with you"
          value={overlap.sharedCompletedCount.toString()}
        />
        <CompactStatCard
          accent="#F26D8A"
          label="Top shared genres"
          value={
            overlap.topSharedGenres.length
              ? overlap.topSharedGenres.slice(0, 2).join(", ")
              : "—"
          }
        />
      </Stack>

      <DashboardSection kicker="Recently active" title="Public ratings & completions">
        {recentPublic.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            Nothing public to show yet.
          </Typography>
        ) : (
          <Grid container spacing={1.5}>
            {recentPublic.map((row) => {
              const media = mediaById.get(row.mediaId);
              if (!media) return null;
              return (
                <Grid key={row.mediaId} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                  <Link
                    href={`/media/${row.mediaId}`}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                  <CinematicCard>
                    <Box sx={{ p: 1.25 }}>
                      {media.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={media.title}
                          src={media.posterUrl}
                          style={{
                            aspectRatio: "2/3",
                            borderRadius: 6,
                            objectFit: "cover",
                            width: "100%",
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            aspectRatio: "2/3",
                            bgcolor: "action.hover",
                            borderRadius: 1,
                          }}
                        />
                      )}
                      <Typography
                        sx={{ fontSize: "0.875rem", fontWeight: 600, mt: 1 }}
                        title={media.title}
                      >
                        {media.title}
                      </Typography>
                      <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                        {row.personalRating != null
                          ? `Rated ${row.personalRating}/10`
                          : "Completed"}
                      </Typography>
                    </Box>
                  </CinematicCard>
                  </Link>
                </Grid>
              );
            })}
          </Grid>
        )}
      </DashboardSection>
    </Stack>
  );
}
