// Twelve months of latent growth, migration, consent, health signals and measurements
// (with engine-in-the-loop re-measures and AWC data-quality personalities).
import { rng, DAY, HOUR, median, quantile, round } from '../util.js';
import { lmsLhfa, lmsWfh, valueAtZ, DAYS_PER_MONTH } from '../growth.js';
import { evaluate, trackerSingleReading } from '../triage.js';
import { makeConsent, gateSignals } from '../consent.js';
import { makeTask, addClosure, allocate, escalation, addMilestone } from '../tasks.js';
import { replay } from '../bridge.js';
import { scoreFeed, scoreFeedOverTime } from '../reliability.js';
import { NOW, SIM_START, DESTINATIONS, VACCINES } from './constants.js';
import { analyse } from './analyse.js';


/** Truth model helpers. */
function heightAt(sex, ageDays, haz) { const p = lmsLhfa(sex, ageDays); return p ? valueAtZ(p, haz) : null; }
function weightAt(sex, ageDays, h, whz) { const p = lmsWfh(sex, ageDays, h, ageDays / DAYS_PER_MONTH < 24); return p ? valueAtZ(p, whz) : null; }
function muacAt(ageMo, whz) { return 140 + 0.25 * (ageMo - 12) + 9.5 * whz; }

export function simulateHistory(district, r, pack) {
  const awcById = Object.fromEntries(district.awcs.map((a) => [a.id, a]));
  const months = [];
  for (let m = 0; m <= 12; m++) months.push(Date.UTC(2025, 10 + m, 1));
  const out = { events: [], signals: [], consents: [], migrations: [], vaccines: [] };
  let evSeq = 0;

  for (const c of district.children) {
    const awc = awcById[c.awcId];
    // --- monthly latent trajectory ---
    const traj = []; // per month index: {whz, haz, away, diarrhoea}
    let whz = c.truth.whz0, haz = c.truth.haz0;
    const falter = r.chance(0.14) ? { start: r.int(1, 11), len: r.int(3, 5), rate: 0.2 + r() * 0.22 } : null;
    // migration
    let mig = null;
    if (r.chance(awc.migrationPropensity)) {
      const dep = r.int(0, 2) + (r.chance(0.5) ? 0 : 12); // Nov-Jan of 2025 season, or 2026 season
      const depMonth = dep >= 12 ? 12 : dep;
      const len = r.int(4, 6);
      const dest = r.pick(DESTINATIONS);
      mig = { depMonth, retMonth: depMonth + len, dest, announced: r.chance(0.55), measuredAtDest: false };
      if (depMonth >= 12) mig.retMonth = 99;
    }
    for (let m = 0; m <= 12; m++) {
      const cal = new Date(months[m]).getUTCMonth(); // 0=Jan
      const season = cal >= 5 && cal <= 8 ? -0.12 : cal === 9 || cal === 10 ? 0.05 : 0;
      const away = mig && m >= mig.depMonth && m < mig.retMonth;
      let shock = 0, diarrhoea = false;
      if (r.chance(0.06 * (season < 0 ? 1.8 : 1) * (away ? 1.5 : 1))) { shock = -(0.3 + r() * 0.6); diarrhoea = true; }
      const fal = falter && m >= falter.start && m < falter.start + falter.len ? -falter.rate : 0;
      if (m > 0) whz = whz + 0.25 * (c.truth.mu - whz) + season + shock + fal + (away ? -0.08 : 0) + r.normal(0, 0.16);
      haz += -0.015 + r.normal(0, 0.03);
      traj.push({ whz, haz, away, diarrhoea });
    }
    const truthAt = (t) => {
      const mf = (t - months[0]) / (30.4375 * DAY);
      const i = Math.max(0, Math.min(11, Math.floor(mf)));
      const f = Math.max(0, Math.min(1, mf - i));
      const a = traj[i], b = traj[i + 1] || a;
      return { whz: a.whz + (b.whz - a.whz) * f, haz: a.haz + (b.haz - a.haz) * f, away: a.away };
    };
    c.truthAt = truthAt;
    c.migration = mig ? { ...mig, depAt: months[Math.min(mig.depMonth, 12)] + r.int(3, 20) * DAY, retAt: mig.retMonth <= 12 ? months[mig.retMonth] + r.int(1, 15) * DAY : null, destination: mig.dest } : null;
    if (c.migration) out.migrations.push({ childId: c.id, fromBlock: awc.blockId, ...c.migration, destination: mig.dest.id });

    // --- consent ---
    const cr = r();
    if (cr < 0.82) {
      const mode = c.abha && r.chance(0.7) ? 'ABHA' : c.phone && r.chance(0.6) ? 'OTP' : 'ASSISTED';
      const grantedAt = SIM_START + r.int(0, 60) * DAY;
      const cons = makeConsent({ id: `CA-${c.id}`, childId: c.id, guardian: c.mother, mode, grantedAt, days: 540 });
      if (mode === 'ASSISTED' && r.chance(0.7)) cons.reconfirmedAt = grantedAt + r.int(10, 28) * DAY;
      if (r.chance(0.015)) cons.revokedAt = grantedAt + r.int(60, 300) * DAY;
      c.consent = cons; out.consents.push(cons);
    }

    // --- signals: diarrhoea + vaccines ---
    const sigs = [];
    traj.forEach((p, m) => { if (p.diarrhoea && r.chance(0.6)) sigs.push({ type: 'DIARRHOEA', t: months[m] + r.int(0, 25) * DAY, source: r.chance(0.5) ? 'ASHA' : 'HMIS' }); });
    const missP = mig ? 0.3 : 0.12;
    for (const [ag, dueDay] of VACCINES) {
      const due = c.dob + dueDay * DAY;
      if (due < SIM_START - 60 * DAY || due > NOW) continue;
      const missed = r.chance(missP);
      const given = missed ? (r.chance(0.5) ? due + r.int(35, 120) * DAY : null) : due + r.int(0, 20) * DAY;
      out.vaccines.push({ childId: c.id, antigen: ag, due, given });
      if (!given || given - due > 28 * DAY) sigs.push({ type: 'VACCINE_OVERDUE', t: due + 28 * DAY, antigen: ag, source: 'U-WIN' });
    }
    if (c.lbw) sigs.push({ type: 'LBW', t: c.dob, source: 'RCH' });
    c.signalsRaw = sigs;
    out.signals.push(...sigs.map((s) => ({ ...s, childId: c.id })));

    // --- measurements (growth day + engine-requested re-measures) ---
    const evs = [];
    const gated = gateSignals(sigs, c.consent, NOW);
    c.signals = gated.allowed; c.signalsWithheld = gated.withheld;
    let lastW = null;
    const measure = (t, remeasure) => {
      const ageDays = (t - c.dob) / DAY;
      if (ageDays < 0 || ageDays >= 60 * DAYS_PER_MONTH) return null;
      const tr = truthAt(t);
      const ageMo = ageDays / DAYS_PER_MONTH;
      const hTrue = heightAt(c.sex, ageDays, tr.haz);
      const wTrue = hTrue ? weightAt(c.sex, ageDays, hTrue, tr.whz) : null;
      if (!hTrue || !wTrue) return null;
      const sloppy = awc.quality === 'sloppy';
      let w = Math.round((wTrue + r.normal(0, sloppy ? 0.15 : 0.05)) * 10) / 10;
      let h = Math.round((hTrue + r.normal(0, 0.6)) * 10) / 10;
      if (awc.quality === 'heaping' && r.chance(0.55)) w = Math.round(w * 2) / 2;
      if (awc.quality === 'copyforward' && lastW != null && !remeasure && r.chance(0.35)) w = lastW;
      if (sloppy && r.chance(0.03)) w = Math.round(w * 10 * 10) / 10; // decimal slip
      if (r.chance(0.0015)) { const tmp = w; w = h; h = tmp; } // swapped fields
      lastW = w;
      const muacTrue = muacAt(ageMo, tr.whz);
      const muac = ageMo >= 6 && r.chance(0.85) ? Math.round(muacTrue + r.normal(0, 3)) : null;
      const sevSam = tr.whz < -3.3;
      const e = {
        id: `E${(++evSeq).toString(36).toUpperCase()}`, childId: c.id, awcId: c.awcId, t,
        weightKg: w, heightCm: h, lying: ageMo < 24, muacMm: muac,
        oedema: sevSam && r.chance(0.04),
        danger: sevSam && r.chance(0.22) ? [r.pick(['VOMITING', 'LETHARGIC', 'UNABLE_TO_FEED'])] : [],
        appetite: null, remeasure, by: 'AWW',
      };
      evs.push(e);
      return e;
    };

    for (let m = 0; m < 12; m++) {
      const gd = months[m] + (awc.growthDay - 1) * DAY + 5 * HOUR + r.int(0, 300) * 60000;
      if (gd > NOW) break;
      const tr = truthAt(gd);
      if (tr.away) {
        if (c.migration?.announced && r.chance(c.migration.destination.awcAvail * 0.8)) { const e = measure(gd + r.int(-3, 3) * DAY, false); if (e) { e.atDestination = c.migration.destination.id; c.migration.measuredAtDest = true; } }
        continue;
      }
      if (!r.chance(0.9)) continue;
      const e = measure(gd, false);
      if (!e) continue;
      // incremental engine call — did it ask for a re-measure?
      const ev = evaluate(c, evs, c.signals, pack);
      const cur = ev.current;
      if (cur && cur.remeasure && r.chance(0.82)) {
        const t2 = gd + r.int(2, 10) * DAY + r.int(0, 300) * 60000;
        if (t2 < NOW && !truthAt(t2).away) { measure(t2, true); }
      }
    }
    c.events = evs;
    out.events.push(...evs);
  }
  district.months = months;
  district.history = out;
  return analyse(district, r, pack);
}

/** Run the engine over everything, compute silent-trial metrics, live tasks and the bridge. */
