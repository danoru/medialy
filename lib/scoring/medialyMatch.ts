import { MEDIALY_MATCH_WEIGHTS } from "@/lib/scoring/config";
import { clamp } from "@/lib/scoring/pairwise";
import type { MedialyMatchReason } from "@/lib/scoring/types";

/**
 * Medialy Match is *taste-only*. It answers: "given what I know about this
 * user, how much will they like this item?". Status (already watched, paused,
 * dropped, future-dated) is handled separately by `eligibility.ts` — it's a
 * binary gate on the candidate pool, not a score weight.
 *
 * Personal score is deliberately absent: by the time an item reaches this
 * function it's a recommendation candidate the viewer hasn't consumed, so
 * "how much you've already shown you like it" is meaningless. Demonstrated
 * taste flows in through the affinity signals (genre / tag / contributor).
 *
 * Every signal is normalized to 0–100 before weighting. Final score is also
 * 0–100. Weights live in `lib/scoring/config.ts` and are designed to sum to 1.
 */

export type MedialyMatchSignals = {
  /** 0–100. Overlap with genres of your highly-rated completed items. */
  genreAffinity: number;
  /** 0–100. Overlap with tags (including country) of your highly-rated items. */
  tagAffinity: number;
  /** 0–100. Shared director/creator/dev/publisher with items you love. */
  contributorAffinity: number;
  /** 0–100. Ratings from followers, weighted by per-follower taste compatibility. */
  friendAffinity: number;
  /** 0–10. External critic consensus. */
  consensusScore: number | null;
  /**
   * Optional per-call detail overrides surfaced in the explanations. Useful
   * for naming the specific director or country that drove a match.
   */
  details?: Partial<Record<keyof typeof MEDIALY_MATCH_WEIGHTS, string>>;
};

export type MedialyMatchExplanation = {
  signal: keyof typeof MEDIALY_MATCH_WEIGHTS;
  label: string;
  rawValue: number; // pre-weight, normalized to 0–100
  weight: number; // 0–1
  contribution: number; // rawValue * weight, rounded
  detail?: string;
};

export type MedialyMatchOutput = {
  score: number;
  reasons: MedialyMatchReason[]; // legacy shape, kept for existing callers
  explanations: MedialyMatchExplanation[]; // full breakdown for hover explainers
};

export function calculateMedialyMatch(
  signals: MedialyMatchSignals,
): MedialyMatchOutput {
  const explanations: MedialyMatchExplanation[] = [];

  explanations.push(
    pushExplanation(
      "genreAffinity",
      "Genre affinity",
      clamp(signals.genreAffinity, 0, 100),
      {
        detail:
          signals.details?.genreAffinity ??
          "Overlap with genres of your highly-rated completed items",
      },
    ),
  );

  explanations.push(
    pushExplanation(
      "tagAffinity",
      "Tag affinity",
      clamp(signals.tagAffinity, 0, 100),
      {
        detail:
          signals.details?.tagAffinity ?? "Overlap with tags from your favorites",
      },
    ),
  );

  explanations.push(
    pushExplanation(
      "contributorAffinity",
      "Contributor affinity",
      clamp(signals.contributorAffinity, 0, 100),
      {
        detail:
          signals.details?.contributorAffinity ??
          "Shared director, creator, developer, or publisher with items you love",
      },
    ),
  );

  explanations.push(
    pushExplanation(
      "friendAffinity",
      "Friend signal",
      clamp(signals.friendAffinity, 0, 100),
      {
        detail:
          signals.details?.friendAffinity ??
          "Aggregated ratings from people you follow, weighted by taste compatibility",
      },
    ),
  );

  explanations.push(
    pushExplanation(
      "consensus",
      "Critic consensus",
      normalizedTenPoint(signals.consensusScore),
      {
        detail:
          signals.consensusScore == null
            ? "No external ratings yet"
            : `Aggregated critics: ${signals.consensusScore}/10`,
      },
    ),
  );

  const total = explanations.reduce(
    (sum, entry) => sum + entry.contribution,
    0,
  );

  return {
    score: Math.round(clamp(total, 0, 100)),
    reasons: explanations
      .filter((entry) => Math.abs(entry.contribution) >= 1)
      .map((entry) => ({ label: entry.label, value: entry.contribution })),
    explanations,
  };
}

function pushExplanation(
  signal: keyof typeof MEDIALY_MATCH_WEIGHTS,
  label: string,
  rawValue: number,
  options: { detail?: string } = {},
): MedialyMatchExplanation {
  const weight = MEDIALY_MATCH_WEIGHTS[signal];
  return {
    signal,
    label,
    rawValue: Math.round(rawValue),
    weight,
    contribution: Math.round(rawValue * weight),
    detail: options.detail,
  };
}

function normalizedTenPoint(value: number | null) {
  return value == null ? 0 : clamp(value * 10, 0, 100);
}
