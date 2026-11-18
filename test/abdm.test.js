import test from 'node:test';
import assert from 'node:assert/strict';
import { runHieFlow, hipBundle, extractFlags } from '../app/engine/abdm.js';

const child = { pseudoId: 'PT204100009999', sex: 'F', dob: Date.UTC(2025, 0, 1), lbw: true };
const vaccines = [{ antigen: 'MR-1', due: Date.UTC(2025, 9, 1), given: null }, { antigen: 'Penta-1', due: Date.UTC(2025, 1, 12), given: Date.UTC(2025, 1, 14) }];
const signals = [{ type: 'DIARRHOEA', t: Date.UTC(2026, 9, 20) }];

test('HIE flow: real X25519 + AES-GCM round trip, checksum OK, only minimal flags kept', async () => {
  const bundle = hipBundle(child, vaccines, signals);
  const r = await runHieFlow({ child, fhirBundle: bundle, now: Date.UTC(2026, 10, 17) });
  assert.equal(r.status, 'TRANSFERRED');
  assert.equal(r.checksumOk, true);
  assert.deepEqual(r.flags.map((f) => f.type).sort(), ['DIARRHOEA', 'LBW', 'VACCINE_OVERDUE']);
  const apis = r.log.map((m) => m.api);
  for (const a of ['POST /v0.5/consent-requests/init', 'POST /v0.5/consents/hiu/notify', 'POST /v0.5/health-information/cm/request', 'POST /v0.5/health-information/notify']) assert.ok(apis.includes(a), a);
  const push = r.log.find((m) => m.api.includes('transfer')).payload;
  assert.ok(!push.entries[0].content.includes('Diarrhea'), 'payload must be ciphertext');
});

test('HIE flow: guardian denies → no artefact, no data', async () => {
  const r = await runHieFlow({ child, fhirBundle: hipBundle(child, vaccines, signals), now: Date.UTC(2026, 10, 17), approve: false });
  assert.equal(r.status, 'DENIED');
  assert.equal(r.flags.length, 0);
  assert.ok(!r.log.some((m) => m.api.includes('transfer')));
});

test('flag extraction respects the consented flag list', () => {
  const f = extractFlags(hipBundle(child, vaccines, signals), ['VACCINE_OVERDUE']);
  assert.deepEqual(f.map((x) => x.type), ['VACCINE_OVERDUE']);
});
