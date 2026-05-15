import { clamp } from "@/lib/scoring/pairwise";
import type { MedialyMatchReason } from "@/lib/scoring/types";
import { MEDIALY_MATCH_WEIGHTS } from "@/lib/scoring/weights";

export type MedialyMatchSignals = {
  personalScore: number | null;
  personalScoreTrust?: number;
  genreAffinity: number;
  tagAffinity: number;
  friendAffinity: number;
  status: number;
  upcoming: number;
  consensusScore: number | null;
};

export function calculateMedialyMatch(signals: MedialyMatchSignals) {
  const reasons: MedialyMatchReason[] = [];
  let score = 0;

  addReason(
    reasons,
    "Personal score",
    normalizedTenPoint(signals.personalScore) *
      clamp(signals.personalScoreTrust ?? 1, 0, 1) *
      MEDIALY_MATCH_WEIGHTS.personalScore,
  );
  addReason(
    reasons,
    "Genre affinity",
    clamp(signals.genreAffinity, 0, 100) * MEDIALY_MATCH_WEIGHTS.genreAffinity,
  );
  addReason(
    reasons,
    "Tag affinity",
    clamp(signals.tagAffinity, 0, 100) * MEDIALY_MATCH_WEIGHTS.tagAffinity,
  );
  addReason(
    reasons,
    "Friend signal",
    clamp(signals.friendAffinity, 0, 100) *
      MEDIALY_MATCH_WEIGHTS.friendAffinity,
  );
  addReason(
    reasons,
    signals.status >= 0 ? "Discovery signal" : "Queue signal",
    clamp(signals.status, -100, 100) * MEDIALY_MATCH_WEIGHTS.status,
  );
  addReason(
    reasons,
    "Upcoming",
    clamp(signals.upcoming, 0, 100) * MEDIALY_MATCH_WEIGHTS.upcoming,
  );
  addReason(
    reasons,
    "Consensus",
    normalizedTenPoint(signals.consensusScore) *
      MEDIALY_MATCH_WEIGHTS.consensus,
  );

  score = reasons.reduce((sum, reason) => sum + reason.value, 0);

  return {
    score: Math.round(clamp(score, 0, 100)),
    reasons: reasons.filter((reason) => Math.abs(reason.value) >= 1),
  };
}

function normalizedTenPoint(value: number | null) {
  return value == null ? 0 : clamp(value * 10, 0, 100);
}

function addReason(
  reasons: MedialyMatchReason[],
  label: string,
  value: number,
) {
  reasons.push({ label, value: Math.round(value) });
}
