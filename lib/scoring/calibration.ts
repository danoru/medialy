import { MATCH_CALIBRATION } from "@/lib/scoring/config";
import { clamp } from "@/lib/scoring/pairwise";

/**
 * Turns the engine's raw 0–100 score into a displayed Match: the chance the
 * viewer rates the title above their own average. The mapping is a logistic
 * curve fitted offline on held-out ratings (`npm run recommendations:evaluate`)
 * and stored in `MATCH_CALIBRATION`, so 70% means the same thing for every
 * viewer and every medium.
 */

export type CalibrationSample = {
  /** Raw v2 score, 0–100. */
  score: number;
  /** Did the viewer rate this title above their own average? */
  above: boolean;
};

export type LogisticFit = { intercept: number; slope: number };

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Newton's method on the two-parameter logistic likelihood with a little
 * ridge so a tiny or perfectly separable sample cannot blow the slope up.
 * The score is centered on 50 before fitting.
 */
export function fitLogistic(
  samples: CalibrationSample[],
  options: { iterations?: number; ridge?: number } = {},
): LogisticFit | null {
  if (samples.length < 20) return null;
  const positives = samples.filter((s) => s.above).length;
  if (positives === 0 || positives === samples.length) return null;
  const iterations = options.iterations ?? 25;
  const ridge = options.ridge ?? 1e-3;
  const xs = samples.map((s) => (s.score - 50) / 10);
  const ys = samples.map((s) => (s.above ? 1 : 0));
  let a = Math.log(positives / (samples.length - positives));
  let b = 0;
  for (let step = 0; step < iterations; step += 1) {
    let g0 = 0;
    let g1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    for (let i = 0; i < xs.length; i += 1) {
      const p = sigmoid(a + b * xs[i]);
      const r = ys[i] - p;
      const w = p * (1 - p);
      g0 += r;
      g1 += r * xs[i];
      h00 += w;
      h01 += w * xs[i];
      h11 += w * xs[i] * xs[i];
    }
    g1 -= ridge * b;
    h11 += ridge;
    const det = h00 * h11 - h01 * h01;
    if (Math.abs(det) < 1e-12) break;
    const da = (h11 * g0 - h01 * g1) / det;
    const db = (h00 * g1 - h01 * g0) / det;
    a += da;
    b += db;
    if (Math.abs(da) < 1e-9 && Math.abs(db) < 1e-9) break;
  }
  return { intercept: a, slope: b / 10 };
}

/** Probability, 0–1, that the viewer rates a title with this raw score above their average. */
export function calibratedProbability(
  rawScore: number,
  fit: LogisticFit = MATCH_CALIBRATION,
) {
  return sigmoid(fit.intercept + fit.slope * (rawScore - 50));
}

/** The displayed Match, 0–100. */
export function calibratedMatch(rawScore: number, fit?: LogisticFit) {
  return Math.round(clamp(calibratedProbability(rawScore, fit) * 100, 0, 100));
}

/** Mean squared distance between predicted probabilities and outcomes; lower is better. */
export function brierScore(samples: CalibrationSample[], fit: LogisticFit) {
  if (samples.length === 0) return null;
  return (
    samples.reduce((sum, s) => {
      const p = calibratedProbability(s.score, fit);
      return sum + (p - (s.above ? 1 : 0)) ** 2;
    }, 0) / samples.length
  );
}
