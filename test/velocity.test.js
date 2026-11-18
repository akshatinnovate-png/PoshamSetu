import test from 'node:test';
import assert from 'node:assert/strict';
import { WHO_VELOCITY } from '../app/engine/who-velocity.js';
import { incrementAt, incrementZ, velocityZ } from '../app/engine/velocity.js';

test('LMS increments reproduce WHO published SD columns (all rows, both sexes, 1- and 2-month)', () => {
  let n = 0;
  for (const t of ['w1', 'w2']) for (const s of ['M', 'F']) for (const r of WHO_VELOCITY[t][s]) {
    [-3, -2, -1, 0, 1, 2, 3].forEach((z, i) => { n++; assert.ok(Math.abs(incrementAt(r, z) - r.sd[i]) <= 1.01, `${t} ${s} ${r.label} z=${z}: ${incrementAt(r, z)} vs ${r.sd[i]}`); });
  }
  assert.equal(n, (12 + 23) * 2 * 7);
});

test('median gain scores ~0, a loss scores very low', () => {
  const r = WHO_VELOCITY.w1.M[5];
  assert.ok(Math.abs(incrementZ(r, r.sd[3])) < 0.01);
  assert.ok(velocityZ('M', 152, 183, 0.422).z > -0.2);
  assert.ok(velocityZ('F', 0, 28, -0.1).z < -3);
});
