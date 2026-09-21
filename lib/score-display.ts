/**
 * Shared scoring presentation helpers — used wherever we render a
 * 0–100 match/recommendation score (dashboard, watchlist, discover,
 * insights). Keep these pure so they can be imported anywhere.
 */

/** Round to one decimal place — the default for dashboard score chips. */
export function formatScore(value: number): string {
  return value.toFixed(1);
}

/** Format a reason delta as a signed integer string ("+12", "-3"). */
export function formatReasonValue(value: number): string {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

/**
 * Qualitative bucket for a Match score. Match is the chance you rate a title
 * above your own average, so the bands are about likelihood, not strength.
 */
export function matchLabel(
  score: number,
): "Very likely" | "Likely" | "Toss-up" | "Unlikely" {
  if (score >= 80) return "Very likely";
  if (score >= 65) return "Likely";
  if (score >= 45) return "Toss-up";
  return "Unlikely";
}

/** Hex accent corresponding to {@link matchLabel}. */
export function matchTone(score: number): string {
  if (score >= 80) return "#2EFFC3";
  if (score >= 65) return "#22D3EE";
  if (score >= 45) return "#FBBF24";
  return "#A78BFA";
}

/** The one-line meaning of Match, for tooltips. */
export const MATCH_MEANING =
  "The chance you'd rate this above your own average, from the titles you've rated, people you follow, and critics.";
