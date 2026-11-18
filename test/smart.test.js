import test from 'node:test';
import assert from 'node:assert/strict';
import { kalmanTrend, forecastCross } from '../app/engine/forecast.js';
import { riskPoints } from '../app/engine/risk.js';
import { evaluate } from '../app/engine/triage.js';
import { DEFAULT_PACK as P, deepClone } from '../app/engine/rulepack.js';
import { DAY } from '../app/engine/util.js';
import { valueAtZ, lmsWfh } from '../app/engine/growth.js';

const M = 30.4375 * DAY, T0 = Date.UTC(2026, 0, 5);

test('Kalman forecast: a steady decline predicts crossing; a flat noisy series does not', () => {
  const down = kalmanTrend([-1.0, -1.25, -1.5, -1.75].map((z, i) => ({ t: T0 + i * M, z })));
  const f = forecastCross(down, -2, 60);
  assert.ok(down.slope < -0.15, String(down.slope));
  assert.ok(f.prob > 0.5 && f.crossInDays > 0 && f.crossInDays < 120, JSON.stringify(f));
  const flat = kalmanTrend([-1.0, -1.2, -0.9, -1.1].map((z, i) => ({ t: T0 + i * M, z })));
  assert.ok(forecastCross(flat, -2, 60).prob < 0.2);
});

test('FORECAST rule fires before the child is MAM, and says when', () => {
  const pack = deepClone(P); pack.rules.weakSignals = false;
  const c = { id: 'K', sex: 'F', dob: T0 - 30 * M, awcId: 'A' };
  // WHZ -1.0 -> -1.75 over three months (weights generated from target z on the WHO table)
  const zs = [-1.0, -1.25, -1.5, -1.75];
  const evs = zs.map((z, i) => { const ad = (30 + i) * 30.4375, h = 88 + i * 0.3; return { id: 'e' + i, t: T0 + i * M, weightKg: Math.round(valueAtZ(lmsWfh('F', ad, h, false), z) * 100) / 100, heightCm: h, muacMm: 140 - i, lying: false }; });
  const r = evaluate(c, evs, [], pack).current;
  assert.ok(r.visit.ix.whz > -2, `still above MAM (${r.visit.ix.whz})`);
  assert.equal(r.tier, 'AMBER', JSON.stringify(r.reasons));
  assert.ok(r.reasons.some((x) => x.code === 'FORECAST' && /around \d{4}-\d{2}-\d{2}/.test(x.text)));
});

test('risk points are named and additive', () => {
  const v = { ix: { whz: -1.8 }, muacMm: 127, ageMonths: 14, t: Date.UTC(2026, 6, 1) };
  const ref = { ix: { whz: -1.3 }, muacMm: 131 };
  const r = riskPoints({ child: { lbw: false }, visit: v, ref, velocity: { z: -1.5, grams: 120, interval: '13-15 mo' }, signals: [{ type: 'DIARRHOEA', t: v.t - 5 * DAY }], priorEpisodes: 0, pack: P });
  const codes = r.factors.map((f) => f.code);
  for (const c of ['WHZ_NEAR_MAM', 'WHZ_FALL_BIG', 'MUAC_LOW', 'MUAC_FALL', 'VELOCITY_LOW', 'SIGNAL', 'UNDER_2', 'LEAN_SEASON']) assert.ok(codes.includes(c), c);
  assert.equal(r.score, r.factors.reduce((s, f) => s + f.points, 0));
});

test('risk-ranked queue sends more capped visits to children who really become SAM than youngest-first', async () => {
  const { generate } = await import('../app/engine/simulate.js');
  let age = 0, risk = 0;
  for (const seed of [71100, 2202]) { const q = generate({ pack: P, seed }).metrics.queue; age += q.hitAge; risk += q.hitRisk; }
  assert.ok(risk > age, `risk ${risk} vs age ${age}`);
});
