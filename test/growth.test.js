import test from 'node:test';
import assert from 'node:assert/strict';
import { waz, whz, haz, wfaCurve, DAYS_PER_MONTH } from '../app/engine/growth.js';

const d = (m) => m * DAYS_PER_MONTH;
test('WAZ is 0 at the WHO median', () => {
  assert.equal(waz('M', d(12), 9.6479), 0);
  assert.equal(waz('M', 0, 3.3464), 0);
});
test('WAZ near -2 at the published SD2neg line', () => {
  const z = waz('M', 0, 2.5);
  assert.ok(Math.abs(z + 2) < 0.15, String(z));
});
test('WHZ uses length under 24 months and height after', () => {
  // WHO wfl boys 45 cm median 2.441 kg
  assert.equal(whz('M', d(1), 45, 2.441, true), 0);
  // wfh boys 65 cm median 7.4327 (standing, 30 months)
  assert.equal(whz('M', d(30), 65, 7.4327, false), 0);
  // a standing measurement under 24 months gets +0.7 cm
  assert.notEqual(whz('M', d(12), 75, 9.5, false), whz('M', d(12), 75, 9.5, true));
});
test('restricted z beyond -3 for weight', () => {
  const z = whz('M', d(18), 80, 7.5, true);
  assert.ok(z < -3 && z > -6, String(z));
});
test('HAZ median', () => { assert.equal(haz('F', d(0), 49.1477), 0); });
test('curve points', () => { assert.equal(wfaCurve('F', 0).length, 61); });
