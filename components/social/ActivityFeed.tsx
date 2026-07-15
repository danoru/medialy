import Link from "next/link";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { DashboardSection } from "@/components/cinematic/CinematicPrimitives";
import { UserAvatar } from "@/components/social/UserAvatar";
import type { ActivityFeedItem } from "@/lib/social/feed";

function relative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function ActivityFeed({ items }: { items: ActivityFeedItem[] }) {
  return (
    <DashboardSection
      kicker="Activity"
      title="From people you follow"
    >
      {items.length === 0 ? (
        <Typography color="text.secondary" variant="body2">
          Follow other users to see what they&apos;re rating and finishing.
        </Typography>
      ) : (
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />} spacing={1.25}>
          {items.map((item) => (
            <Stack
              direction="row"
              key={item.id}
              spacing={1.25}
              sx={{ alignItems: "center" }}
            >
              <UserAvatar
                avatarColor={item.userAvatarColor}
                displayName={item.userDisplayName}
                image={item.userImage}
                size={36}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.875rem" }}>
                  <Link
                    href={`/u/${item.userId}`}
                    style={{ color: "inherit", fontWeight: 600, textDecoration: "none" }}
                  >
                    {item.userDisplayName}
                  </Link>{" "}
                  {item.kind === "completed" ? "completed" : "rated"}{" "}
                  <Link
                    href={`/media/${item.mediaId}`}
                    style={{ color: "inherit", fontWeight: 600, textDecoration: "none" }}
                  >
                    {item.mediaTitle}
                  </Link>
                  {item.kind === "rated" && item.rating != null ? (
                    <> · <strong>{item.rating}/10</strong></>
                  ) : null}
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                  {relative(item.occurredAt)}
                </Typography>
              </Box>
              <Chip
                label={item.kind === "completed" ? "Completed" : "Rated"}
                size="small"
                variant="outlined"
              />
            </Stack>
          ))}
        </Stack>
      )}
    </DashboardSection>
  );
}
