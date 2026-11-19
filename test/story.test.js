import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../app/engine/simulate.js';
import { DEFAULT_PACK } from '../app/engine/rulepack.js';
import { castStory, CAST, portraitSvg } from '../app/engine/story.js';
import { trackerSingleReading } from '../app/engine/triage.js';

test('Riya is a real story: flagged AMBER before any Tracker listing, months before SAM', () => {
  const sim = generate({ seed: 71100, pack: DEFAULT_PACK });
  const before = JSON.stringify(sim.metrics);
  const st = castStory(sim, DEFAULT_PACK);
  assert.ok(st, 'a story child exists');
  const c = sim.district.children.find((x) => x.id === st.childId);
  assert.equal(c.name, 'Riya Hembrom');
  assert.equal(c.mother, 'Sunita Hembrom');
  assert.equal(c.sex, 'F');
  const v = c.eval.visits;
  assert.equal(trackerSingleReading(c, v[st.samI], DEFAULT_PACK), 'SAM');
  for (let i = 0; i <= st.aI; i++) assert.equal(trackerSingleReading(c, v[i], DEFAULT_PACK), null, 'not listed by the Tracker before AMBER');
  assert.equal(c.eval.results[st.aI].tier, 'AMBER');
  assert.ok(st.leadDays >= 30, `lead ${st.leadDays} d`);
  const awc = sim.district.awcs.find((a) => a.id === st.awcId);
  assert.equal(awc.aww, 'Kamla Devi');
  assert.equal(awc.asha, 'Phulmani Hansda');
  assert.equal(sim.district.blocks.filter((b) => b.cdpo === 'Smt. Anita Purty').length, 1, 'one CDPO per name');
  const firsts = new Set(CAST.map((m) => m.first));
  for (const o of sim.district.children) if (o !== c && o.awcId === c.awcId) assert.ok(!firsts.has(o.name.split(' ')[0]), `no namesake: ${o.name}`);
  assert.equal(JSON.stringify(sim.metrics), before, 'names only: metrics untouched');
});

test('the story is deterministic and exists in other districts too', () => {
  const a = castStory(generate({ seed: 71100, pack: DEFAULT_PACK }), DEFAULT_PACK);
  const b = castStory(generate({ seed: 71100, pack: DEFAULT_PACK }), DEFAULT_PACK);
  assert.deepEqual(a, b);
  for (const seed of [1, 2]) assert.ok(castStory(generate({ seed, pack: DEFAULT_PACK }), DEFAULT_PACK));
});

test('portraits render as pixel SVG', () => {
  for (const m of CAST) assert.match(portraitSvg(m), /^<svg[^>]+viewBox="0 0 12 12".*<rect/);
});
