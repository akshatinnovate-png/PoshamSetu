// WHO 2009 weight-velocity standards: z-score of a weight gain over a 1- or 2-month interval.
import { WHO_VELOCITY } from './who-velocity.js';

/** z of an increment (grams) for one WHO row, using the row's delta so negative gains can be scored. */
export function incrementZ(row, grams) {
  const x = grams + row.delta;
  if (x <= 0) return -5;
  return Math.max(-5, Math.min(5, (Math.pow(x / row.M, row.L) - 1) / (row.L * row.S)));
}
/** Increment (grams) at a given z for a row. */
export function incrementAt(row, z) { return row.M * Math.pow(1 + row.L * row.S * z, 1 / row.L) - row.delta; }

/**
 * Score a weight gain between two visits. WHO built the standards on intervals anchored at fixed ages;
 * real visits are not, so the gain is scaled to the nominal interval length and matched to the
 * interval whose start age is nearest the first visit (prototype convention, flagged in the rule pack).
 */
export function velocityZ(sex, fromAgeDays, toAgeDays, gainKg) {
  const span = toAgeDays - fromAgeDays;
  const table = span >= 45 ? 'w2' : 'w1';
  const rows = WHO_VELOCITY[table][sex === 'F' ? 'F' : 'M'];
  let best = null;
  for (const r of rows) { const d = Math.abs(r.from - fromAgeDays); if (!best || d < best.d) best = { r, d }; }
  if (!best || best.d > (table === 'w1' ? 20 : 35)) return null;
  const nominal = best.r.to - best.r.from;
  const grams = gainKg * 1000 * (nominal / span);
  return { z: Math.round(incrementZ(best.r, grams) * 100) / 100, interval: best.r.label, months: table === 'w1' ? 1 : 2, grams: Math.round(grams), p15: Math.round(incrementAt(best.r, -1.0364)) };
}
