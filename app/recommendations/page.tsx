import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { getRecommendations } from "@/lib/recommendations";
import { formatMediaType } from "@/lib/format";
import { statusLabel } from "@/lib/status-labels";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import { StatePanel } from "@/components/shared/StatePanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recommendations" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const recommendations = await getRecommendations();
  const requestedType = stringParam(params.type);
  const selectedType = isVisibleMediaType(requestedType)
    ? requestedType
    : VISIBLE_MEDIA_TYPES[0];
  const visibleRecommendations = recommendations.filter(
    (recommendation) => recommendation.media.mediaType === selectedType,
  );
  const countsByType = new Map(
    VISIBLE_MEDIA_TYPES.map((type) => [
      type,
      recommendations.filter(
        (recommendation) => recommendation.media.mediaType === type,
      ).length,
    ]),
  );

  return (
    <Stack spacing={3}>
      <Box>
        <Typography component="h1" sx={{ fontWeight: 650 }} variant="h4">
          Discovery Recommendations
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Unknown discoveries are prioritized, with your queue still eligible
          when the match is strong.
        </Typography>
      </Box>
      <Card variant="outlined">
        <CardContent>
          <Tabs
            allowScrollButtonsMobile
            scrollButtons="auto"
            sx={{ mb: 2 }}
            value={selectedType}
            variant="scrollable"
          >
            {VISIBLE_MEDIA_TYPES.map((type) => (
              <Tab
                component="a"
                href={buildRecommendationsHref(type)}
                key={type}
                label={`${formatMediaType(type)} (${countsByType.get(type) ?? 0})`}
                value={type}
              />
            ))}
          </Tabs>
          <Divider />
        </CardContent>
      </Card>
      <Stack spacing={2}>
        {visibleRecommendations.map((recommendation, index) => (
          <Card key={recommendation.media.id} variant="outlined">
            <CardContent>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{ justifyContent: "space-between" }}
              >
                <Box>
                  <Link
                    href={`/media/${recommendation.media.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <Typography
                      sx={{ color: "primary.main", fontWeight: 650 }}
                      variant="h6"
                    >
                      {index + 1}. {recommendation.media.title}
                    </Typography>
                  </Link>
                  <Stack
                    direction="row"
                    sx={{ flexWrap: "wrap", gap: 1, mt: 1 }}
                  >
                    <Chip
                      label={formatMediaType(recommendation.media.mediaType)}
                      size="small"
                    />
                    <Chip
                      label={statusLabel(
                        recommendation.media.status,
                        recommendation.media.mediaType,
                      )}
                      size="small"
                      variant="outlined"
                    />
                    {recommendation.reasons.map((reason) => (
                      <Chip
                        key={reason.label}
                        label={`${reason.label} ${formatReasonValue(
                          reason.value,
                        )}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Box>
                <Box sx={{ minWidth: 220 }}>
                  <Typography
                    align="right"
                    color="text.secondary"
                    variant="body2"
                  >
                    Medialy Match {Math.round(recommendation.score)}%
                  </Typography>
                  <LinearProgress
                    value={recommendation.score}
                    variant="determinate"
                  />
                  <Typography
                    align="right"
                    color="text.secondary"
                    variant="caption"
                  >
                    Confidence {Math.round(recommendation.confidence * 100)}%
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {visibleRecommendations.length === 0 ? (
          <StatePanel
            action={{ href: "/media", label: "Review media library" }}
            description={`Add ratings, comparisons, or watchlist items to unlock ${formatMediaType(selectedType).toLowerCase()} recommendations.`}
            title={`No ${formatMediaType(selectedType).toLowerCase()} recommendations yet`}
          />
        ) : null}
      </Stack>
    </Stack>
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildRecommendationsHref(type: string) {
  const searchParams = new URLSearchParams({ type });
  return `/recommendations?${searchParams.toString()}`;
}

function formatReasonValue(value: number) {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}
