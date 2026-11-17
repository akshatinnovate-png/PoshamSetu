// Synthetic pilot district (Paschimi Singhbhum, three blocks) for the prototype.
// ALL RECORDS ARE SYNTHETIC. Distributions are tuned to NFHS-5 / NITI-IFPRI district levels
// (wasting ~30%, stunting ~60%) so the engine meets realistic case-mix and data-quality noise.
import { rng, DAY, HOUR, median, quantile, round } from './util.js';
import { lmsLhfa, lmsWfh, valueAtZ, DAYS_PER_MONTH } from './growth.js';
import { evaluate, trackerSingleReading } from './triage.js';
import { makeConsent, gateSignals } from './consent.js';
import { makeTask, addClosure, allocate, escalation, addMilestone } from './tasks.js';
import { replay } from './bridge.js';
import { scoreFeed, scoreFeedOverTime } from './reliability.js';

export const NOW = Date.UTC(2026, 10, 17, 3, 30); // 17 Nov 2026, 09:00 IST
export const SIM_START = Date.UTC(2025, 10, 1);
export const SILENT_FROM = Date.UTC(2026, 7, 6);
export const LIVE_FROM = Date.UTC(2026, 9, 1);

const BLOCKS = [
  { id: 'KHU', name: 'Khuntpani', cdpo: 'Smt. Anita Purty', bmo: 'Dr. R. K. Sinku' },
  { id: 'TON', name: 'Tonto', cdpo: 'Shri Prakash Bodra', bmo: 'Dr. S. Gagrai' },
  { id: 'NOA', name: 'Noamundi', cdpo: 'Smt. Rekha Champia', bmo: 'Dr. M. Laguri' },
];
const VILLAGES = ['Bara Kuira', 'Sona Pahari', 'Hesadih', 'Jojohatu', 'Rengasai', 'Kundrugutu', 'Sialjoda', 'Barkela', 'Pokam', 'Jamdih', 'Lupungutu', 'Tilaipada',
  'Kasirasai', 'Matkamhatu', 'Gitilpi', 'Dopai', 'Bhoya', 'Herta', 'Purnia', 'Kendposi', 'Bandu', 'Saitba', 'Sarbil', 'Roladih',
  'Kudahatu', 'Nischintpur', 'Kotgarh', 'Murumdih', 'Lagra', 'Dumbisai', 'Nurda', 'Rajabasa', 'Baihatu', 'Dubil', 'Pandrasali', 'Jaipur Tola'];
const GIRL = ['Somari', 'Budhni', 'Sanika', 'Jyoti', 'Laxmi', 'Gurubari', 'Sombari', 'Mungli', 'Raimuni', 'Sukurmani', 'Phulmani', 'Salge', 'Dumni', 'Pinky', 'Sunita', 'Mainu', 'Juliyani', 'Basanti', 'Chandmuni', 'Anjali', 'Sapna', 'Rani', 'Lilmuni', 'Jasmani'];
const BOY = ['Birsa', 'Sukru', 'Mangal', 'Budhram', 'Somra', 'Lalit', 'Raju', 'Sanjay', 'Dulal', 'Ravi', 'Gurucharan', 'Jitu', 'Sagen', 'Paltu', 'Lakhan', 'Bijay', 'Mukesh', 'Durga', 'Shiva', 'Ajay', 'Roshan', 'Karan', 'Sonu', 'Turam'];
const SUR = ['Hembrom', 'Purty', 'Sinku', 'Bodra', 'Tiu', 'Gagrai', 'Champia', 'Banra', 'Laguri', 'Deogam', 'Sundi', 'Kalundia', 'Honhaga', 'Pingua', 'Birua', 'Bage', 'Samad', 'Hansda', 'Tamsoy', 'Jonko'];
const MOTHER = ['Sukhmati', 'Salomi', 'Parvati', 'Mangri', 'Sita', 'Ranjita', 'Dasmati', 'Rebeka', 'Jema', 'Shanti', 'Kunti', 'Lakhi', 'Marium', 'Pushpa', 'Sumi'];
export const DESTINATIONS = [
  { id: 'BR-PAT', label: 'Brick kilns · Patna, Bihar', state: 'Bihar', kind: 'kiln', awcAvail: 0.55 },
  { id: 'OD-BHD', label: 'Brick kilns · Bhadrak, Odisha', state: 'Odisha', kind: 'kiln', awcAvail: 0.6 },
  { id: 'OD-SBP', label: 'Brick kilns · Sambalpur, Odisha', state: 'Odisha', kind: 'kiln', awcAvail: 0.6 },
  { id: 'PB-LDH', label: 'Brick kilns · Ludhiana, Punjab', state: 'Punjab', kind: 'kiln', awcAvail: 0.45 },
  { id: 'WB-KOL', label: 'Construction · Kolkata, West Bengal', state: 'West Bengal', kind: 'construction', awcAvail: 0.7 },
  { id: 'JH-DHN', label: 'Brick kilns · Dhanbad, Jharkhand', state: 'Jharkhand', kind: 'kiln', awcAvail: 0.8 },
];
const VACCINES = [['BCG', 0], ['Penta-1', 42], ['Penta-2', 70], ['Penta-3', 98], ['MR-1', 274], ['MR-2', 487], ['DPT-B1', 487]];

function nameFor(r, sex) { return `${r.pick(sex === 'F' ? GIRL : BOY)} ${r.pick(SUR)}`; }

/** Truth model helpers. */
function heightAt(sex, ageDays, haz) { const p = lmsLhfa(sex, ageDays); return p ? valueAtZ(p, haz) : null; }
function weightAt(sex, ageDays, h, whz) { const p = lmsWfh(sex, ageDays, h, ageDays / DAYS_PER_MONTH < 24); return p ? valueAtZ(p, whz) : null; }
function muacAt(ageMo, whz) { return 140 + 0.25 * (ageMo - 12) + 9.5 * whz; }

export function generate({ seed = 71100, awcsPerSector = 6, sectorsPerBlock = 2, childrenPerAwc = 40, pack } = {}) {
  const r = rng(seed);
  const district = { name: 'Paschimi Singhbhum', state: 'Jharkhand', blocks: [], sectors: [], awcs: [], children: [] };
  let vIdx = 0;
  for (const b of BLOCKS) {
    const block = { ...b, sectors: [] };
    for (let s = 0; s < sectorsPerBlock; s++) {
      const sector = { id: `${b.id}-S${s + 1}`, blockId: b.id, name: `${b.name} Sector ${s + 1}`, mukhyaSevika: `${r.pick(['Smt.', 'Km.'])} ${r.pick(MOTHER)} ${r.pick(SUR)}`, awcs: [] };
      for (let a = 0; a < awcsPerSector; a++) {
        const village = VILLAGES[vIdx++ % VILLAGES.length];
        const q = r();
        const quality = q < 0.6 ? 'good' : q < 0.8 ? 'heaping' : q < 0.92 ? 'copyforward' : 'sloppy';
        const awc = {
          id: `${b.id}${String(s + 1)}${String(a + 1).padStart(2, '0')}`,
          code: `2041${b.id === 'KHU' ? '05' : b.id === 'TON' ? '17' : '11'}${String(s * 10 + a + 1).padStart(3, '0')}`,
          name: `${village}`, village, blockId: b.id, sectorId: sector.id,
          aww: `${r.pick(MOTHER)} ${r.pick(SUR)}`, asha: `${r.pick(MOTHER)} ${r.pick(SUR)}`,
          growthDay: r.int(4, 24), quality,
          migrationPropensity: r.chance(0.35) ? 0.22 + r() * 0.12 : 0.03 + r() * 0.05,
          connectivity: r.chance(0.3) ? 'poor' : r.chance(0.5) ? 'patchy' : 'ok',
          x: 0, y: 0,
        };
        sector.awcs.push(awc.id); district.awcs.push(awc);
      }
      block.sectors.push(sector.id); district.sectors.push(sector);
    }
    district.blocks.push(block);
  }
  // map coordinates (stylised, for the district map window)
  district.awcs.forEach((a, i) => {
    const bi = BLOCKS.findIndex((b) => b.id === a.blockId);
    const local = district.awcs.filter((x) => x.blockId === a.blockId).indexOf(a);
    a.x = 0.12 + bi * 0.31 + (local % 4) * 0.065 + r() * 0.03;
    a.y = 0.18 + Math.floor(local / 4) * 0.22 + r() * 0.06;
  });

  const childSeq = { n: 0 };
  for (const awc of district.awcs) {
    for (let k = 0; k < childrenPerAwc; k++) district.children.push(makeChild(r, awc, childSeq));
  }
  return simulateHistory(district, r, pack);
}

function makeChild(r, awc, seq) {
  const sex = r.chance(0.49) ? 'F' : 'M';
  const dob = SIM_START - r.int(-120, 1640) * DAY;
  const lbw = r.chance(0.18);
  const mu = r.normal(-0.95, 0.7) - (lbw ? 0.35 : 0);
  seq.n++;
  return {
    id: `C${String(seq.n).padStart(5, '0')}`,
    pseudoId: `PT${String(2041000000 + Math.floor(r() * 899999999)).slice(0, 12)}`,
    name: nameFor(r, sex), sex, dob, lbw, awcId: awc.id, awcCode: awc.code,
    mother: `${r.pick(MOTHER)} ${awc.aww.split(' ')[1] && r.chance(0.5) ? awc.aww.split(' ')[1] : r.pick(SUR)}`,
    phone: r.chance(0.72) ? `+91 9${r.int(100000000, 999999999)}` : null,
    abha: r.chance(0.46),
    st: r.chance(0.86),
    truth: { mu, haz0: Math.max(-3.2, r.normal(-1.9, 1.0)), whz0: mu + r.normal(0, 0.45) },
    uidToken: `UIDTKN-${Math.floor(r() * 1e12).toString(36)}`,
  };
}

function simulateHistory(district, r, pack) {
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
    }
  }
  const escal = tasks.map((t) => ({ task: t, esc: escalation(t, NOW, pack) }));

  return {
    pack, district, awcById, feeds, metrics, tasks, escal,
    bridge: { round2: bridgeR2, round1: bridgeR1, liveEvents: liveEvents.length },
    now: NOW,
  };
}

/** Silent-trial backtest: PoshanSetu vs the Tracker's single-reading lists. */
export function backtest(district, evalByChild, pack) {
  const leads = [], strictLeads = [], firstRule = {};
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
    children: district.children.length,
  };
}
