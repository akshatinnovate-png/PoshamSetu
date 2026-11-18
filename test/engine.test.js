import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PACK, signPack, verifyPack, deepClone, diffPacks } from '../app/engine/rulepack.js';
import { evaluate } from '../app/engine/triage.js';
import { makeTask, addClosure, closureState, escalation } from '../app/engine/tasks.js';
import { scoreFeed, digitPreference } from '../app/engine/reliability.js';
import { issueToken, verifyToken, tokenPayload, validShortCode, MigrationRegistry, recoveryPlan } from '../app/engine/migration.js';
import { makeConsent, gateSignals, consentStatus } from '../app/engine/consent.js';
import { AuditLog } from '../app/engine/audit.js';
import { clockSafety, lagStats } from '../app/engine/bridge.js';
import { DAY, HOUR } from '../app/engine/util.js';

const P = DEFAULT_PACK;
const T0 = Date.UTC(2026, 0, 10, 4);
const child = (ageMonths, sex = 'F') => ({ id: 'C1', sex, dob: T0 - ageMonths * 30.4375 * DAY, awcId: 'A1', pseudoId: 'PT1', awcCode: '204105001' });
let n = 0;
const ev = (t, w, h, muac, extra = {}) => ({ id: 'e' + (++n), t, weightKg: w, heightCm: h, muacMm: muac, lying: true, ...extra });

test('Rule 3: MUAC < 115 goes straight to RED-B', () => {
  const r = evaluate(child(14), [ev(T0, 8.0, 74, 112)], [], P).current;
  assert.equal(r.tier, 'RED_B');
  assert.ok(r.reasons.some((x) => x.code === 'R3_MUAC_SAM'));
});

test('Rule 1: first MAM MUAC is WATCH + re-measure, a repeat confirms AMBER', () => {
  const c = child(20);
  const e1 = ev(T0, 9.6, 80, 121);
  const r1 = evaluate(c, [e1], [], P).current;
  assert.equal(r1.tier, 'WATCH');
  assert.ok(r1.remeasure);
  const r2 = evaluate(c, [e1, ev(T0 + 5 * DAY, 9.6, 80, 122)], [], P).current;
  assert.equal(r2.tier, 'AMBER');
});

test('oedema is RED-A with a 24 h clock', () => {
  const c = child(30);
  const r = evaluate(c, [ev(T0, 11, 88, 130, { oedema: true })], [], P).current;
  assert.equal(r.tier, 'RED_A');
  const task = makeTask({ child: c, result: r, pack: P });
  assert.equal(task.dueAt - task.measuredAt, 24 * HOUR);
});

test('Rule 2: WHZ fall >= 0.5 SD needs a re-weigh to become AMBER', () => {
  const c = child(30);
  const a = ev(T0, 12.2, 88, 140);
  const b = ev(T0 + 31 * DAY, 11.3, 88.4, 138);
  const r1 = evaluate(c, [a, b], [], P).current;
  assert.equal(r1.tier, 'WATCH');
  assert.ok(r1.reasons.some((x) => x.code === 'R2_UNCONFIRMED'));
  const r2 = evaluate(c, [a, b, ev(T0 + 36 * DAY, 11.25, 88.4, 138)], [], P).current;
  assert.equal(r2.tier, 'AMBER');
});

test('infant faltering: two low monthly gains in a row', () => {
  const c = child(5, 'M');
  const evs = [ev(T0, 6.6, 64, null), ev(T0 + 30 * DAY, 6.7, 65.5, 128), ev(T0 + 60 * DAY, 6.75, 66.5, 128)];
  const r = evaluate(c, evs, [], P).current;
  assert.equal(r.tier, 'AMBER');
  assert.ok(r.reasons.some((x) => x.code === 'INFANT_FALTERING'));
});

test('downward trend + consented diarrhoea signal = AMBER; withheld without consent', () => {
  const c = child(30);
  const evs = [ev(T0, 12.0, 88, 140), ev(T0 + 31 * DAY, 11.6, 88.3, 139)];
  const sig = [{ type: 'DIARRHOEA', t: T0 + 20 * DAY }];
  const cons = makeConsent({ id: 'CA1', childId: 'C1', guardian: 'M', mode: 'OTP', grantedAt: T0 - DAY });
  const g = gateSignals(sig, cons, T0 + 31 * DAY);
  assert.equal(g.allowed.length, 1);
  assert.equal(evaluate(c, evs, g.allowed, P).current.tier, 'AMBER');
  const none = gateSignals(sig, null, T0 + 31 * DAY);
  assert.equal(none.withheld.length, 1);
  assert.notEqual(evaluate(c, evs, none.allowed, P).current.tier, 'AMBER');
});

test('BIV reading is quarantined and never downgrades the child', () => {
  const c = child(20);
  const r = evaluate(c, [ev(T0, 8.2, 79, 112), ev(T0 + 30 * DAY, 82, 80, null)], [], P).current;
  assert.ok(r.quarantined);
  assert.equal(r.tier, 'RED_B');
});

test('joint visit closes only when AWW and ASHA both confirm, in any order', () => {
  const c = child(40);
  const res = evaluate(c, [ev(T0, 11.0, 92, 121), ev(T0 + 4 * DAY, 11.0, 92, 121)], [], P).current;
  assert.equal(res.tier, 'AMBER');
  const t = makeTask({ child: c, result: res, pack: P });
  assert.equal(closureState(t).state, 'OPEN');
  addClosure(t, { by: 'ASHA', t: T0 + 6 * DAY, dtmf: 1 }, P);
  assert.equal(closureState(t).state, 'PARTIAL');
  addClosure(t, { by: 'AWW', t: T0 + 9 * DAY, outcome: 'VISITED' }, P);
  assert.equal(closureState(t).state, 'CLOSED');
  const e = escalation(t, T0 + 30 * DAY, P);
  assert.equal(e.open, false);
});

test('escalation clock runs on measurement time; late arrival is flagged', () => {
  const c = child(30);
  const res = evaluate(c, [ev(T0, 11, 88, 130, { oedema: true })], [], P).current;
  const t = makeTask({ child: c, result: res, pack: P, ingestedAt: T0 + 30 * HOUR });
  const e = escalation(t, T0 + 31 * HOUR, P);
  assert.equal(e.level, 1);
  assert.ok(e.lateArrival);
});

test('weighted R penalises implausible values harder than the legacy formula', () => {
  const mk = (w, biv) => ({ weightKg: w, biv: biv ? ['waz'] : [], t: 0 });
  const feed = [[mk(8.1), mk(8.3), mk(82, true)], [mk(9.4), mk(9.6), mk(9.7)], [mk(7.1), mk(7.2), mk(7.4)]];
  const s = scoreFeed(feed, P);
  assert.ok(s.R < s.legacyR, `${s.R} vs ${s.legacyR}`);
});

test('digit preference is corrected for sample size', () => {
  const unbiased = Array.from({ length: 200 }, (_, i) => 5 + (i % 10) / 10);
  assert.equal(digitPreference(unbiased).index, 0);
  const heaped = Array.from({ length: 200 }, (_, i) => (i % 2 ? 5.0 : 5.5));
  assert.ok(digitPreference(heaped).index > 0.7);
});

test('transfer token verifies offline and detects tampering', async () => {
  const c = { ...child(18), id: 'C9', pseudoId: 'PT99' };
  const payload = tokenPayload(c, [], { tier: 'AMBER' }, { now: T0, validityDays: 150 });
  const tok = await issueToken(payload);
  assert.ok(validShortCode(tok.short));
  assert.equal((await verifyToken(tok.qr, T0 + DAY)).ok, true);
  const bad = tok.qr.slice(0, 10) + (tok.qr[10] === 'A' ? 'B' : 'A') + tok.qr.slice(11);
  assert.equal((await verifyToken(bad, T0 + DAY)).ok, false);
  assert.equal((await verifyToken(tok.qr, T0 + 200 * DAY)).expired, true);
  const reg = new MigrationRegistry();
  reg.register(tok, 'UIDTKN-1');
  assert.equal(reg.lookupBiometric({ match: true, uidToken: 'UIDTKN-1', modality: 'FP' }, 'AWW').tokens.length, 1);
  assert.ok(reg.lookupShort(tok.short, 'IVR'));
  assert.equal(recoveryPlan({ hasPaper: false, phoneAlive: false, network: false, awcDeviceOnline: true, fingerprintsWorn: true }).resolvedBy, 'BIO_FACE');
});

test('rule pack: dual signature, tamper detection, diff', async () => {
  const signed = await signPack(DEFAULT_PACK);
  assert.equal((await verifyPack(signed)).ok, true);
  const p2 = deepClone(DEFAULT_PACK); p2.trend.whzDropSd = 0.4;
  assert.equal((await verifyPack({ ...signed, pack: p2 })).ok, false);
  assert.deepEqual(diffPacks(DEFAULT_PACK, p2).map((d) => d.path), ['trend.whzDropSd']);
});

test('assisted consent lapses if not reconfirmed', () => {
  const c = makeConsent({ id: 'X', childId: 'C', guardian: 'G', mode: 'ASSISTED', grantedAt: T0 });
  assert.equal(consentStatus(c, T0 + 10 * DAY).state, 'ACTIVE');
  assert.equal(consentStatus(c, T0 + 40 * DAY).state, 'LAPSED');
});

test('audit chain detects edits', () => {
  const log = new AuditLog();
  log.append({ actor: 'a', role: 'AWW', action: 'VIEW', subject: 'C1' });
  log.append({ actor: 'b', role: 'CDPO', action: 'VIEW', subject: 'C2' });
  assert.equal(log.verify().ok, true);
  log.entries[0].subject = 'C3';
  assert.equal(log.verify().ok, false);
});

test('batch exports are never clock-safe for RED-A', () => {
  const s = lagStats([3 * DAY, 4 * DAY, 6 * DAY]);
  assert.equal(clockSafety(s, P).RED_A.safe, false);
  assert.equal(clockSafety(lagStats([10 * 60000, 20 * 60000]), P).RED_A.safe, true);
});

test('Rule 2 (sustained): two monthly falls adding to 0.5 SD become AMBER without a re-weigh', () => {
  const c = child(30);
  const evs = [ev(T0, 12.4, 88, 142), ev(T0 + 30 * DAY, 12.1, 88.3, 140), ev(T0 + 60 * DAY, 11.8, 88.6, 138)];
  const r = evaluate(c, evs, [], P).current;
  assert.equal(r.tier, 'AMBER', JSON.stringify(r.reasons));
  assert.ok(r.reasons.some((x) => x.code === 'R2_SUSTAINED'));
});

test('RED-B closes only with appetite test and MO screening on record', () => {
  const c = child(14);
  const res = evaluate(c, [ev(T0, 8.0, 74, 112)], [], P).current;
  const t = makeTask({ child: c, result: res, pack: P });
  addClosure(t, { by: 'AWW', t: T0 + HOUR, outcome: 'VISITED' }, P);
  addClosure(t, { by: 'ASHA', t: T0 + 2 * HOUR, dtmf: 1 }, P);
  assert.equal(closureState(t).state, 'PARTIAL');
  assert.deepEqual(closureState(t).missing, ['APPETITE_TEST', 'MO_SCREEN']);
  t.milestones.push({ kind: 'APPETITE_TEST', t: T0 + 3 * HOUR, result: 'PASS' }, { kind: 'MO_SCREEN', t: T0 + 3 * DAY, result: 'SCREENED' });
  assert.equal(closureState(t).state, 'CLOSED');
});
