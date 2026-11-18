// Synthetic district population: blocks, sectors, AWCs, children (with latent truth parameters).
import { rng, DAY, HOUR, median, quantile, round } from '../util.js';
import { lmsLhfa, lmsWfh, valueAtZ, DAYS_PER_MONTH } from '../growth.js';
import { evaluate, trackerSingleReading } from '../triage.js';
import { makeConsent, gateSignals } from '../consent.js';
import { makeTask, addClosure, allocate, escalation, addMilestone } from '../tasks.js';
import { replay } from '../bridge.js';
import { scoreFeed, scoreFeedOverTime } from '../reliability.js';
import { NOW, SIM_START, BLOCKS, VILLAGES, MOTHER, SUR, nameFor } from './constants.js';
import { simulateHistory } from './history.js';

/** @param {{ seed?: number, awcsPerSector?: number, sectorsPerBlock?: number, childrenPerAwc?: number, pack?: any }} [opts] */
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

