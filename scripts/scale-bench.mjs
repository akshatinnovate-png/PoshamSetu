// Scale benchmark: how long does the full engine take as the district grows?
// Usage: node scripts/scale-bench.mjs [multiplier...]
import { generate } from '../app/engine/simulate.js';
import { evaluate } from '../app/engine/triage.js';
import { DEFAULT_PACK } from '../app/engine/rulepack.js';

for (const k of (process.argv.slice(2).length ? process.argv.slice(2) : ['1', '4', '10']).map(Number)) {
  const t0 = performance.now();
  const S = generate({ pack: DEFAULT_PACK, childrenPerAwc: 40 * k, seed: 7 });
  const t1 = performance.now();
  // re-triage everyone once more (what a nightly full recompute would cost)
  let visits = 0;
  for (const c of S.district.children) visits += evaluate(c, c.events, c.signals, DEFAULT_PACK).visits.length;
  const t2 = performance.now();
  const kids = S.district.children.length;
  console.log(`${kids.toLocaleString('en-IN').padStart(7)} children · ${visits.toLocaleString('en-IN').padStart(8)} visits · simulate+backtest ${Math.round(t1 - t0)} ms · full re-triage ${Math.round(t2 - t1)} ms (${((t2 - t1) / kids * 1000).toFixed(0)} µs/child)`);
}
