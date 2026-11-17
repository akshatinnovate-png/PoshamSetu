import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createService } from '../server/index.mjs';

const svc = await createService({ secret: 'test-secret' });
const server = http.createServer(svc.handler);
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('health and signed pack', async () => {
  const h = await (await fetch(base + '/health')).json();
  assert.equal(h.ok, true);
  const p = await (await fetch(base + '/v1/pack')).json();
  assert.equal(p.signatures.length, 2);
});

test('growth webhook requires a valid HMAC and is idempotent', async () => {
  const c = svc.children.find((x) => x.eval.lastValid && x.eval.lastValid.ageMonths > 12);
  const v = c.eval.lastValid;
  const body = JSON.stringify({ beneficiaryRef: c.pseudoId, measuredAt: '2026-11-17T03:00:00Z', weightKg: v.weightKg, heightCm: v.heightCm, muacMm: 112, lying: v.lying });
  assert.equal((await post('/v1/hooks/growth-event', body, { 'x-ps-signature': 'bad' })).status, 401);
  const ok = await post('/v1/hooks/growth-event', body, { 'x-ps-signature': svc.hmac(body) });
  assert.equal(ok.status, 202);
  const r = await ok.json();
  assert.equal(r.tier, 'RED_B');
  assert.ok(r.task && r.task.id);
  const dup = await (await post('/v1/hooks/growth-event', body, { 'x-ps-signature': svc.hmac(body) })).json();
  assert.equal(dup.duplicate, true);
});

test('SMS flash creates a RED-A task; malformed SMS is rejected', async () => {
  const c = svc.children.find((x) => x.eval.lastValid && svc.children.filter((y) => y.pseudoId.endsWith(x.pseudoId.slice(-4))).length === 1);
  const r = await post('/v1/sms', { text: `PS RA ${c.pseudoId.slice(-4)} OED` });
  assert.equal(r.status, 202);
  assert.equal((await r.json()).tier, 'RED_A');
  assert.equal((await post('/v1/sms', { text: 'hello' })).status, 400);
});

test('IVR DTMF closes the ASHA half of a task', async () => {
  const t = svc.tasks.find((x) => x.required.includes('ASHA') && !x.closures.some((c) => c.by === 'ASHA') && !x.closures.some((c) => c.outcome === 'MIGRATED' || c.outcome === 'REFUSED'));
  assert.ok(t, 'a task awaiting the ASHA');
  const r = await (await post('/v1/ivr/dtmf', { taskId: t.id, digits: '1' })).json();
  assert.ok(['PARTIAL', 'CLOSED'].includes(r.state), r.state);
  assert.ok(t.closures.some((c) => c.by === 'ASHA' && c.dtmf === 1));
  assert.equal((await post('/v1/ivr/dtmf', { taskId: t.id, digits: '9' })).status, 400);
});

test('tasks listing is pseudonymous; FHIR read is logged; token lookup by short code', async () => {
  const list = await (await fetch(base + '/v1/tasks?open=1')).json();
  assert.ok(list.count > 0);
  assert.ok(list.tasks.every((t) => /^PT/.test(t.beneficiaryRef) && !('name' in t)));
  const c = svc.children[0];
  const before = svc.audit.entries.length;
  const b = await (await fetch(base + `/v1/children/${c.pseudoId}/fhir`, { headers: { 'x-ps-actor': 'test' } })).json();
  assert.equal(b.resourceType, 'Bundle');
  assert.equal(svc.audit.entries.length, before + 1);
  const tok = [...svc.registry.byShort.values()][0];
  assert.equal((await fetch(base + `/v1/tokens/${tok.short}`)).status, 200);
  assert.equal((await fetch(base + '/v1/tokens/0000-0000-00')).status, 404);
});
