import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, analyseRows, COLS } from '../app/engine/importcsv.js';
import { DEFAULT_PACK } from '../app/engine/rulepack.js';

test('CSV parser handles quotes, commas and CRLF', () => {
  const r = parseCsv('a,b\r\n"x, y","say ""hi"""\r\n');
  assert.deepEqual(r, [['a', 'b'], ['x, y', 'say "hi"']]);
});

test('import runs the engine on an export and reports tiers and reliability', () => {
  const rows = [COLS.join(',')];
  const add = (ref, d, w, h, m) => rows.push([ref, 'F', '2025-01-10', 'AWC1', d, w, h, m, 0].join(','));
  add('A1', '2026-03-01', 9.0, 76, 130); add('A1', '2026-04-01', 8.7, 76.5, 121); add('A1', '2026-04-08', 8.7, 76.5, 120); add('A1', '2026-05-02', 8.2, 77, 112);
  add('B2', '2026-03-01', 9.4, 77, 140); add('B2', '2026-04-01', 9.6, 78, 141);
  const out = analyseRows(parseCsv(rows.join('\n')), DEFAULT_PACK);
  assert.equal(out.children, 2);
  assert.equal(out.tiers.RED_B, 1);
  assert.equal(out.feeds.length, 1);
  assert.equal(out.samKids, 1);
  assert.equal(out.earlier, 1);
});

test('import reports missing columns', () => {
  assert.match(analyseRows([['foo', 'bar']], DEFAULT_PACK).error, /Missing columns/);
});
