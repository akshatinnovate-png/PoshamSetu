import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../scripts/validate-zscores.mjs';

// Real SMART survey extracts (nipnTK, GPL-3) — see test/fixtures/README.md.
for (const f of ['test/fixtures/smart-dist-ex01.csv', 'test/fixtures/smart-flag-ex01.csv']) {
  test(`z-scores agree with standard software on ${f}`, () => {
    const s = validate(f);
    assert.equal(s.waz.exact, 1, 'WAZ must match exactly');
    assert.equal(s.haz.exact, 1, 'HAZ must match exactly');
    assert.ok(s.whz.exact >= 0.93, `WHZ exact ${s.whz.exact}`);
    assert.ok(s.whz.max <= 0.25, `WHZ max ${s.whz.max} (only lying/standing ambiguity remains)`);
  });
}

test('SMART digit preference score grades the real example surveys as nipnTK documents them', async () => {
  const fs = await import('node:fs');
  const { digitPreferenceScore } = await import('../app/engine/reliability.js');
  const col = (f, names) => { const [h, ...rows] = fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => l.split(',')); const i = h.findIndex((k) => names.includes(k)); return rows.map((r) => +r[i]); };
  assert.equal(digitPreferenceScore(col('test/fixtures/smart-dp-ex01.csv', ['ht', 'height'])).grade, 'problematic');
  assert.equal(digitPreferenceScore(col('test/fixtures/smart-dp-ex03.csv', ['wt', 'weight'])).grade, 'excellent');
  assert.equal(digitPreferenceScore(col('test/fixtures/smart-flag-ex01.csv', ['ht', 'height'])).grade, 'problematic');
});
