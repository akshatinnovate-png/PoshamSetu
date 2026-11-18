// Run the engine over the district: reliability, live tasks, bridge replay, frontline behaviour.
import { rng, DAY, HOUR, median, quantile, round } from '../util.js';
import { lmsLhfa, lmsWfh, valueAtZ, DAYS_PER_MONTH } from '../growth.js';
import { evaluate, trackerSingleReading } from '../triage.js';
import { makeConsent, gateSignals } from '../consent.js';
import { makeTask, addClosure, allocate, escalation, addMilestone } from '../tasks.js';
import { replay } from '../bridge.js';
import { scoreFeed, scoreFeedOverTime } from '../reliability.js';
import { NOW, LIVE_FROM } from './constants.js';
import { backtest } from './metrics.js';

export function analyse(district, r, pack) {
  const awcById = Object.fromEntries(district.awcs.map((a) => [a.id, a]));
  // Reliability per AWC (month by month, so chronic digit preference is visible).
  const feeds = {};
  const visitsByAwc = {};
  const evalByChild = {};
  for (const c of district.children) {
    const ev = evaluate(c, c.events, c.signals, pack);
    evalByChild[c.id] = ev;
    (visitsByAwc[c.awcId] ||= []).push(ev.visits);
  }
  for (const a of district.awcs) {
    const vs = visitsByAwc[a.id] || [];
    const monthly = scoreFeedOverTime(vs, pack, district.months.slice(0, 12));
    const overall = scoreFeed(vs.map((x) => x.filter((v) => v.t >= NOW - 90 * DAY)), pack, monthly.slice(-4, -1).map((m) => m.D));
    feeds[a.id] = { ...overall, monthly };
  }
  // Re-evaluate with feed reliability (alerts from unreliable feeds re-measure first).
  for (const c of district.children) {
    const ev = evaluate(c, c.events, c.signals, pack, { feedR: feeds[c.awcId].R });
    evalByChild[c.id] = ev;
    c.eval = ev;
    c.current = ev.current;
    c.lastMeasuredAt = ev.lastValid ? ev.lastValid.t : null;
  }

  const metrics = backtest(district, evalByChild, pack);

  // ---- Live period: tasks from alerts since LIVE_FROM, ingested through the bridge ----
  const liveEvents = district.history.events.filter((e) => e.t >= LIVE_FROM - 20 * DAY);
  const rr = rng(4242);
  const bridgeR2 = replay(liveEvents, 'ROUND2', rr);
  const bridgeR1 = replay(liveEvents, 'ROUND1', rng(4243));
  const bridgeFB = replay(liveEvents, 'FALLBACK', rng(4244));
  const arrivalById = Object.fromEntries(bridgeR2.arrivals.map((a) => [a.id, a]));
  for (const e of district.history.events) {
    const a = arrivalById[e.id];
    e.receivedAt = a ? a.receivedAt : e.t + 2 * HOUR;
    e.adapter = a ? a.adapter : 'API_SETU';
  }
  const tasks = [];
  const evById = new Map(district.history.events.map((e) => [e.id, e]));
  for (const c of district.children) {
    for (const res of c.eval.results) {
      if (res.t < LIVE_FROM || res.tier === 'GREEN') continue;
      if (!(res.kind === 'NEW' || res.kind === 'WORSENING' || (res.tier === 'WATCH' && res.remeasure))) continue;
      const receivedAt = Math.max(...res.visit.eventIds.map((id) => (evById.get(id) || {}).receivedAt || res.t));
      if (receivedAt > NOW) continue;
      tasks.push(makeTask({ child: c, result: res, pack, ingestedAt: receivedAt, id: `T-${c.id.slice(1)}-${tasks.length.toString(36).toUpperCase()}` }));
    }
  }
  const monthOf = (t) => new Date(t).toISOString().slice(0, 7);
  allocate(tasks, null, pack, monthOf);
  // simulate frontline behaviour on those tasks
  for (const t of tasks) {
    const awc = awcById[t.awcId];
    const diligence = awc.quality === 'good' ? 0.9 : awc.quality === 'sloppy' ? 0.6 : 0.78;
    const base = Math.max(t.measuredAt, t.ingestedAt);
    const window = t.dueAt - t.measuredAt;
    const roles = t.required.flatMap((x) => x.split('|').slice(0, 1));
    for (const role of roles) {
      if (!rr.chance(role === 'ASHA' ? diligence - 0.08 : diligence)) continue;
      const at = base + rr() * window * (rr.chance(0.8) ? 0.9 : 1.6);
      if (at > NOW) continue;
      const out = rr.chance(0.9) ? (t.tier === 'RED_A' ? 'REFERRED' : 'VISITED') : rr.chance(0.5) ? 'REFUSED' : 'MIGRATED';
      if (role === 'ASHA') addClosure(t, { by: 'ASHA', t: at, dtmf: { VISITED: 1, REFERRED: 2, REFUSED: 3, MIGRATED: 4 }[out] }, pack);
      else addClosure(t, { by: 'AWW', t: at, outcome: out, channel: 'APP' }, pack);
    }
    // Escalation works: a supervisor nudge closes most remaining tasks late.
    for (const role of roles) {
      if (t.closures.some((c) => c.by === role)) continue;
      if (!rr.chance(0.72)) continue;
      const at = t.dueAt + rr() * 9 * DAY;
      if (at > NOW) continue;
      if (role === 'ASHA') addClosure(t, { by: 'ASHA', t: at, dtmf: t.tier === 'RED_A' ? 2 : 1 }, pack);
      else addClosure(t, { by: 'AWW', t: at, outcome: t.tier === 'RED_A' ? 'REFERRED' : 'VISITED', channel: 'APP' }, pack);
    }
    if (t.tier === 'RED_B' && rr.chance(diligence)) {
      const at = t.measuredAt + rr() * 96 * HOUR;
      if (at < NOW) addMilestone(t, { kind: 'APPETITE_TEST', t: at, result: rr.chance(0.85) ? 'PASS' : 'FAIL' });
      const mo = t.measuredAt + (2 + rr() * 5) * DAY;
      if (mo < NOW && rr.chance(diligence)) addMilestone(t, { kind: 'MO_SCREEN', t: mo, result: 'SCREENED' });
    }
  }
  const escal = tasks.map((t) => ({ task: t, esc: escalation(t, NOW, pack) }));

  return {
    pack, district, awcById, feeds, metrics, tasks, escal,
    bridge: { round2: bridgeR2, round1: bridgeR1, fallback: bridgeFB, liveEvents: liveEvents.length },
    now: NOW,
  };
}

/** Silent-trial backtest: PoshanSetu vs the Tracker's single-reading lists. */
