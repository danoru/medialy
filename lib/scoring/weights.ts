/**
 * Backwards-compatible re-exports. New code should import from
 * `@/lib/scoring/config` directly. This shim exists so existing imports keep
 * working while the migration completes.
 */
import {
  MEDIALY_MATCH_WEIGHTS as CONFIG_MATCH_WEIGHTS,
  PERSONAL_SCORE,
  SOURCE_TRUST_WEIGHTS as CONFIG_SOURCE_TRUST,
} from "@/lib/scoring/config";

export const PERSONAL_SCORE_RELATIONAL_WEIGHT = PERSONAL_SCORE.relationalWeight;
export const SOURCE_TRUST_WEIGHTS = CONFIG_SOURCE_TRUST;
export const MEDIALY_MATCH_WEIGHTS = CONFIG_MATCH_WEIGHTS;
