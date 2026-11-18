// Versioned, jointly-signed rule pack. Every threshold the engine uses lives here,
// so a calibration change in Phase 1 is a new signed pack, never a code change.
import { signDoc, verifyDoc } from './signing.js';
import { canonical, sha256 } from './util.js';

export const TIERS = ['RED_A', 'RED_B', 'AMBER', 'WATCH', 'GREEN'];
export const TIER_LABEL = { RED_A: 'RED-A', RED_B: 'RED-B', AMBER: 'AMBER', WATCH: 'WATCH', GREEN: 'ON TRACK' };
export const TIER_RANK = { RED_A: 0, RED_B: 1, AMBER: 2, WATCH: 3, GREEN: 4 };

export const DEFAULT_PACK = Object.freeze({
  id: 'PS-RP-JH-WSB',
  version: '2.0.0',
  title: 'Paschimi Singhbhum pilot rule pack',
  effectiveFrom: '2026-12-01',
  owners: ['MoWCD', 'MoHFW'],
  supersedes: '1.0.0',
  changelog: [
    'R-score: equal weights replaced by risk-weighted coefficients; digit preference counts only when chronic (audit item 4).',
    'Joint visit: sequential AWW + ASHA closure within the window; task closes only when both confirm (audit item 2).',
    'Escalation clock runs on measurement time, not ingestion time; late-arriving events escalate on arrival (audit item 1).',
    'Migration: biometric (Aadhaar eKYC) and IVR short-code fallbacks added to the transfer token (audit item 3).',
  ],
  anthropometry: {
    muacSamMm: 115, muacMamMm: 125, muacMinAgeMonths: 6,
    whzSam: -3, whzMam: -2,
    sameDayToleranceKg: 0.1, sameDayToleranceCm: 0.7,
  },
  trend: {
    whzDropSd: 0.5,
    sustainedDropSd: 0.5,
    wazLines: [-1, -2, -3],
    confirmWindowDays: 14,
    watchRepeatsToAmber: 2,
    signalTrendDropSd: 0.25,
    episodeDays: 60,
  },
  infantVelocity: {
    maxAgeMonths: 12,
    consecutiveLow: 2,
    // Approximate 15th centile of 1-month weight increments (g), derived from the WHO
    // 2009 velocity standards. PROTOTYPE VALUES: Phase 1 swaps in the official table.
    p15g: {
      M: [880, 800, 540, 380, 280, 200, 140, 100, 70, 50, 40, 30],
      F: [790, 680, 470, 330, 240, 170, 120, 85, 60, 45, 35, 25],
    },
  },
  // muacTrend is implemented but OFF: in the backtest it bought ~1 pt of strict lift for ~3 pts of precision.
  rules: { velocityOfficial: true, velocity2m: true, muacTrend: false, weakSignals: true, forecast: true },
  forecast: { horizonDays: 60, line: -2, minProb: 0.5, minReadings: 3, measSd: 0.22, levelSd: 0.12, slopeSd: 0.08 },
  velocity: { zCut: -1.04, source: 'WHO 2009 weight-velocity standards (official LMS tables)' },
  muacTrend: { totalDropMm: 6, minMm: 125 },
  risk: {
    amberAt: 7,
    points: { whzNearMam: 2, whzLow: 1, whzFall: 1, whzFallBig: 2, muacLow: 1, muacFall: 1, velocityLow: 2, signal: 1, lbw: 1, under2: 1, priorEpisode: 1, leanSeason: 1, returnedMigrant: 1 },
  },
  signals: {
    windowDays: 30,
    allowed: ['VACCINE_OVERDUE', 'DIARRHOEA', 'LBW', 'HIGH_RISK_PREGNANCY'],
  },
  tiers: {
    RED_A: { deadlineHours: 24, action: 'Same-day referral to PHC or NRC; Mukhya Sevika told at once' },
    RED_B: { appetiteTestHours: 72, screeningDays: 5, action: 'Managed at AWC under CMAM 2023; MO screens at PHC; ASHA follows up' },
    AMBER: { deadlineDays: 7, action: 'SSBSK at-risk visit (<36 mo) or joint AWW + ASHA visit (36-59 mo); ration review' },
    WATCH: { deadlineDays: 14, action: 'Counselling and re-measurement; two WATCH in a row become AMBER' },
  },
  workload: { newAmberCapPerAwcPerMonth: 2, queuedEscalateDay: 10, ranking: 'risk' },
  jointVisit: {
    windowDays: 7,
    requireBoth: true,
    // ASHA closes by IVR keypress; AWW by app flag. Closure needs both, in any order.
    dtmf: { 1: 'VISITED', 2: 'REFERRED', 3: 'REFUSED', 4: 'MIGRATED' },
  },
  escalation: [
    { level: 0, role: 'AWW_ASHA', label: 'AWW + ASHA', cadence: 'Daily, offline' },
    { level: 1, role: 'MUKHYA_SEVIKA', label: 'Mukhya Sevika', cadence: 'Weekly; RED-A at once',
      when: { RED_A: { hours: 24 }, RED_B: { hours: 72 }, AMBER: { days: 7 }, WATCH: { days: 14 } } },
    { level: 2, role: 'CDPO_BMO', label: 'CDPO + Block MO', cadence: 'Weekly',
      when: { RED_A: { hours: 48 }, RED_B: { days: 5 }, AMBER: { days: 10 }, WATCH: { days: 28 } } },
    { level: 3, role: 'DPO_CMO', label: 'DPO (ICDS) + CMO', cadence: 'Monthly convergence',
      when: { RED_A: { days: 7 }, RED_B: { days: 7 }, AMBER: { days: 14 } } },
  ],
  reliability: {
    // R = 100 x (1 - min(1, wB*B + wF*F + wD*D*chronic)).
    weights: { B: 4.0, F: 1.0, D: 0.3 },
    legacyEqualWeights: true,
    dChronicMonths: 3,
    dAuditThreshold: 0.2,
    flatRunLength: 3,
    cutoff: 85,
    quarantineBiv: true,
  },
  bridge: {
    // An adapter is "clock-safe" for a tier if its p95 lag is under this share of the deadline.
    maxLagShareOfDeadline: 0.1,
  },
  migration: { ltfuDays: 45, tokenValidityDays: 150 },
  privacy: { kAnonMin: 20, aboveBlockSuppression: true },
});

export function packHash(pack) { return sha256(canonical(pack)).slice(0, 12); }

/** Joint signature by both ministries. */
export async function signPack(pack) {
  return { pack, signatures: [await signDoc('MoWCD', pack), await signDoc('MoHFW', pack)] };
}
export async function verifyPack(signed) {
  const results = await Promise.all(signed.signatures.map((s) => verifyDoc(signed.pack, s)));
  const owners = signed.pack.owners || [];
  const ok = owners.every((o) => results.some((r) => r.signer === o && r.ok));
  return { ok, results };
}

/** Field-level diff between two packs, for the rule pack window. */
export function diffPacks(a, b, prefix = '') {
  const out = [];
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const p = prefix ? `${prefix}.${k}` : k;
    const va = a?.[k], vb = b?.[k];
    if (va && vb && typeof va === 'object' && typeof vb === 'object' && !Array.isArray(va)) out.push(...diffPacks(va, vb, p));
    else if (canonical(va) !== canonical(vb)) out.push({ path: p, from: va, to: vb });
  }
  return out;
}

export function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
export function setPath(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
  return obj;
}
