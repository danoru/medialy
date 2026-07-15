import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  BADGE_THRESHOLDS,
  COMPARISON_RELEVANCE,
  CONSENSUS,
  RATING_COMPATIBILITY,
  HIDDEN_GEM,
  MEDIALY_MATCH_WEIGHTS,
  PAIRWISE,
  PERSONAL_SCORE,
  SOURCE_MEDIA_APPLICABILITY,
  SOURCE_TRUST_WEIGHTS,
} from "@/lib/scoring/config";
import { requireAdmin } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scoring" };

/**
 * Read-only audit page. Every tunable in `lib/scoring/config.ts` is surfaced
 * here with a short description so you can see — and reason about — exactly
 * what the algorithms do. Hover the (i) on any row for the full explanation.
 *
 * If you change a constant, just reload — there's no caching layer in front.
 */
export default async function ScoringConfigPage() {
  await requireAdmin("/data-health/scoring");
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="eyebrow" sx={{ display: "block", mb: 0.75 }}>
          Algorithms
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontFamily:
              'var(--font-heading), "Satoshi", "General Sans", "Space Grotesk", "Inter", system-ui, sans-serif',
            fontSize: { xs: "1.5rem", md: "1.875rem" },
            fontWeight: 650,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
          }}
        >
          Scoring Configuration
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720, mt: 1 }}>
          One page, every knob. Each metric below is computed from the values
          shown here — change a number in <code>lib/scoring/config.ts</code> and
          this page reflects it immediately. Hover the (i) for a description
          of what each tunable does.
        </Typography>
      </Box>

      <FormulaSection
        title="Pairwise (Elo)"
        formula="winnerDelta = K(comparisons) × weight × (1 − expectedWinnerWinProb)"
        description="Standard Elo with confidence-decayed K-factor. The expected outcome now blends rating + consensus + pairwise so upsets register correctly. Pairwise score itself remains the only value that updates."
      >
        <Row label="Starting score" value={PAIRWISE.initialScore} />
        <Row label="Base K-factor" value={PAIRWISE.baseKFactor} />
        <Row
          label="K-factor decay"
          info="Walked top→down. Last matching bucket wins. Lower K = score moves less per comparison."
          value={PAIRWISE.kDecay
            .map((b) => `≥${b.atLeast}: ×${b.multiplier}`)
            .join(" • ")}
        />
        <Row
          label="UI normalization range"
          value={`${PAIRWISE.uiRange.min}–${PAIRWISE.uiRange.max}`}
        />
        <Row
          label="Prior blend weights"
          info="Used only when computing expected outcome — pairwise score itself is the only field that updates."
          value={`rating ${PAIRWISE.priorBlend.personalRating} · consensus ${PAIRWISE.priorBlend.consensus} · pairwise ${PAIRWISE.priorBlend.pairwise}`}
        />
        <Row
          label="Prior spread per rating point"
          info="Elo points per 1.0 of rating gap. Higher = bigger upset bonus."
          value={PAIRWISE.priorSpreadPerRatingPoint}
        />
        <Row
          label="Confidence buckets"
          value={PAIRWISE.confidenceBuckets
            .map((b) => `≥${b.atLeast}: ${b.value}`)
            .join(" • ")}
        />
      </FormulaSection>

      <FormulaSection
        title="Personal Score"
        formula="personalScore = explicitRating × (1 − w) + pairwiseRating × w  where w = relationalWeight × pairwiseConfidence"
        description="Blend of your explicit rating and pairwise-derived rating. Pairwise weight scales with how many comparisons you've made."
      >
        <Row
          label="Relational weight (target)"
          info="Maximum share of the score that pairwise can take. Multiplied by pairwise confidence to get actual weight."
          value={PERSONAL_SCORE.relationalWeight}
        />
        <Row
          label="Explicit rating confidence floor"
          value={PERSONAL_SCORE.explicitRatingConfidenceFloor}
        />
        <Row
          label="Pairwise-only confidence damping"
          info="When no explicit rating exists, multiply pairwise confidence by this."
          value={PERSONAL_SCORE.pairwiseOnlyConfidenceDamping}
        />
      </FormulaSection>

      <FormulaSection
        title="Consensus"
        formula="consensus = Σ(normalized × trust × recency × outlierTrim) / Σ(weights)"
        description="Robust weighted mean of external ratings. Per-source trust, per-medium gating, outlier downweighting, and recency decay all apply."
      >
        <Row
          label="Source trust weights"
          info="0 = ignore. 1 = full trust. Sources missing from this map are treated as 0.5."
          value={Object.entries(SOURCE_TRUST_WEIGHTS)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ")}
        />
        <Row
          label="Per-medium applicability"
          info="A source only contributes if its applicability list includes the item's media type. null = applies to every medium."
          value={
            <Stack spacing={0.5}>
              {Object.entries(SOURCE_MEDIA_APPLICABILITY).map(([k, v]) => (
                <Typography key={k} sx={{ fontSize: "0.875rem" }}>
                  <strong>{k}</strong>: {v == null ? "all" : v.join(", ")}
                </Typography>
              ))}
            </Stack>
          }
        />
        <Row
          label="Source confidence denominator"
          info="totalWeight ÷ this = sourceConfidence. Higher = harder to reach full confidence."
          value={CONSENSUS.sourceCountDenominator}
        />
        <Row
          label="Agreement variance divisor"
          info="1 − meanAbsDev ÷ divisor = agreementConfidence."
          value={CONSENSUS.agreementVarianceDivisor}
        />
        <Row
          label="Outlier trim"
          info={`Once we have at least ${CONSENSUS.outlierTrim.minSourcesForTrim} sources, any rating ${CONSENSUS.outlierTrim.deviationFromMedian}+ away from the median is multiplied by ${CONSENSUS.outlierTrim.trimMultiplier}.`}
          value={`min ${CONSENSUS.outlierTrim.minSourcesForTrim} sources · ≥${CONSENSUS.outlierTrim.deviationFromMedian} pts from median · ×${CONSENSUS.outlierTrim.trimMultiplier}`}
        />
        <Row
          label="Recency decay"
          info="Linear from 1.0 down to floor across the window."
          value={`stale after ${CONSENSUS.recency.staleAfterDays}d · floor ${CONSENSUS.recency.floor}`}
        />
      </FormulaSection>

      <FormulaSection
        title="Medialy Match (taste-only)"
        formula="match = Σ(signalᵢ × weightᵢ), clamped to 0–100"
        description="Pure taste signal. Status and upcoming are NOT here — they're eligibility filters on the candidate pool (see `lib/scoring/eligibility.ts`). Each row is what we believe about you, not what's convenient to consume right now."
      >
        {Object.entries(MEDIALY_MATCH_WEIGHTS).map(([key, value]) => (
          <Row key={key} label={key} value={value} />
        ))}
        <Row
          label="Sum"
          info="Should be ≈ 1.0 so the final score sits naturally in 0–100."
          value={Object.values(MEDIALY_MATCH_WEIGHTS).reduce(
            (a, b) => a + b,
            0,
          )}
        />
      </FormulaSection>

      <FormulaSection
        title="Comparison Relevance"
        formula="relevance = base + Σ(componentᵢ × weightᵢ), clamped 0–1"
        description="How relevant is a head-to-head matchup? Used to weight Elo updates and to pick which pairs to surface on the compare page."
      >
        <Row label="Base" value={COMPARISON_RELEVANCE.base} />
        <Row label="Genre weight" value={COMPARISON_RELEVANCE.genre} />
        <Row label="Tag weight" value={COMPARISON_RELEVANCE.tag} />
        <Row label="Rating proximity weight" value={COMPARISON_RELEVANCE.rating} />
        <Row label="Pairwise proximity weight" value={COMPARISON_RELEVANCE.pairwise} />
        <Row label="Year proximity weight" value={COMPARISON_RELEVANCE.year} />
        <Row
          label="Proximity budgets"
          info="Distance past these collapses the proximity score to 0."
          value={`rating ±${COMPARISON_RELEVANCE.ratingMaxDistance} · pairwise ±${COMPARISON_RELEVANCE.pairwiseMaxDistance} · year ±${COMPARISON_RELEVANCE.yearMaxDistance}`}
        />
        <Row
          label="Elo weight floor"
          info="Even an irrelevant comparison contributes this minimum."
          value={COMPARISON_RELEVANCE.eloWeightFloor}
        />
      </FormulaSection>

      <FormulaSection
        title="Friend Compatibility"
        formula="score = max(0, 100 − avgRatingDistance × penalty)"
        description="How aligned is a friend with your taste? Computed from items you've both rated."
      >
        <Row
          label="Rating distance penalty"
          info="12 means a 1-point average gap drops you to 88; a 5-point gap drops you to 40."
          value={RATING_COMPATIBILITY.ratingDistancePenalty}
        />
      </FormulaSection>

      <FormulaSection
        title="Hidden Gem"
        formula="score = quality × wQ + obscurity × wO + confidence × wC"
        description="Quality = best of (personal, consensus, pairwise) normalized. Obscurity = how few comparisons relative to your library median. Confidence keeps no-data items out."
      >
        <Row
          label="Weights"
          value={`quality ${HIDDEN_GEM.weights.quality} · obscurity ${HIDDEN_GEM.weights.obscurity} · confidence ${HIDDEN_GEM.weights.confidence}`}
        />
        <Row
          label="Quality normalization ranges"
          info="Min/max for each source. The maximum across the three is used."
          value={`personal ${HIDDEN_GEM.qualitySources.personalScore.min}–${HIDDEN_GEM.qualitySources.personalScore.max} · consensus ${HIDDEN_GEM.qualitySources.consensusScore.min}–${HIDDEN_GEM.qualitySources.consensusScore.max} · pairwise ${HIDDEN_GEM.qualitySources.pairwiseScore.min}–${HIDDEN_GEM.qualitySources.pairwiseScore.max}`}
        />
        <Row label="Badge threshold" value={HIDDEN_GEM.badgeThreshold} />
        <Row label="Minimum confidence" value={HIDDEN_GEM.minConfidence} />
      </FormulaSection>

      <FormulaSection
        title="Discoverability Badges"
        formula="evaluateBadges(item) → BadgeMatch[]"
        description="Cheap badges that surface anywhere an item appears. Each is a pure function in `lib/scoring/badges.ts` returning a typed match with explainer text."
      >
        <Row
          label="Sleeper Hit"
          info="Untouched item with strong critical consensus."
          value={`consensus ≥${BADGE_THRESHOLDS.sleeperHit.minConsensusScore} · confidence ≥${BADGE_THRESHOLDS.sleeperHit.minConsensusConfidence}`}
        />
        <Row
          label="Polarizing"
          info="Wide spread across critics."
          value={`≥${BADGE_THRESHOLDS.polarizing.minSources} sources · σ ≥${BADGE_THRESHOLDS.polarizing.minStandardDeviation}`}
        />
        <Row
          label="Cold Take"
          info="You loved it; critics didn't."
          value={`personal ≥${BADGE_THRESHOLDS.coldTake.minPersonalScore} · consensus ≤${BADGE_THRESHOLDS.coldTake.maxConsensusScore}`}
        />
        <Row
          label="Wasn't For You"
          info="Critics loved it; you didn't."
          value={`consensus ≥${BADGE_THRESHOLDS.hotTakeFailed.minConsensusScore} · personal ≤${BADGE_THRESHOLDS.hotTakeFailed.maxPersonalScore}`}
        />
        <Row
          label="Friend Favorite"
          info="At least one friend rated it highly, you haven't tried it."
          value={`friend ≥${BADGE_THRESHOLDS.friendFavoriteUntouched.minFriendRating}`}
        />
      </FormulaSection>

      <FormulaSection
        title="Eligibility (not a score)"
        formula="isEligibleForRecommendation(item, options) → { eligible, reason? }"
        description="Binary filter on the recommendation pool. Separate from Match. Reasons are surfaced in the UI so excluded items explain themselves instead of silently disappearing."
      >
        <Row
          label="Excluded by default"
          value="COMPLETED · IN_PROGRESS · DROPPED · archived · future-dated"
        />
        <Row
          label="Opt-ins"
          info="Per-user, future. Each opt-in unlocks a lane."
          value="includeCompleted · includeUpcoming · includeArchived · includeDropped · hiddenMediaTypes"
        />
      </FormulaSection>
    </Stack>
  );
}

function FormulaSection({
  title,
  formula,
  description,
  children,
}: {
  title: string;
  formula: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.25}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: "1.125rem", fontWeight: 600 }}>
              {title}
            </Typography>
          </Stack>
          <Box
            sx={{
              fontFamily: "monospace",
              fontSize: "0.875rem",
              p: 1,
              bgcolor: "surface.1",
              border: "1px solid",
              borderColor: "border.subtle",
              borderRadius: 2,
              overflow: "auto",
            }}
          >
            {formula}
          </Box>
          <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
            {description}
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Stack spacing={0.75}>{children}</Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  info,
}: {
  label: string;
  value: React.ReactNode;
  info?: string;
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      sx={{
        alignItems: { sm: "flex-start" },
        gap: { xs: 0.25, sm: 1.5 },
        justifyContent: "space-between",
      }}
    >
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.5, minWidth: 220 }}>
        <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>{label}</Typography>
        {info ? (
          <Tooltip arrow title={info} placement="top">
            <InfoOutlinedIcon
              sx={{ fontSize: 14, color: "text.secondary", cursor: "help" }}
            />
          </Tooltip>
        ) : null}
      </Stack>
      <Box
        sx={{
          fontSize: "0.875rem",
          color: "text.secondary",
          fontFamily:
            typeof value === "string" || typeof value === "number"
              ? "monospace"
              : undefined,
          textAlign: { sm: "right" },
        }}
      >
        {typeof value === "number" || typeof value === "string" ? (
          <Chip
            label={String(value)}
            size="small"
            sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}
          />
        ) : (
          value
        )}
      </Box>
    </Stack>
  );
}
