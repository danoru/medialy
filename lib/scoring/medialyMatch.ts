import { MEDIALY_MATCH_WEIGHTS } from "@/lib/scoring/config";
import { clamp } from "@/lib/scoring/pairwise";
import type { MedialyMatchReason } from "@/lib/scoring/types";

/**
 * Medialy Match is *taste-only*. It answers: "given what I know about this
 * user, how much will they like this item?". Status (already watched, paused,
 * dropped, future-dated) is handled separately by `eligibility.ts` — it's a
 * binary gate on the candidate pool, not a score weight.
 *
 * Every signal is normalized to 0–100 before weighting. Final score is also
 * 0–100. Weights live in `lib/scoring/config.ts` and are designed to sum to 1.
 */

export type MedialyMatchSignals = {
  /** 0–10. Personal rating (or pairwise fallback). */
  personalScore: number | null;
  /**
   * 0–1 trust modifier on personalScore. Reflects engagement (rated COMPLETED
   * vs. expected on WATCHLIST). See `personalScoreTrustForStatus`.
   */
  personalScoreTrust?: number;
  /** 0–100. Overlap with genres of your highly-rated completed items. */
  genreAffinity: number;
  /** 0–100. Overlap with tags of your highly-rated completed items. */
  tagAffinity: number;
  /** 0–100. Friend ratings + watch status aggregated. */
  friendAffinity: number;
  /**
   * 0–100. Shared director/creator/dev with your highly-rated items. New
   * signal; pass 0 if you haven't computed contributor affinity yet.
   */
  contributorAffinity?: number;
  /** 0–10. External critic consensus. Smallest weight — least personalized. */
  consensusScore: number | null;
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

  const personalRaw =
    normalizedTenPoint(signals.personalScore) *
    clamp(signals.personalScoreTrust ?? 1, 0, 1);
  explanations.push(
    pushExplanation("personalScore", "Personal score", personalRaw, {
      detail:
        signals.personalScore == null
          ? "No personal rating yet"
          : `Your score: ${signals.personalScore}/10 × trust ${(signals.personalScoreTrust ?? 1).toFixed(2)}`,
    }),
  );

  explanations.push(
    pushExplanation(
      "genreAffinity",
      "Genre affinity",
      clamp(signals.genreAffinity, 0, 100),
      { detail: "Overlap with genres of your highly-rated completed items" },
    ),
  );

  explanations.push(
    pushExplanation(
      "tagAffinity",
      "Tag affinity",
      clamp(signals.tagAffinity, 0, 100),
      { detail: "Overlap with tags from your favorites" },
    ),
  );

  explanations.push(
    pushExplanation(
      "friendAffinity",
      "Friend signal",
      clamp(signals.friendAffinity, 0, 100),
      { detail: "Aggregated friend ratings and watch statuses" },
    ),
  );

  explanations.push(
    pushExplanation(
      "contributorAffinity",
      "Contributor affinity",
      clamp(signals.contributorAffinity ?? 0, 0, 100),
      {
        detail:
          "Shared director, creator, developer, or publisher with items you love",
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
