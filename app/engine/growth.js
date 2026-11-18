// WHO Child Growth Standards z-scores (LMS method), including WHO's restricted
// computation beyond ±3 SD for weight-based indicators.
import { WHO_LMS } from './who-lms.js';

export const DAYS_PER_MONTH = 30.4375;
const sexKey = (sex) => (sex === 'F' || sex === 'girls' ? 'girls' : 'boys');

function interp(rows, x) {
  if (x < rows[0][0] || x > rows[rows.length - 1][0]) return null;
  let lo = 0, hi = rows.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (rows[mid][0] <= x) lo = mid; else hi = mid;
  }
  const a = rows[lo], b = rows[hi];
  const t = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
  return { L: a[1] + (b[1] - a[1]) * t, M: a[2] + (b[2] - a[2]) * t, S: a[3] + (b[3] - a[3]) * t };
}

// lhfa holds two month-24 rows (length then height). Split once.
const LHFA = {};
for (const k of ['boys', 'girls']) {
  const rows = WHO_LMS.lhfa[k];
  const i = rows.findIndex((r) => r[0] === 24);
  LHFA[k] = { length: rows.slice(0, i + 1), height: rows.slice(i + 1) };
}

export function zFromLMS({ L, M, S }, y, restricted = true) {
  const z = Math.abs(L) < 1e-9 ? Math.log(y / M) / S : (Math.pow(y / M, L) - 1) / (S * L);
  if (!restricted || Math.abs(z) <= 3) return z;
  const at = (zz) => M * Math.pow(1 + L * S * zz, 1 / L);
  if (z > 3) {
    const sd3 = at(3), sd23 = sd3 - at(2);
    return 3 + (y - sd3) / sd23;
  }
  const sd3n = at(-3), sd23n = at(-2) - sd3n;
  return -3 - (sd3n - y) / sd23n;
}

export function valueAtZ({ L, M, S }, z) {
  if (Math.abs(L) < 1e-9) return M * Math.exp(S * z);
  return M * Math.pow(1 + L * S * z, 1 / L);
}

export const ageMonths = (ageDays) => ageDays / DAYS_PER_MONTH;

export function lmsWfa(sex, ageDays) { return interp(WHO_LMS.wfa[sexKey(sex)], ageMonths(ageDays)); }
export function lmsLhfa(sex, ageDays) {
  const m = ageMonths(ageDays);
  const t = LHFA[sexKey(sex)];
  return interp(m < 24 ? t.length : t.height, m);
}
/** Weight-for-length (<24 mo) or weight-for-height (>=24 mo), WHO convention with 0.7 cm adjustment. */
export function lmsWfh(sex, ageDays, heightCm, measuredLying) {
  const m = ageMonths(ageDays);
  if (m < 24) {
    const len = measuredLying === false ? heightCm + 0.7 : heightCm;
    return interp(WHO_LMS.wfl[sexKey(sex)], len);
  }
  const ht = measuredLying === true ? heightCm - 0.7 : heightCm;
  return interp(WHO_LMS.wfh[sexKey(sex)], ht);
}

const round2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100 + 0);

export function waz(sex, ageDays, kg) { const p = lmsWfa(sex, ageDays); return p && kg ? round2(zFromLMS(p, kg)) : null; }
export function haz(sex, ageDays, cm) { const p = lmsLhfa(sex, ageDays); return p && cm ? round2(zFromLMS(p, cm, false)) : null; }
export function whz(sex, ageDays, cm, kg, lying) { const p = lmsWfh(sex, ageDays, cm, lying); return p && cm && kg ? round2(zFromLMS(p, kg)) : null; }

/** All anthropometric indices for one measurement. */
export function indices(sex, ageDays, m) {
  return {
    waz: waz(sex, ageDays, m.weightKg),
    haz: haz(sex, ageDays, m.heightCm),
    whz: whz(sex, ageDays, m.heightCm, m.weightKg, m.lying),
  };
}

/** WHO flags for biologically implausible values (WHO Anthro, 2006 standards). */
export const BIV_LIMITS = { waz: [-6, 5], haz: [-6, 6], whz: [-5, 5] };
export function bivFlags(ix) {
  const out = [];
  for (const k of Object.keys(BIV_LIMITS)) {
    const v = ix[k];
    if (v == null) continue;
    const [lo, hi] = BIV_LIMITS[k];
    if (v < lo || v > hi) out.push(k);
  }
  return out;
}

/** Curve points for drawing a z-line on a weight-for-age chart. */
export function wfaCurve(sex, z, fromMonth = 0, toMonth = 60, step = 1) {
  const pts = [];
  for (let mo = fromMonth; mo <= toMonth + 1e-9; mo += step) {
    const p = interp(WHO_LMS.wfa[sexKey(sex)], mo);
    if (p) pts.push([mo, valueAtZ(p, z)]);
  }
  return pts;
}
