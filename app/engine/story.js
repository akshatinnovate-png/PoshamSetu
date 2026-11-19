// Riya's story: the people behind the numbers.
// The cast is laid over the synthetic district, so every window, the AWW phone app and the docs tell
// the same story. Riya is a real child in the simulation, chosen by the engine: a girl the Tracker
// would list as SAM months later, whom PoshanSetu's trend rules flagged first during the silent trial.
// Only display names change; no reading, rule or metric is touched.
import { trackerSingleReading } from './triage.js';
import { DAY } from './util.js';

/** @typedef {{ key: string, name: string, first: string, role: string, line: string, constraint: string, changes: string, app: string, hair: string, cloth: string, skin: string, child?: boolean }} CastMember */

/** @type {CastMember[]} */
export const CAST = [
  { key: 'riya', name: 'Riya Hembrom', first: 'Riya', role: 'The child', child: true, app: 'child',
    line: 'Her line slopes down a little every month. No single reading crosses the line.',
    constraint: 'A slow fall is invisible to a system that reads one weighing at a time.',
    changes: 'Her direction is read, not just her position: AMBER with a reason, months before the SAM list.',
    hair: '#2a1d1a', cloth: '#f6a3b7', skin: '#8a5a3c' },
  { key: 'sunita', name: 'Sunita Hembrom', first: 'Sunita', role: 'Riya’s mother', app: 'migration',
    line: 'Leaves for a brick kiln in December. The MCP card gets lost; the phone is off for days.',
    constraint: 'Migrant families drop out of the record when they cross a district line.',
    changes: 'A signed transfer token verifies offline; an IVR short code or her thumb (or face) finds Riya’s record at the kiln AWC. Her consent decides which flags cross ministries.',
    hair: '#1f1b1d', cloth: '#e94fbf', skin: '#7a4c33' },
  { key: 'kamla', name: 'Kamla Devi', first: 'Kamla', role: 'Anganwadi Worker (AWW)', app: 'worklist',
    line: '40 children, one growth day a month, and a Tracker app that is offline half the day.',
    constraint: 'Too many registers, too many alerts, and blame for data that arrives late.',
    changes: 'A short Hindi day-card: who to see, why, by when. Re-weigh only when asked, two new AMBER visits a month at most, ranked by risk. Late data is booked to the pipeline, not to her.',
    hair: '#2a1d1a', cloth: '#f2b33d', skin: '#8f5e3e' },
  { key: 'phulmani', name: 'Phulmani Hansda', first: 'Phulmani', role: 'Sahiya (ASHA)', app: 'joint',
    line: 'A keypad phone, no data pack, and a different ministry from Kamla.',
    constraint: 'Joint AWW–ASHA visits fail because two people with different bosses cannot be at the same door at the same hour.',
    changes: 'A Hindi voice call: press 1 when visited. Her visit and Kamla’s close the task in either order within 7 days.',
    hair: '#1f1b1d', cloth: '#7fb8e6', skin: '#7d4f36' },
  { key: 'basanti', name: 'Smt. Basanti Tiu', first: 'Basanti', role: 'Mukhya Sevika (supervisor)', app: 'escalation',
    line: 'Supervises 25 Anganwadis and cannot see which tasks are stuck.',
    constraint: 'Supervision is monthly and punitive; problems surface too late to fix.',
    changes: 'Half-closed and overdue tasks per AWC, and reliability flags that call for a training visit, not a penalty.',
    hair: '#3a2a26', cloth: '#9cc98a', skin: '#94623f' },
  { key: 'anita', name: 'Smt. Anita Purty', first: 'Anita', role: 'CDPO, with the Block MO', app: 'reliability',
    line: 'Block counts arrive monthly. A broken scale looks like a healthy village.',
    constraint: 'Aggregates hide both bad data and the children behind it.',
    changes: 'Weekly overdue RED/AMBER, a weighted reliability score per AWC, and names only through logged break-glass.',
    hair: '#1f1b1d', cloth: '#b48fd9', skin: '#86583b' },
];
export const CAST_BY_KEY = Object.fromEntries(CAST.map((c) => [c.key, c]));

const TREND = ['R2_CONFIRMED', 'R2_SUSTAINED', 'INFANT_FALTERING', 'INFANT_LOW_GAIN', 'VELOCITY_2M', 'FORECAST', 'TREND_PLUS_SIGNAL'];

/**
 * Choose Riya: an eventual-SAM child whom PoshanSetu flagged AMBER before the Tracker listed her at all,
 * preferring a girl under two, a trend rule as the reason, and a lead of about 2–6 months.
 * @param {{ children: any[] }} district @param {any} pack
 */
export function pickStoryChild(district, pack) {
  let best = null;
  for (const c of district.children) {
    const ev = c.eval;
    if (!ev || !ev.visits?.length) continue;
    const samI = ev.visits.findIndex((v) => trackerSingleReading(c, v, pack) === 'SAM' && !v.biv.length);
    if (samI < 3) continue;
    const anyI = ev.visits.findIndex((v) => trackerSingleReading(c, v, pack) && !v.biv.length);
    const aI = ev.results.findIndex((r) => r.tier === 'AMBER');
    if (aI < 0 || aI >= anyI) continue;
    const lead = (ev.visits[samI].t - ev.results[aI].t) / DAY;
    const age = ev.visits[aI].ageMonths;
    const trend = ev.results[aI].reasons.some((r) => TREND.includes(r.code));
    const score = (trend ? 0 : 100) + (c.sex === 'F' ? 0 : 40) + (age <= 24 ? 0 : 25) + Math.abs(Math.min(lead, 240) - 120) / 6 + (aI < 2 ? 15 : 0);
    if (!best || score < best.score || (score === best.score && c.id < best.c.id)) best = { c, samI, aI, anyI, lead, age, score };
  }
  return best;
}

/**
 * Lay the cast over a generated district (mutates display names only) and return the story anchor.
 * Deterministic: the same district gives the same story.
 * @param {{ district: any }} sim @param {any} pack
 */
export function castStory(sim, pack) {
  const d = sim.district;
  const pick = pickStoryChild(d, pack);
  if (!pick) return null;
  const { c } = pick;
  const awc = d.awcs.find((a) => a.id === c.awcId);
  const sector = d.sectors?.find((s) => s.id === awc.sectorId);
  const block = d.blocks?.find((b) => b.id === awc.blockId);
  c.name = CAST_BY_KEY.riya.name;
  c.mother = CAST_BY_KEY.sunita.name;
  awc.aww = CAST_BY_KEY.kamla.name;
  awc.asha = CAST_BY_KEY.phulmani.name;
  if (sector) sector.mukhyaSevika = CAST_BY_KEY.basanti.name;
  if (block) {
    const other = d.blocks.find((b) => b !== block && b.cdpo === CAST_BY_KEY.anita.name);
    if (other) other.cdpo = block.cdpo; // swap, so no two blocks share a CDPO
    block.cdpo = CAST_BY_KEY.anita.name;
  }
  // No other child on Kamla's register shares a cast member's first name.
  const taken = new Set(CAST.map((m) => m.first));
  const spare = ['Somari', 'Budhni', 'Sanika', 'Jyoti', 'Laxmi', 'Gurubari', 'Raimuni', 'Salge', 'Lilmuni', 'Jasmani'];
  let k = 0;
  for (const o of d.children) {
    if (o === c || o.awcId !== c.awcId) continue;
    const [first, ...rest] = o.name.split(' ');
    if (taken.has(first)) o.name = [spare[k++ % spare.length], ...rest].join(' ');
    const [mf, ...mr] = (o.mother || '').split(' ');
    if (taken.has(mf)) o.mother = ['Sukhmati', ...mr].join(' ');
  }
  const ev = c.eval;
  const amber = ev.results[pick.aI];
  // Longest run of near-identical weights before the SAM listing: "taller, but no heavier".
  let flat = null;
  for (let i = 0; i < pick.samI; i++) {
    let j = i;
    while (j + 1 < pick.samI && ev.visits[j + 1].weightKg != null && Math.abs(ev.visits[j + 1].weightKg - ev.visits[i].weightKg) <= 0.1) j++;
    const n = j - i + 1;
    if (n >= 3 && (!flat || n > flat.n)) flat = { n, kg: ev.visits[i].weightKg, lo: Math.min(...ev.visits.slice(i, j + 1).map((v) => v.weightKg)).toFixed(1), hi: Math.max(...ev.visits.slice(i, j + 1).map((v) => v.weightKg)).toFixed(1), from: ev.visits[i].t, to: ev.visits[j].t, cm: Math.round((ev.visits[j].heightCm - ev.visits[i].heightCm) * 10) / 10 };
  }
  return {
    childId: c.id, awcId: awc.id, sectorId: awc.sectorId, blockId: awc.blockId, village: awc.village,
    aI: pick.aI, samI: pick.samI, anyI: pick.anyI,
    amberAt: amber.t, samAt: ev.visits[pick.samI].t, leadDays: Math.round(pick.lead),
    ageAtAmber: Math.round(pick.age), flat,
    firstListAt: pick.anyI >= 0 ? ev.visits[pick.anyI].t : null, reason: amber.reasons.find((r) => r.tier === 'AMBER') || amber.reasons[0],
  };
}

/** 12×12 pixel portrait for a cast member, as SVG markup (retro OS style). */
export function portraitSvg(m, size = 48) {
  const adult = [
    '....HHHH....', '...HHHHHH...', '..HHSSSSHH..', '..HSSSSSSH..', '..HSESSESH..', '..HSSSSSSH..',
    '...SSMMSS...', '....SSSS....', '..CCCSSCCC..', '.CCCCCCCCCC.', '.CCCCCCCCCC.', '.CCCCCCCCCC.'];
  const kid = [
    '............', '....HHHH....', '.H.HHHHHH.H.', '.HHSSSSSSHH.', '..HSESSESH..', '...SSSSSS...',
    '...SSMMSS...', '....SSSS....', '...CCCCCC...', '..CCCCCCCC..', '..CCCCCCCC..', '..CCCCCCCC..'];
  const g = m.child ? kid : adult;
  const col = { H: m.hair, S: m.skin, E: '#1f1b1d', M: '#5a2b2b', C: m.cloth };
  let px = '';
  g.forEach((row, y) => [...row].forEach((ch, x) => { if (col[ch]) px += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${col[ch]}"/>`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="${size}" height="${size}" shape-rendering="crispEdges" style="display:block;background:#fff0f6">${px}</svg>`;
}
