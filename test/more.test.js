import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PACK } from '../app/engine/rulepack.js';
import { allocate, makeTask } from '../app/engine/tasks.js';
import { EventStore, routeFor } from '../app/engine/bridge.js';
import { routeAggregates, ltfu, validShortCode } from '../app/engine/migration.js';
import { kAnon, displayName } from '../app/engine/access.js';
import { scoreFeed } from '../app/engine/reliability.js';
import { waz, whz, DAYS_PER_MONTH } from '../app/engine/growth.js';
import { generate } from '../app/engine/simulate.js';
import { DAY } from '../app/engine/util.js';

const P = DEFAULT_PACK;
const T0 = Date.UTC(2026, 5, 3, 4);

test('WAZ is monotonic in weight', () => {
  const zs = [6, 7, 8, 9, 10].map((w) => waz('F', 14 * DAYS_PER_MONTH, w));
  for (let i = 1; i < zs.length; i++) assert.ok(zs[i] > zs[i - 1]);
});

test('WHZ switches tables at 24 months without a large jump', () => {
  const a = whz('M', 23.9 * DAYS_PER_MONTH, 85, 11, false);
  const b = whz('M', 24.1 * DAYS_PER_MONTH, 85, 11, false);
  assert.ok(Math.abs(a - b) < 0.3, `${a} vs ${b}`);
});

test('visit cap: only 2 new AMBER per AWC per month, the rest queued youngest-first', () => {
  const mk = (i, age) => ({ id: 't' + i, awcId: 'A', tier: 'AMBER', kind: 'NEW', measuredAt: T0 + i * DAY, ageMonths: age, required: ['AWW', 'ASHA'], dueAt: 0 });
  const ts = [mk(1, 40), mk(2, 10), mk(3, 25), mk(4, 50)];
  allocate(ts, null, P, (t) => new Date(t).toISOString().slice(0, 7));
  const kept = ts.filter((t) => !t.queued).map((t) => t.id).sort();
  assert.deepEqual(kept, ['t2', 't3']);
  assert.ok(ts.filter((t) => t.queued).every((t) => t.dueAt - t.measuredAt === P.workload.queuedEscalateDay * DAY));
});

test('event store is idempotent and detects out-of-order arrivals', () => {
  const st = new EventStore();
  const e = { childId: 'C', awcId: 'A', t: T0 + 5 * DAY, weightKg: 9.1, heightCm: 80 };
  assert.ok(st.append(e, T0 + 5 * DAY, 'API_SETU').accepted);
  assert.ok(st.append({ ...e }, T0 + 6 * DAY, 'SMS_FLASH').duplicate);
  st.append({ ...e, t: T0, weightKg: 9.0 }, T0 + 7 * DAY, 'API_SETU');
  assert.equal(st.late.length, 1);
});

test('RED signs route over SMS flash as well as the API', () => {
  assert.deepEqual(routeFor({ oedema: true }, 'ROUND2'), ['SMS_FLASH', 'API_SETU']);
  assert.deepEqual(routeFor({ muacMm: 130 }, 'ROUND2'), ['API_SETU']);
  assert.deepEqual(routeFor({ oedema: true }, 'ROUND1'), ['BATCH_EXPORT']);
});

test('k-anonymity above block only', () => {
  assert.equal(kAnon(7, 'DPO'), '<20');
  assert.equal(kAnon(7, 'CDPO'), '7');
  assert.equal(kAnon(0, 'DPO'), '0');
  const agg = routeAggregates([...Array(25)].map(() => ({ fromBlock: 'A', destination: 'X' })).concat([{ fromBlock: 'A', destination: 'Y' }]), 20);
  assert.equal(agg.find((a) => a.to === 'Y').shown, '<20');
  assert.equal(agg.find((a) => a.to === 'X').shown, '25');
});

test('names are masked for supervisors', () => {
  const c = { id: 'C1', name: 'Somari Hembrom', pseudoId: 'PT204100001234' };
  assert.equal(displayName(c, 'AWW'), 'Somari Hembrom');
  assert.equal(displayName(c, 'CDPO'), 'PT··1234');
  assert.equal(displayName(c, 'CDPO', new Set(['C1'])), 'Somari Hembrom');
});

test('lost to follow-up after 45 days', () => {
  assert.equal(ltfu(T0, T0 + 44 * DAY, P), false);
  assert.equal(ltfu(T0, T0 + 45 * DAY, P), true);
});

test('short codes reject a single mis-heard character', () => {
  assert.equal(validShortCode('0000-0000-0X'), validShortCode('0000-0000-0X'));
  let rejected = 0;
  const base = 'K7Q2M9TB4';
  const ALPH = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let good = null;
  for (const c of ALPH) if (validShortCode(base + c)) good = c;
  assert.ok(good);
  for (const c of ALPH) if (c !== base[3] && !validShortCode(base.slice(0, 3) + c + base.slice(4) + good)) rejected++;
  assert.ok(rejected >= 28, String(rejected));
});

test('digit preference does not enter R until chronic', () => {
  const heaped = [[...Array(60)].map((_, i) => ({ weightKg: 8 + (i % 6) * 0.5, biv: [], t: 0 }))];
  const now = scoreFeed(heaped, P, []);
  const chronic = scoreFeed(heaped, P, [0.6, 0.6]);
  assert.equal(now.chronic, false);
  assert.equal(chronic.chronic, true);
  assert.ok(chronic.R < now.R);
});

test('simulation is deterministic and meets the Table 5 hypotheses on synthetic data', () => {
  const a = generate({ pack: P, seed: 71100 }).metrics, b = generate({ pack: P, seed: 71100 }).metrics;
  assert.equal(a.alerts, b.alerts);
  assert.ok(a.shareEarlier >= 0.5, String(a.shareEarlier));
  assert.ok(a.leadMedian >= 30, String(a.leadMedian));
});

test('queued AMBER escalates to the Mukhya Sevika at day 10, not day 7', async () => {
  const { escalation } = await import('../app/engine/tasks.js');
  const t = { tier: 'AMBER', measuredAt: T0, ingestedAt: T0, dueAt: T0 + 10 * DAY, required: ['AWW'], closures: [], queued: true };
  assert.equal(escalation(t, T0 + 8 * DAY, P).level, 0);
  assert.equal(escalation(t, T0 + 10 * DAY + 1, P).level, 1);
  const u = { ...t, queued: false, dueAt: T0 + 7 * DAY };
  assert.equal(escalation(u, T0 + 8 * DAY, P).level, 1);
});

test('evidence pack verifier accepts a genuine pack and rejects a tampered one', async () => {
  const { signPack } = await import('../app/engine/rulepack.js');
  const { AuditLog } = await import('../app/engine/audit.js');
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path'); const { execFileSync } = await import('node:child_process');
  const log = new AuditLog(); log.append({ actor: 'x', role: 'AWW', action: 'VIEW', subject: 'C1' });
  const ev = { rulePack: await signPack(P), audit: { entries: log.entries }, backtest: { shareEarlier: 0.7, leadMedianDays: 80, precision: 0.6, seed: 1 } };
  const f = path.join(os.tmpdir(), `ev-${process.pid}.json`);
  fs.writeFileSync(f, JSON.stringify(ev));
  execFileSync(process.execPath, ['scripts/verify-evidence.mjs', f]);
  ev.rulePack.pack = { ...ev.rulePack.pack, version: '9.9.9' };
  fs.writeFileSync(f, JSON.stringify(ev));
  assert.throws(() => execFileSync(process.execPath, ['scripts/verify-evidence.mjs', f], { stdio: 'pipe' }));
});

test('impact scenario: no effect averts (almost) nothing; more effect averts more', async () => {
  const { impactScenario } = await import('../app/engine/impact.js');
  const S = generate({ pack: P, seed: 71100 });
  const z = impactScenario(S.district.children, P, { effect: 0 }), a = impactScenario(S.district.children, P, { effect: 0.1 }), b = impactScenario(S.district.children, P, { effect: 0.25 });
  assert.ok(z.averted <= 0.05 * z.samKids, String(z.averted));
  assert.ok(a.averted > z.averted && b.averted > a.averted);
});
