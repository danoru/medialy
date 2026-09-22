import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { requireAdmin } from "@/lib/user";
import { getRecommendationsV1 } from "@/lib/recommendations";
import {
  getRecommendationsV2,
  getRecommendationV2Context,
} from "@/lib/recommendations-v2";
import { isVisibleMediaType, VISIBLE_MEDIA_TYPES } from "@/lib/media-types";
import { formatMediaType } from "@/lib/format";
import { evaluateRecommendations } from "@/lib/scoring/recommendationEvaluation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recommendation comparison" };

export default async function RecommendationComparisonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin("/data-health/recommendations");
  const params = await searchParams;
  const medium =
    typeof params.type === "string" && isVisibleMediaType(params.type)
      ? params.type
      : VISIBLE_MEDIA_TYPES[0];
  const options = { now: new Date() };
  const [legacy, revised, context] = await Promise.all([
    getRecommendationsV1(undefined, options, user.id),
    getRecommendationsV2(user.id, options),
    getRecommendationV2Context(user.id),
  ]);
  const original = legacy.filter((rec) => rec.media.mediaType === medium);
  const v2 = revised.filter((rec) => rec.media.mediaType === medium);
  const originalRanks = new Map(
    original.map((rec, index) => [rec.media.id, index + 1]),
  );
  const overlap = v2
    .slice(0, 10)
    .filter((rec) =>
      original.slice(0, 10).some((old) => old.media.id === rec.media.id),
    ).length;
  const evaluation = evaluateRecommendations(
    context.observations,
    context.friends,
    medium,
    context.others,
  );
  const percent = (value: number | null) =>
    value == null
      ? "Not enough comparable ratings"
      : `${(value * 100).toFixed(1)}%`;
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          Recommendation comparison
        </Typography>
        <Typography color="text.secondary">
          V2 now powers the app. The previous engine is kept here for a
          side-by-side read, and the held-out check below scores both against
          critics alone on the same hidden ratings. Nothing on this page
          changes your library.
        </Typography>
      </Box>
      <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
        {VISIBLE_MEDIA_TYPES.map((type) => (
          <Button
            component="a"
            href={`/data-health/recommendations?type=${type}`}
            variant={type === medium ? "contained" : "outlined"}
            key={type}
          >
            {formatMediaType(type)}
          </Button>
        ))}
      </Stack>
      <Typography>
        {v2.length} eligible titles · {overlap} shared titles in the top 10.
        Scores use different scales; compare the ordering and reasons, not the
        numeric increase.
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6" component="h2">
                Previous engine (v1)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Its confidence value reports signal coverage.
              </Typography>
              {original.slice(0, 10).map((rec, index) => (
                <Box key={rec.media.id}>
                  <Typography component="a" href={`/media/${rec.media.id}`}>
                    {index + 1}. {rec.media.title}
                  </Typography>
                  <Typography variant="body2">
                    {rec.score}/100 match · {Math.round(rec.confidence * 100)}%
                    signal coverage
                  </Typography>
                  <details>
                    <summary>Score breakdown</summary>
                    {rec.explanations?.map((e) => (
                      <Typography variant="body2" key={e.signal}>
                        {e.label}: +{e.contribution} points. {e.detail}
                      </Typography>
                    ))}
                  </details>
                </Box>
              ))}
              {!original.length && (
                <Typography>No eligible titles for this medium.</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6" component="h2">
                Live engine (v2)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Raw score, 50 is neutral; the app shows the calibrated Match. Evidence strength is a heuristic, not a
                probability of liking a title.
              </Typography>
              {v2.slice(0, 10).map((rec, index) => (
                <Box key={rec.media.id}>
                  <Typography component="a" href={`/media/${rec.media.id}`}>
                    {index + 1}. {rec.media.title}
                  </Typography>
                  <Typography variant="body2">
                    {rec.score.toFixed(1)}/100 match ·{" "}
                    {Math.round(rec.confidence * 100)}% evidence strength ·
                    previously #{originalRanks.get(rec.media.id) ?? "—"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {rec.reason}
                  </Typography>
                  <details>
                    <summary>Score breakdown</summary>
                    <Typography variant="body2">
                      Start at neutral 50, then add these signed adjustments:
                    </Typography>
                    {rec.explanations.map((e) => (
                      <Typography variant="body2" key={e.signal} sx={{ mt: 1 }}>
                        {e.label}: {e.contribution >= 0 ? "+" : ""}
                        {e.contribution.toFixed(2)} points ·{" "}
                        {e.value == null
                          ? "unknown"
                          : `${e.value.toFixed(1)}/100`}{" "}
                        · {Math.round(e.reliability * 100)}% support. {e.detail}
                      </Typography>
                    ))}
                  </details>
                </Box>
              ))}
              {!v2.length && (
                <Typography>No eligible titles for this medium.</Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h6" component="h2">
              Held-out rating check
            </Typography>
            <Typography variant="body2">
              Hide a fifth of your ratings, then ask each ranker to order every
              hidden favorite (rated a point or more above your average) against
              every hidden dislike (a point or more below). Ties count as half;
              50% is chance. Same pairs for every ranker.
            </Typography>
            <Typography>
              V2: {percent(evaluation.v2Accuracy)} · Previous engine: {percent(evaluation.v1Accuracy)} · Critics alone:{" "}
              {percent(evaluation.consensusAccuracy)}
            </Typography>
            {evaluation.v2Accuracy != null &&
              evaluation.consensusAccuracy != null &&
              evaluation.v2Accuracy < evaluation.consensusAccuracy && (
                <Typography color="warning.main" variant="body2">
                  Critics alone still edge out v2 on this cut. The personal
                  signals earn their keep where your taste and the critics
                  disagree; see the per-user sweep in lib/scoring/README.md.
                </Typography>
              )}
            <Typography variant="body2">
              {evaluation.ratedTitles} explicit ratings ·{" "}
              {evaluation.evaluatedTitles} held-out titles · {evaluation.pairs}{" "}
              comparable pairs · {evaluation.skippedFolds} folds skipped for
              insufficient data.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Five deterministic folds, separate for each medium. Held-out
              ratings cannot influence the taste profile or friend
              compatibility. Pairwise history is disabled in this check to avoid
              indirect leakage. Both models use identical pairs with known
              consensus. Current metadata and friends’ ratings make this a
              retrospective diagnostic; pairs share titles and are not
              independent trials. It does not establish future recommendation
              quality.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
