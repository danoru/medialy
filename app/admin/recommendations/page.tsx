import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/user";
import { getRecommendations } from "@/lib/recommendations";
import { formatMediaType } from "@/lib/format";
import { VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import type { Recommendation } from "@/lib/types";
import { UserPicker, type UserPickerOption } from "./UserPicker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recommendation Debugger" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminRecommendationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin("/admin/recommendations");
  const params = await searchParams;
  const requestedRaw = params.userId;
  const requestedUserId =
    typeof requestedRaw === "string" ? requestedRaw : undefined;

  const userRows = await prisma.user.findMany({
    orderBy: [{ displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      name: true,
      email: true,
      image: true,
      avatarColor: true,
      isAdmin: true,
    },
  });
  const users: UserPickerOption[] = userRows;
  const selectedUser = requestedUserId
    ? users.find((u) => u.id === requestedUserId) ?? null
    : null;

  const recommendations = selectedUser
    ? await getRecommendations(undefined, {}, selectedUser.id)
    : [];

  return (
    <Stack spacing={4}>
      <Stack spacing={0.5}>
        <Typography variant="eyebrow">Admin</Typography>
        <Typography component="h1" sx={{ fontWeight: 650 }} variant="h4">
          Recommendation debugger
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Inspect any user&apos;s Tonight&apos;s pick and Up next, with the match
          % and the signals driving each recommendation.
        </Typography>
      </Stack>

      <UserPicker
        selectedUserId={selectedUser?.id ?? null}
        users={users}
      />

      {!selectedUser ? (
        <Card variant="outlined">
          <CardContent>
            <Typography color="text.secondary" variant="body2">
              Select a user above to see their recommendations.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <SelectedUserResults
          recommendations={recommendations}
          user={selectedUser}
        />
      )}
    </Stack>
  );
}

function SelectedUserResults({
  recommendations,
  user,
}: {
  recommendations: Recommendation[];
  user: UserPickerOption;
}) {
  const byType = VISIBLE_MEDIA_TYPES.map((mediaType) => ({
    mediaType,
    items: recommendations
      .filter((r) => r.media.mediaType === mediaType)
      .slice(0, 5),
  }));

  return (
    <Stack spacing={4}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Avatar
          src={user.image ?? undefined}
          sx={{ bgcolor: user.avatarColor ?? undefined, height: 40, width: 40 }}
        >
          {user.displayName.slice(0, 1).toUpperCase()}
        </Avatar>
        <Stack>
          <Typography sx={{ fontWeight: 600 }} variant="body1">
            {user.displayName}
            {user.isAdmin ? (
              <Chip
                color="primary"
                label="admin"
                size="small"
                sx={{ height: 18, ml: 1 }}
              />
            ) : null}
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {user.email ?? "—"} · {recommendations.length} eligible
            recommendations
          </Typography>
        </Stack>
      </Stack>

      {byType.map((entry) => (
        <Stack key={entry.mediaType} spacing={2}>
          <Typography variant="eyebrow">
            {formatMediaType(entry.mediaType)}
          </Typography>
          {entry.items.length === 0 ? (
            <Card variant="outlined">
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  No eligible recommendations for this media type.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            entry.items.map((rec, index) => (
              <RecommendationCard
                key={rec.media.id}
                position={
                  index === 0 ? "Tonight's pick" : `Up next · #${index + 1}`
                }
                recommendation={rec}
              />
            ))
          )}
        </Stack>
      ))}
    </Stack>
  );
}

function RecommendationCard({
  position,
  recommendation,
}: {
  position: string;
  recommendation: Recommendation;
}) {
  const { media, score, confidence, explanations } = recommendation;
  const sortedExplanations = [...(explanations ?? [])].sort(
    (a, b) => b.contribution - a.contribution,
  );

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          {media.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              src={media.posterUrl}
              style={{
                width: 80,
                height: 120,
                objectFit: "cover",
                borderRadius: 6,
                flexShrink: 0,
              }}
            />
          ) : (
            <Box
              sx={{
                width: 80,
                height: 120,
                borderRadius: 1,
                bgcolor: "action.hover",
                flexShrink: 0,
              }}
            />
          )}

          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Typography variant="eyebrow">{position}</Typography>
              <Chip label={`${score}% match`} size="small" />
              <Chip
                label={`confidence ${Math.round(confidence * 100)}%`}
                size="small"
                variant="outlined"
              />
              {media.computedConsensusScore != null ? (
                <Chip
                  label={`critics ${media.computedConsensusScore.toFixed(1)}/10`}
                  size="small"
                  variant="outlined"
                />
              ) : null}
            </Stack>

            <Typography sx={{ fontWeight: 600 }} variant="h6">
              {media.title}
            </Typography>
            {media.genres.length > 0 ? (
              <Typography color="text.secondary" variant="caption">
                {media.genres.join(" · ")}
              </Typography>
            ) : null}

            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Signal</TableCell>
                  <TableCell align="right">Raw</TableCell>
                  <TableCell align="right">Weight</TableCell>
                  <TableCell align="right">Contribution</TableCell>
                  <TableCell>Detail</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedExplanations.map((entry) => (
                  <TableRow key={entry.signal}>
                    <TableCell>{entry.label}</TableCell>
                    <TableCell align="right">
                      <Stack spacing={0.5} sx={{ alignItems: "flex-end" }}>
                        <Typography variant="body2">
                          {Math.round(entry.rawValue)}
                        </Typography>
                        <LinearProgress
                          sx={{ width: 60, height: 4, borderRadius: 1 }}
                          value={Math.min(100, Math.max(0, entry.rawValue))}
                          variant="determinate"
                        />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {(entry.weight * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        sx={{
                          fontWeight: entry.contribution >= 1 ? 600 : 400,
                        }}
                        variant="body2"
                      >
                        +{entry.contribution}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography color="text.secondary" variant="caption">
                        {entry.detail ?? "—"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
