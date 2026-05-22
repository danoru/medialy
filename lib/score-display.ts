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

/** Qualitative bucket for a 0–100 match score. */
export function matchLabel(
  score: number,
): "Very High" | "High" | "Solid" | "Niche" {
  if (score >= 85) return "Very High";
  if (score >= 60) return "High";
  if (score >= 35) return "Solid";
  return "Niche";
}

/** Hex accent corresponding to {@link matchLabel}. */
export function matchTone(score: number): string {
  if (score >= 85) return "#2EFFC3";
  if (score >= 70) return "#22D3EE";
  if (score >= 55) return "#FBBF24";
  return "#A78BFA";
}
