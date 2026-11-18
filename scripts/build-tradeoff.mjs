// Sweep operating points and write app/data/tradeoff.json for the Trial window.
// Each point = a rule-pack variant; metrics averaged over several synthetic districts.
import fs from 'node:fs';
import { generate } from '../app/engine/simulate.js';
import { DEFAULT_PACK, deepClone } from '../app/engine/rulepack.js';

const seeds = [71100, 2202, 3303];
const points = [];
const variants = [];
variants.push({ id: 'round1', label: 'Round 1 rules', patch: { rules: { velocityOfficial: false, velocity2m: false, muacTrend: false, weakSignals: false, forecast: false } } });
for (const amberAt of [5, 6, 7, 8, 9]) for (const minProb of [0.35, 0.5, 0.65, 0.8]) variants.push({ id: `r${amberAt}-f${minProb}`, label: `risk ≥ ${amberAt}, forecast p ≥ ${minProb}`, patch: { risk: { amberAt }, forecast: { minProb } } });
for (const amberAt of [6, 7, 8]) variants.push({ id: `r${amberAt}-nof`, label: `risk ≥ ${amberAt}, no forecast`, patch: { risk: { amberAt }, rules: { forecast: false } } });
variants.push({ id: 'shipped', label: 'Shipped pack 2.x', patch: {} });

for (const v of variants) {
  const ms = seeds.map((seed) => {
    const p = deepClone(DEFAULT_PACK);
    for (const [k, val] of Object.entries(v.patch)) Object.assign(p[k], val);
    return generate({ pack: p, seed }).metrics;
  });
  const avg = (f) => ms.reduce((s, m) => s + f(m), 0) / ms.length;
  points.push({ ...v, strict: avg((m) => m.strict.share), earlier: avg((m) => m.shareEarlier), precision: avg((m) => m.precision), alerts: avg((m) => m.alerts / m.children), overCap: avg((m) => m.amberPerAwcMonth.overCap / m.amberPerAwcMonth.cells), lead: avg((m) => m.leadMedian), strictLead: avg((m) => m.strict.leadMedian || 0) });
  process.stdout.write('.');
}
// Ablation: switch rules on one at a time (cumulative)
const ladder = [
  ['Round 1 rules', { velocityOfficial: false, velocity2m: false, muacTrend: false, weakSignals: false, forecast: false }],
  ['+ official WHO velocity (1-month)', { velocityOfficial: true, velocity2m: false, muacTrend: false, weakSignals: false, forecast: false }],
  ['+ 2-month velocity, 12-24 mo', { velocityOfficial: true, velocity2m: true, muacTrend: false, weakSignals: false, forecast: false }],
  ['+ MUAC trend (rejected)', { velocityOfficial: true, velocity2m: true, muacTrend: true, weakSignals: false, forecast: false }],
  ['+ risk points (no MUAC trend)', { velocityOfficial: true, velocity2m: true, muacTrend: false, weakSignals: true, forecast: false }],
  ['+ Kalman forecast = shipped', { velocityOfficial: true, velocity2m: true, muacTrend: false, weakSignals: true, forecast: true }],
];
const ablation = [];
for (const [label, rules] of ladder) {
  const ms = seeds.map((seed) => { const p = deepClone(DEFAULT_PACK); p.rules = rules; return generate({ pack: p, seed }).metrics; });
  const avg = (f) => ms.reduce((s, m) => s + f(m), 0) / ms.length;
  ablation.push({ label, strict: avg((m) => m.strict.share), earlier: avg((m) => m.shareEarlier), precision: avg((m) => m.precision), alerts: avg((m) => m.alerts / m.children), truthLead: avg((m) => m.truth.leadMedian || 0) });
  process.stdout.write('+');
}
// Pareto frontier on (strict ↑, precision ↑)
for (const p of points) p.pareto = !points.some((q) => q !== p && q.strict >= p.strict && q.precision >= p.precision && (q.strict > p.strict || q.precision > p.precision));
fs.writeFileSync(new URL('../app/data/tradeoff.json', import.meta.url), JSON.stringify({ generatedAt: new Date().toISOString(), seeds, points, ablation }, null, 1));
console.log('\nwrote', points.length, 'points');
