// Impact SCENARIO (assumption-driven, not a result): if acting on an early alert lifts WHZ by
// `effect` SD per month for up to `months` months, with a share `compliance` of alerts acted on,
// how many SAM episodes in the synthetic district would be averted?
import { DAY } from './util.js';
import { trackerSingleReading } from './triage.js';

const hash01 = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };

export function impactScenario(children, pack, { effect = 0.15, months = 3, compliance = 0.8, from, to } = {}) {
  let samKids = 0, flagged = 0, acted = 0, averted = 0;
  for (const c of children) {
    const ev = c.eval;
    if (!ev || !c.truthAt || !ev.visits.length) continue;
    // TRUE SAM episode: first week the simulated true WHZ falls below -3 (not a noisy listing).
    const t0 = Math.max(from ?? ev.visits[0].t, ev.visits[0].t), t1 = to ?? ev.visits[ev.visits.length - 1].t;
    let samT = null;
    for (let t = t0 + 45 * DAY; t <= t1; t += 7 * DAY) if (c.truthAt(t).whz < -3) { samT = t; break; }
    if (!samT) continue;
    samKids++;
    const alert = ev.results.find((r) => r.tier === 'AMBER' && r.t < samT && samT - r.t <= 180 * DAY);
    if (!alert) continue;
    flagged++;
    if (hash01(c.id) >= compliance) continue;
    acted++;
    let ok = true;
    for (let t = alert.t; t <= samT + 60 * DAY; t += 7 * DAY) {
      const m = Math.min(months, (t - alert.t) / (30.4375 * DAY));
      if (c.truthAt(t).whz + effect * m < -3) { ok = false; break; }
    }
    if (ok) averted++;
  }
  return { samKids, flagged, acted, averted, share: samKids ? averted / samKids : 0 };
}
