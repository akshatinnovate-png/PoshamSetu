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

