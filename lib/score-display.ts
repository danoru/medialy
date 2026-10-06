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

/** What Match means, for tooltips. */
export const MATCH_MEANING =
  "How likely you are to rate this above your own average. Tested against ratings people have already given, titles shown at 95% landed above the rater's average about 95 times in 100.";

/** What Confidence means, for tooltips. */
export const CONFIDENCE_MEANING =
  "How much there is to go on for this title: your ratings of similar titles, its director, subgenres, genres, themes, era and cast, which eras you watch, people you follow, and critics. Low confidence means the Match rests on only a few of those, often just critics.";

/** Why Match and Confidence can disagree. */
export const MATCH_VS_CONFIDENCE =
  "They answer different questions. 95% match with 32% confidence means everything known points your way, but not much is known yet. Rate more titles and this sharpens.";

/** Confidence tooltip body: the definition, then the Match comparison on a new line. */
export const CONFIDENCE_TOOLTIP = `${CONFIDENCE_MEANING}
${MATCH_VS_CONFIDENCE}`;
