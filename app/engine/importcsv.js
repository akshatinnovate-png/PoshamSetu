// CSV import for Phase 1: parse an anonymised export and run the engine over it.
import { evaluate, trackerSingleReading } from './triage.js';
import { scoreFeed } from './reliability.js';
import { median } from './util.js';

export const COLS = ['beneficiary_ref', 'sex', 'dob', 'awc_code', 'measured_at', 'weight_kg', 'height_cm', 'muac_mm', 'oedema'];

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function analyseRows(rows, pack) {
  const [head, ...data] = rows;
  const idx = Object.fromEntries(COLS.map((c) => [c, head.map((x) => x.trim().toLowerCase()).indexOf(c)]));
  const missing = COLS.filter((c) => idx[c] < 0 && c !== 'muac_mm' && c !== 'oedema');
  if (missing.length) return { error: `Missing columns: ${missing.join(', ')}` };
  const kids = new Map(); const problems = [];
  data.forEach((r, i) => {
    const g = (c) => (idx[c] >= 0 ? (r[idx[c]] ?? '').trim() : '');
    const ref = g('beneficiary_ref');
    const t = Date.parse(g('measured_at')); const dob = Date.parse(g('dob'));
    if (!ref || !Number.isFinite(t) || !Number.isFinite(dob)) { problems.push(`row ${i + 2}: missing ref or bad date`); return; }
    if (!kids.has(ref)) kids.set(ref, { id: ref, pseudoId: ref, sex: g('sex').toUpperCase().startsWith('F') ? 'F' : 'M', dob, awcId: g('awc_code') || 'UNKNOWN', events: [] });
    const num = (c) => { const v = parseFloat(g(c)); return Number.isFinite(v) ? v : null; };
    const k = kids.get(ref);
    k.events.push({ id: `${ref}-${i}`, t, weightKg: num('weight_kg'), heightCm: num('height_cm'), muacMm: num('muac_mm'), oedema: g('oedema') === '1', lying: (t - dob) / 86400000 / 30.4375 < 24, danger: [] });
  });
  const results = []; const byAwc = {}; const leads = []; let samKids = 0, earlier = 0, strictKids = 0, strictEarlier = 0;
  const tiers = { RED_A: 0, RED_B: 0, AMBER: 0, WATCH: 0, GREEN: 0 };
  for (const k of kids.values()) {
    const ev = evaluate(k, k.events, [], pack);
    if (!ev.current) continue;
    tiers[ev.current.tier]++;
    (byAwc[k.awcId] ||= []).push(ev.visits);
    results.push({ k, ev });
    let sam = null, any = null;
    for (const v of ev.visits) { if (v.biv.length) continue; const f = trackerSingleReading(k, v, pack); if (f && any == null) any = v.t; if (f === 'SAM') { sam = v.t; break; } }
    if (sam) { samKids++; const a = ev.results.find((r) => r.tier === 'AMBER' && r.t < sam && sam - r.t <= 180 * 86400000); if (a) { earlier++; leads.push((sam - a.t) / 86400000); } }
    if (any) { strictKids++; if (ev.results.some((r) => r.tier === 'AMBER' && r.t < any && any - r.t <= 180 * 86400000)) strictEarlier++; }
  }
  const feeds = Object.entries(byAwc).map(([awc, vs]) => ({ awc, ...scoreFeed(vs, pack) })).sort((a, b) => a.R - b.R);
  return { children: kids.size, events: data.length, problems, tiers, feeds, samKids, earlier, leads, leadMedian: median(leads), strictKids, strictEarlier, results };
}


// ---------- Real cross-sectional surveys (SMART format): plausibility report ----------
import { whz as zWhz, waz as zWaz, haz as zHaz, bivFlags, DAYS_PER_MONTH } from './growth.js';
import { digitPreferenceScore } from './reliability.js';

/** Is this a SMART-style survey (age in months, sex 1/2, weight, height)? */
export function isSmartSurvey(rows) {
  const h = rows[0].map((x) => x.trim().toLowerCase().replace(/"/g, ''));
  return h.includes('age') && h.includes('sex') && (h.includes('weight') || h.includes('wt')) && !h.includes('dob');
}

/** SMART plausibility-style report for one survey: z-scores, flags, DPS, SD, sex/age ratio, single-reading tiers. */
export function smartReport(rows, pack) {
  const [head, ...data] = rows;
  const h = head.map((x) => x.trim().toLowerCase().replace(/"/g, ''));
  const col = (...names) => names.map((n) => h.indexOf(n)).find((i) => i >= 0);
  const ix = { age: col('age'), sex: col('sex'), w: col('weight', 'wt'), ht: col('height', 'ht'), muac: col('muac'), oed: col('oedema', 'edema') };
  const kids = [];
  for (const r of data) {
    const age = +r[ix.age], sex = r[ix.sex] === '1' || /^m/i.test(r[ix.sex]) ? 'M' : 'F', w = +r[ix.w], ht = +r[ix.ht];
    if (!Number.isFinite(age) || !Number.isFinite(w) || !Number.isFinite(ht)) continue;
    const ad = age * DAYS_PER_MONTH;
    const ix2 = { whz: zWhz(sex, ad, ht, w, ht < 87), waz: zWaz(sex, ad, w), haz: zHaz(sex, ad, ht) };
    const muac = ix.muac != null ? +r[ix.muac] : null;
    const oedema = ix.oed != null ? r[ix.oed] === '1' : false;
    kids.push({ age, sex, w, ht, muac: Number.isFinite(muac) ? (muac < 40 ? muac * 10 : muac) : null, oedema, ix: ix2, biv: bivFlags(ix2) });
  }
  const ok = kids.filter((k) => !k.biv.length && k.ix.whz != null);
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
  const whzs = ok.map((k) => k.ix.whz);
  const A = pack.anthropometry;
  const tier = (k) => k.oedema ? 'RED_A' : ((k.age >= 6 && k.muac != null && k.muac < A.muacSamMm) || k.ix.whz < A.whzSam) ? 'RED_B' : ((k.age >= 6 && k.muac != null && k.muac < A.muacMamMm) || k.ix.whz < A.whzMam) ? 'AMBER' : 'GREEN';
  const tiers = { RED_A: 0, RED_B: 0, AMBER: 0, GREEN: 0 };
  for (const k of ok) tiers[tier(k)]++;
  const boys = kids.filter((k) => k.sex === 'M').length;
  const young = kids.filter((k) => k.age >= 6 && k.age < 30).length, old = kids.filter((k) => k.age >= 30 && k.age < 60).length;
  const sdWhz = sd(whzs);
  const dpsW = digitPreferenceScore(kids.map((k) => k.w)), dpsH = digitPreferenceScore(kids.map((k) => k.ht));
  const grade = (v, cuts) => (v <= cuts[0] ? 'excellent' : v <= cuts[1] ? 'good' : v <= cuts[2] ? 'acceptable' : 'problematic');
  return {
    mode: 'survey', n: kids.length,
    flaggedPct: (kids.length - ok.length) / kids.length,
    meanWhz: mean(whzs), sdWhz, sdGrade: sdWhz >= 0.8 && sdWhz <= 1.2 ? 'acceptable (0.8–1.2)' : 'problematic (outside 0.8–1.2)',
    wasting: whzs.filter((z) => z < -2).length / whzs.length, sam: whzs.filter((z) => z < -3).length / whzs.length,
    dpsW, dpsH, sexRatio: boys / Math.max(1, kids.length - boys), ageRatio: young / Math.max(1, old),
    tiers, checks: [
      ['Flagged (WHO BIV)', `${((kids.length - ok.length) / kids.length * 100).toFixed(1)}%`, grade((kids.length - ok.length) / kids.length * 100, [2.5, 5, 7.5])],
      ['SD of WHZ', sdWhz.toFixed(2), sdWhz >= 0.8 && sdWhz <= 1.2 ? 'acceptable' : 'problematic'],
      ['Digit preference — weight (DPS)', dpsW.dps, dpsW.grade],
      ['Digit preference — height (DPS)', dpsH.dps, dpsH.grade],
      ['Sex ratio (boys / girls)', (boys / Math.max(1, kids.length - boys)).toFixed(2), Math.abs(boys / Math.max(1, kids.length - boys) - 1) < 0.2 ? 'acceptable' : 'check'],
      ['Age ratio (6–29 / 30–59 mo)', (young / Math.max(1, old)).toFixed(2), Math.abs(young / Math.max(1, old) - 0.85) < 0.25 ? 'acceptable' : 'check'],
    ],
  };
}
