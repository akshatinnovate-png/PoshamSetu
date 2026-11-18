// Validate PoshanSetu's WHO z-scores against z-scores computed by standard software in real surveys.
// Usage: node scripts/validate-zscores.mjs [csv ...]   (columns: age (months), sex (1=M,2=F), weight, height, whz, waz, haz)
import fs from 'node:fs';
import { whz, waz, haz, DAYS_PER_MONTH } from '../app/engine/growth.js';

export function validate(file) {
  const [h, ...rows] = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => l.split(','));
  const ix = Object.fromEntries(h.map((k, i) => [k.replace(/"/g, ''), i]));
  const out = {};
  for (const k of ['whz', 'waz', 'haz']) out[k] = [];
  for (const r of rows) {
    const sex = r[ix.sex] === '1' ? 'M' : 'F', age = +r[ix.age], ad = age * DAYS_PER_MONTH, w = +r[ix.weight], ht = +r[ix.height];
    // SMART protocol: children < 87 cm are measured lying (length), >= 87 cm standing.
    const ours = { whz: whz(sex, ad, ht, w, ht < 87), waz: waz(sex, ad, w), haz: haz(sex, ad, ht) };
    for (const k of Object.keys(out)) { const ref = parseFloat(r[ix[k]]); if (Number.isFinite(ref) && ours[k] != null && Math.abs(ref) < 5) out[k].push({ d: Math.abs(ours[k] - ref), age, ht }); }
  }
  const summary = {};
  for (const [k, a] of Object.entries(out)) {
    const d = a.map((x) => x.d).sort((x, y) => x - y);
    summary[k] = { n: d.length, exact: d.filter((x) => x <= 0.011).length / d.length, p95: d[Math.floor(d.length * 0.95)], max: d[d.length - 1] };
  }
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const f of process.argv.slice(2).length ? process.argv.slice(2) : ['test/fixtures/smart-dist-ex01.csv', 'test/fixtures/smart-flag-ex01.csv']) {
    const s = validate(f);
    console.log(f);
    for (const [k, v] of Object.entries(s)) console.log(`  ${k}: n=${v.n} exact(±0.01)=${(v.exact * 100).toFixed(1)}% p95=${v.p95.toFixed(2)} max=${v.max.toFixed(2)}`);
  }
}
