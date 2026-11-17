// Data-reliability score per AWC feed (audit item 4).
//
// Round 1 formula: R = 100 x (1 - (B + D + F) / 3)  — equal weights.
// Round 2 formula: R = 100 x (1 - min(1, wB*B + wF*F + wD*D*chronic))
//   B  share of readings outside WHO plausible limits (hard entry/hardware failure) — heavy weight,
//      and each BIV reading is also quarantined individually.
//   F  share of readings sitting in flat runs (identical weights >= 3 visits for a growing child).
//   D  digit-preference index (terminal-digit dissimilarity, 0..1) — a low-grade human habit:
//      it only enters R when it has been above the audit threshold for `dChronicMonths`
//      months running; before that it only raises an audit flag for supportive supervision.
import { DAY, round, clamp } from './util.js';

/** Dissimilarity index of terminal (tenths) digits, scaled 0..1. */
export function digitPreference(values) {
  const digits = values.filter((v) => v != null).map((v) => Math.round(v * 10) % 10);
  if (digits.length < 10) return { index: 0, n: digits.length, hist: new Array(10).fill(0) };
  const hist = new Array(10).fill(0);
  for (const d of digits) hist[d]++;
  const n = digits.length;
  const dis = 0.5 * hist.reduce((s, c) => s + Math.abs(c / n - 0.1), 0);
  // Small-sample correction: a perfectly unbiased AWC still shows ~1.2/sqrt(n) dissimilarity.
  const e0 = Math.min(0.5, 1.197 / Math.sqrt(n));
  return { index: clamp((dis - e0) / (0.9 - e0), 0, 1), raw: dis, expected: e0, n, hist };
}

/** Share of readings that belong to runs of >= runLen identical weights for one child. */
export function flatShare(childSeries, runLen) {
  let total = 0, flat = 0;
  for (const series of childSeries) {
    total += series.length;
    let run = 1;
    for (let i = 1; i <= series.length; i++) {
      if (i < series.length && series[i] != null && series[i] === series[i - 1]) run++;
      else { if (run >= runLen) flat += run; run = 1; }
    }
  }
  return total ? flat / total : 0;
}

/**
 * Score one AWC feed.
 * @param visitsByChild Array of visit arrays (from triage.buildVisits)
 * @param monthlyD optional history of monthly D values (oldest first) to test chronicity
 */
export function scoreFeed(visitsByChild, pack, monthlyD = []) {
  const cfg = pack.reliability;
  const all = visitsByChild.flat();
  const n = all.length;
  const B = n ? all.filter((v) => v.biv.length).length / n : 0;
  const F = flatShare(visitsByChild.map((vs) => vs.map((v) => v.weightKg)), cfg.flatRunLength);
  const dp = digitPreference(all.map((v) => v.weightKg));
  const D = dp.index;
  const recent = [...monthlyD, D].slice(-cfg.dChronicMonths);
  const chronic = recent.length >= cfg.dChronicMonths && recent.every((d) => d >= cfg.dAuditThreshold);
  const w = cfg.weights;
  const penalty = w.B * B + w.F * F + (chronic ? w.D * D : 0);
  const R = round(100 * (1 - clamp(penalty, 0, 1)), 1);
  const legacyR = round(100 * (1 - (B + D + F) / 3), 1);
  const flags = [];
  if (B > 0) flags.push({ code: 'BIV', severity: 'high', text: `${round(B * 100, 1)}% implausible readings — check scale / entry` });
  if (F >= 0.1) flags.push({ code: 'FLAT', severity: 'med', text: `${round(F * 100, 1)}% of readings in flat runs — possible copy-forward` });
  if (D >= cfg.dAuditThreshold) flags.push({ code: chronic ? 'DIGIT_CHRONIC' : 'DIGIT_AUDIT', severity: chronic ? 'med' : 'low', text: chronic ? `Digit preference ${round(D, 2)} for ${cfg.dChronicMonths}+ months — now counts in R` : `Digit preference ${round(D, 2)} — audit flag only (not yet chronic)` });
  return {
    R, legacyR, B: round(B, 4), F: round(F, 4), D: round(D, 4), chronic, n,
    contributions: { B: round(w.B * B * 100, 1), F: round(w.F * F * 100, 1), D: round((chronic ? w.D * D : 0) * 100, 1) },
    hist: dp.hist, flags, belowCutoff: R < cfg.cutoff,
  };
}

/** Score month by month so chronic digit preference can be detected. */
export function scoreFeedOverTime(visitsByChild, pack, monthStarts) {
  const out = [];
  const dHist = [];
  for (let i = 0; i < monthStarts.length; i++) {
    const from = monthStarts[i], to = monthStarts[i + 1] ?? Infinity;
    const slice = visitsByChild.map((vs) => vs.filter((v) => v.t >= from && v.t < to)).filter((vs) => vs.length);
    // F needs history: use visits up to the end of this month.
    const upto = visitsByChild.map((vs) => vs.filter((v) => v.t < to && v.t >= to - 120 * DAY));
    const s = scoreFeed(slice, pack, dHist);
    const f = flatShare(upto.map((vs) => vs.map((v) => v.weightKg)), pack.reliability.flatRunLength);
    const w = pack.reliability.weights;
    const pen = w.B * s.B + w.F * f + (s.chronic ? w.D * s.D : 0);
    out.push({ month: from, ...s, F: round(f, 4), R: round(100 * (1 - clamp(pen, 0, 1)), 1) });
    dHist.push(s.D);
  }
  return out;
}
