import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Link from "next/link";
import EditNoteIcon from "@mui/icons-material/EditNote";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import LibraryAddIcon from "@mui/icons-material/LibraryAdd";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import EditIcon from "@mui/icons-material/Edit";
import InsightsIcon from "@mui/icons-material/Insights";
import { ReleaseCandidateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/user";
import { getAdminSignals } from "@/lib/db/admin-signals";
import { Sparkline } from "@/components/admin/Sparkline";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin("/admin");
  const [pendingTagCount, pendingSuggestionCount, pendingCandidateCount, signals] =
    await Promise.all([
      prisma.tag.count({ where: { status: "PENDING" } }),
      prisma.mediaEditSuggestion.count({ where: { status: "PENDING" } }),
      prisma.releaseCandidate.count({
        where: { status: ReleaseCandidateStatus.PENDING },
      }),
      getAdminSignals(),
    ]);

  return (
    <Stack spacing={4}>
      <Stack spacing={0.5}>
        <Typography variant="eyebrow">Admin</Typography>
        <Typography component="h1" sx={{ fontWeight: 650 }} variant="h4">
          Overview
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Tools and signals that affect every user — visible only to admins.
        </Typography>
      </Stack>

      <Stack spacing={2}>
        <Typography variant="eyebrow">Usage</Typography>
        <Stack
          direction="row"
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              sm: "repeat(3, minmax(0, 1fr))",
              md: "repeat(4, minmax(0, 1fr))",
            },
          }}
        >
          <StatCard
            caption={`${signals.newUsers30d} in last 30 days`}
            label="Total users"
            value={signals.totalUsers}
          />
          <StatCard
            caption={`${signals.newUsers30d} in last 30 days`}
            label="New users · 7d"
            value={signals.newUsers7d}
          />
          <StatCard
            caption={`${signals.activeUsers30d} in last 30 days`}
            label="Active users · 7d"
            value={signals.activeUsers7d}
          />
          <StatCard
            caption={`${signals.comparisons30d} in last 30 days`}
            label="Comparisons · 7d"
            value={signals.comparisons7d}
          />
          <StatCard
            caption={`${signals.itemsTracked30d} in last 30 days`}
            label="Items tracked · 7d"
            value={signals.itemsTracked7d}
          />
          <StatCard
            caption="moderation queue input"
            label="Suggestions · 7d"
            value={signals.suggestions7d}
          />
          <StatCard
            caption="moderation queue input"
            label="Tags submitted · 7d"
            value={signals.tagsSubmitted7d}
          />
        </Stack>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ "& > *": { flex: 1 } }}
        >
          <TrendCard
            color="primary.main"
            data={signals.signupsByDay}
            subtitle={`${signals.newUsers30d} new users in the last 30 days`}
            title="Signups · 30d"
          />
          <TrendCard
            color="success.main"
            data={signals.userMediaByDay}
            subtitle={`${signals.itemsTracked30d} items tracked in the last 30 days`}
            title="Items tracked · 30d"
          />
          <TrendCard
            color="warning.main"
            data={signals.comparisonsByDay}
            subtitle={`${signals.comparisons30d} comparisons in the last 30 days`}
            title="Comparisons · 30d"
          />
        </Stack>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ "& > *": { flex: 1, minWidth: 0 } }}
        >
          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>
                Recent signups
              </Typography>
              {signals.recentSignups.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  No users yet.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell align="right">Joined</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {signals.recentSignups.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center" }}
                          >
                            <Avatar
                              src={user.image ?? undefined}
                              sx={{
                                bgcolor: user.avatarColor ?? undefined,
                                height: 28,
                                width: 28,
                              }}
                            >
                              {(user.displayName ?? user.name ?? "?")
                                .slice(0, 1)
                                .toUpperCase()}
                            </Avatar>
                            <Typography variant="body2">
                              {user.displayName ?? user.name ?? "Unknown"}
                            </Typography>
                            {user.isAdmin ? (
                              <Chip
                                color="primary"
                                label="admin"
                                size="small"
                                sx={{ height: 18 }}
                              />
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography
                            color="text.secondary"
                            sx={{ wordBreak: "break-all" }}
                            variant="body2"
                          >
                            {user.email ?? "—"}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            color="text.secondary"
                            variant="caption"
                          >
                            {formatRelative(user.createdAt)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>
                Recent activity
              </Typography>
              {signals.feed.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  No activity yet.
                </Typography>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {signals.feed.map((event) => (
                    <Stack
                      direction="row"
                      key={event.id}
                      spacing={1.5}
                      sx={{ alignItems: "center", py: 1 }}
                    >
                      <Avatar
                        sx={{
                          bgcolor: event.avatarColor ?? undefined,
                          height: 24,
                          width: 24,
                        }}
                      >
                        {event.userName.slice(0, 1).toUpperCase()}
                      </Avatar>
                      <FeedIcon kind={event.kind} />
                      <Typography
                        sx={{ flex: 1, minWidth: 0 }}
                        variant="body2"
                      >
                        <Box component="span" sx={{ fontWeight: 600 }}>
                          {event.userName}
                        </Box>{" "}
                        <Box component="span" sx={{ color: "text.secondary" }}>
                          {event.label}
                        </Box>
                      </Typography>
                      <Typography color="text.secondary" variant="caption">
                        {formatRelative(event.createdAt)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Typography variant="eyebrow">Moderation</Typography>
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

      <Stack spacing={2}>
        <Typography variant="eyebrow">Diagnostics</Typography>
        <Card variant="outlined">
          <Link
            href="/admin/recommendations"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <CardActionArea>
              <CardContent>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ alignItems: "center" }}
                >
                  <InsightsIcon color="primary" />
                  <Stack sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>
                      Recommendation Debugger
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                      Pick a user and inspect their Tonight&apos;s pick / Up next
                      with the signals and match % behind each result.
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Link>
        </Card>
      </Stack>
    </Stack>
  );
}

function StatCard({
  caption,
  label,
  value,
}: {
  caption?: string;
  label: string;
  value: number;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography color="text.secondary" variant="caption">
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 650, lineHeight: 1.2 }} variant="h4">
          {value}
        </Typography>
        {caption ? (
          <Typography color="text.secondary" variant="caption">
            {caption}
          </Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TrendCard({
  color,
  data,
  subtitle,
  title,
}: {
  color: string;
  data: Array<{ date: string; count: number }>;
  subtitle: string;
  title: string;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography sx={{ fontWeight: 600 }} variant="body2">
          {title}
        </Typography>
        <Box sx={{ my: 1 }}>
          <Sparkline color={color} data={data} />
        </Box>
        <Typography color="text.secondary" variant="caption">
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
}

function FeedIcon({ kind }: { kind: "track" | "compare" | "suggest" }) {
  const sx = { color: "text.secondary", fontSize: 18 } as const;
  if (kind === "track") return <LibraryAddIcon sx={sx} />;
  if (kind === "compare") return <CompareArrowsIcon sx={sx} />;
  return <EditIcon sx={sx} />;
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.round(months / 12);
  return `${years}y ago`;
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
      <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
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
