// Silent-trial metrics: Tracker baselines, truth-based lead time, rule attribution, queue capture.
import { rng, DAY, HOUR, median, quantile, round } from '../util.js';
import { lmsLhfa, lmsWfh, valueAtZ, DAYS_PER_MONTH } from '../growth.js';
import { evaluate, trackerSingleReading } from '../triage.js';
import { makeConsent, gateSignals } from '../consent.js';
import { makeTask, addClosure, allocate, escalation, addMilestone } from '../tasks.js';
import { replay } from '../bridge.js';
import { scoreFeed, scoreFeedOverTime } from '../reliability.js';
import { NOW, SIM_START } from './constants.js';

const TIER_RANK_LOCAL = { RED_A: 0, RED_B: 1, AMBER: 2, WATCH: 3, GREEN: 4 };
export function backtest(district, evalByChild, pack) {
  const leads = [], strictLeads = [], firstRule = {};
  const truthLeads = []; let truthEpisodes = 0, truthFlagged = 0, truthFlagged14 = 0;
  let samKids = 0, flaggedEarlier = 0, strictKids = 0, strictEarlier = 0;
  let alerts = 0, alertsTrue = 0;
  const perAwcMonth = new Map();
  const tierCounts = { RED_A: 0, RED_B: 0, AMBER: 0, WATCH: 0, GREEN: 0 };
  let baselineFlags = 0;
  for (const c of district.children) {
    const ev = evalByChild[c.id];
    if (!ev.results.length) continue;
    tierCounts[ev.current.tier]++;
    // first Tracker SAM listing, and first listing of any kind (MAM or SAM)
    let trackerSam = null, trackerAny = null;
    for (const v of ev.visits) {
      const f = trackerSingleReading(c, v, pack);
      if (f) baselineFlags++;
      if (f && !v.biv.length && trackerAny == null) trackerAny = v.t;
      if (f === 'SAM' && !v.biv.length) { trackerSam = v.t; break; }
    }
    // PoshanSetu alerts
    let firstAlertBeforeSam = null;
    for (const res of ev.results) {
      if ((res.tier === 'AMBER' || res.tier === 'RED_A' || res.tier === 'RED_B') && (res.kind === 'NEW' || res.kind === 'WORSENING')) {
        alerts++;
        const tr = c.truthAt(res.t), past = c.truthAt(res.t - 60 * DAY), fut = c.truthAt(Math.min(res.t + 90 * DAY, NOW));
        if (tr.whz < -2 || tr.whz - past.whz <= -0.4 || fut.whz < -3) alertsTrue++;
        const k = c.awcId + '|' + new Date(res.t).toISOString().slice(0, 7);
        if (res.tier === 'AMBER') perAwcMonth.set(k, (perAwcMonth.get(k) || 0) + 1);
        if (trackerSam && res.t < trackerSam && trackerSam - res.t <= 180 * DAY && firstAlertBeforeSam == null && res.tier === 'AMBER') firstAlertBeforeSam = res.t;
      }
    }
    // Truth-based: when did the (simulated) child really cross WHZ < -3?
    if (c.truthAt) {
      const t0 = ev.visits[0].t + 45 * DAY, t1 = ev.visits[ev.visits.length - 1].t;
      let onset = null;
      for (let t = t0; t <= t1; t += 7 * DAY) if (c.truthAt(t).whz < -3) { onset = t; break; }
      if (onset) {
        truthEpisodes++;
        const a = ev.results.find((r) => TIER_RANK_LOCAL[r.tier] <= 2 && r.t < onset && onset - r.t <= 180 * DAY);
        if (a) { truthFlagged++; const L = (onset - a.t) / DAY; truthLeads.push(L); if (L >= 14) truthFlagged14++; }
      }
    }
    if (trackerSam && trackerSam > SIM_START + 45 * DAY) {
      samKids++;
      if (firstAlertBeforeSam) {
        flaggedEarlier++; leads.push((trackerSam - firstAlertBeforeSam) / DAY);
        const first = ev.results.find((r) => r.t === firstAlertBeforeSam);
        const code = first.reasons.find((r) => r.tier === 'AMBER')?.code || 'OTHER';
        firstRule[code] = (firstRule[code] || 0) + 1;
      }
      // stricter: did a PoshanSetu AMBER come before the Tracker's FIRST listing of any kind?
      if (trackerAny && trackerAny > SIM_START + 45 * DAY) {
        strictKids++;
        const a = ev.results.find((r) => r.tier === 'AMBER' && r.t < trackerAny && trackerAny - r.t <= 180 * DAY);
        if (a) { strictEarlier++; strictLeads.push((trackerAny - a.t) / DAY); }
      }
    }
  }
  const loads = [...perAwcMonth.values()];
  return {
    samKids, flaggedEarlier, shareEarlier: samKids ? flaggedEarlier / samKids : 0,
    leadMedian: median(leads), leadP25: quantile(leads, 0.25), leadP75: quantile(leads, 0.75), leads,
    alerts, precision: alerts ? alertsTrue / alerts : 0,
    amberPerAwcMonth: { median: median(loads), p90: quantile(loads, 0.9), max: loads.length ? Math.max(...loads) : 0, overCap: loads.filter((x) => x > pack.workload.newAmberCapPerAwcPerMonth).length, cells: loads.length },
    tierCounts, baselineFlags, firstRule,
    strict: { kids: strictKids, earlier: strictEarlier, share: strictKids ? strictEarlier / strictKids : 0, leadMedian: median(strictLeads), leads: strictLeads },
    amberLoads: loads,
    queue: queueEval(district, evalByChild, pack),
    truth: { episodes: truthEpisodes, flagged: truthFlagged, flagged14: truthFlagged14, share14: truthEpisodes ? truthFlagged14 / truthEpisodes : 0, leadMedian: median(truthLeads) },
    children: district.children.length,
  };
}

/**
 * Which children get the capped visits? For every AWC-month with more new AMBER alerts than the cap,
 * compare picks under the Round 1 order (youngest first) and the risk-point order, against what really
 * happened next (simulated truth: WHZ < -3 within 120 days).
 */
export function queueEval(district, evalByChild, pack) {
  const cap = pack.workload.newAmberCapPerAwcPerMonth;
  const groups = new Map();
  for (const c of district.children) {
    if (!c.truthAt) continue;
    for (const r of evalByChild[c.id].results) {
      if (r.tier !== 'AMBER' || !(r.kind === 'NEW' || r.kind === 'WORSENING')) continue;
      let bad = false;
      for (let t = r.t; t <= r.t + 120 * DAY; t += 7 * DAY) if (c.truthAt(t).whz < -3) { bad = true; break; }
      const k = c.awcId + '|' + new Date(r.t).toISOString().slice(0, 7);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push({ age: r.visit.ageMonths, risk: r.risk?.score ?? 0, bad, t: r.t });
    }
  }
  let overCapGroups = 0, badTotal = 0, hitAge = 0, hitRisk = 0;
  for (const g of groups.values()) {
    if (g.length <= cap) continue;
    overCapGroups++;
    badTotal += g.filter((x) => x.bad).length;
    hitAge += [...g].sort((a, b) => a.age - b.age || a.t - b.t).slice(0, cap).filter((x) => x.bad).length;
    hitRisk += [...g].sort((a, b) => b.risk - a.risk || a.age - b.age || a.t - b.t).slice(0, cap).filter((x) => x.bad).length;
  }
  return { overCapGroups, badTotal, hitAge, hitRisk, captureAge: badTotal ? hitAge / badTotal : 0, captureRisk: badTotal ? hitRisk / badTotal : 0, randomExpected: null };
}

