// PoshanSetu companion service — the same engine as the desktop console, behind the integration
// contracts a pilot would use. No dependencies: node:http + node:crypto.
//
//   GET  /health
//   GET  /v1/pack                         signed rule pack (MoWCD + MoHFW)
//   POST /v1/hooks/growth-event           Tracker webhook (HMAC-SHA256 in X-PS-Signature), idempotent
//   POST /v1/sms                          RED flash: "PS RA <ref4> <OED|DNG|MUC>"
//   POST /v1/ivr/dtmf                     CPaaS callback: { taskId, digits }
//   GET  /v1/tasks?awc=<code>&open=1      tasks with escalation state (pseudonymous)
//   GET  /v1/children/:pseudoId/fhir      FHIR R4 WellnessRecord bundle (consent-gated)
//   GET  /v1/tokens/:shortCode            transfer-token lookup (IVR short code)
//
// Run: node server/index.mjs   (PORT, PS_HMAC_SECRET env vars)
import http from 'node:http';
import crypto from 'node:crypto';
import { generate, NOW } from '../app/engine/simulate.js';
import { DEFAULT_PACK, signPack } from '../app/engine/rulepack.js';
import { evaluate } from '../app/engine/triage.js';
import { makeTask, addClosure, escalation } from '../app/engine/tasks.js';
import { EventStore } from '../app/engine/bridge.js';
import { wellnessBundle } from '../app/engine/fhir.js';
import { consentStatus } from '../app/engine/consent.js';
import { issueToken, tokenPayload, MigrationRegistry } from '../app/engine/migration.js';
import { AuditLog } from '../app/engine/audit.js';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const APP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.webmanifest': 'application/manifest+json' };
function serveStatic(p, res) {
  const rel = decodeURIComponent(p).replace(/^\/+/, '') || 'index.html';
  const f = path.normalize(path.join(APP_DIR, rel.endsWith('/') ? rel + 'index.html' : rel));
  if (!f.startsWith(APP_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}

export async function createService({ secret = process.env.PS_HMAC_SECRET || 'demo-shared-secret', clock = () => NOW } = {}) {
  const pack = DEFAULT_PACK;
  const signed = await signPack(pack);
  const sim = generate({ pack });
  const children = sim.district.children;
  const byPseudo = new Map(children.map((c) => [c.pseudoId, c]));
  const tasks = sim.tasks;
  const store = new EventStore();
  for (const e of sim.district.history.events) store.append(e, e.receivedAt ?? e.t, e.adapter || 'HISTORY');
  const audit = new AuditLog();
  const registry = new MigrationRegistry();
  for (const c of children.filter((x) => x.migration?.announced)) {
    const tok = await issueToken(tokenPayload(c, c.eval.visits, c.current, { now: c.migration.depAt, validityDays: pack.migration.tokenValidityDays, destination: c.migration.destination.id }));
    registry.register(tok, c.uidToken);
  }
  let seq = 0;
  const seenDevice = new Set();

  const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const readBody = (req) => new Promise((resolve, reject) => { let b = ''; req.on('data', (d) => { b += d; if (b.length > 1e6) reject(new Error('too large')); }); req.on('end', () => resolve(b)); });
  const hmac = (body) => crypto.createHmac('sha256', secret).update(body).digest('hex');
  const safeEq = (a, b) => a && b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

  function ingest(c, m, adapter) {
    const now = clock();
    const e = { id: `S${++seq}`, childId: c.id, awcId: c.awcId, by: 'AWW', ...m, t: m.t ?? now };
    const r = store.append(e, now, adapter);
    if (!r.accepted) return { accepted: false, duplicate: true };
    c.events = [...c.events, { ...e, receivedAt: now, adapter }];
    const ev = evaluate(c, c.events, c.signals, pack, { feedR: sim.feeds[c.awcId].R });
    c.eval = ev; c.current = ev.current;
    let task = null;
    const res = ev.current;
    if (res && res.tier !== 'GREEN' && (res.kind === 'NEW' || res.kind === 'WORSENING' || res.remeasure)) {
      task = makeTask({ child: c, result: res, pack, ingestedAt: now, id: `T-SVC-${seq}` });
      tasks.unshift(task);
    }
    audit.append({ at: now, actor: adapter, role: 'SYSTEM', action: 'INGEST', subject: c.pseudoId, detail: res?.tier });
    return { accepted: true, key: r.key, tier: res?.tier, reasons: res?.reasons.filter((x) => x.tier === res.tier).map((x) => x.text), packVersion: pack.version, task: task && { id: task.id, dueAt: new Date(task.dueAt).toISOString(), lateArrival: escalation(task, now, pack).lateArrival } };
  }

  const handler = async (req, res) => {
    try {
      const u = new URL(req.url, 'http://x');
      const p = u.pathname;
      res.setHeader('access-control-allow-origin', '*');
      res.setHeader('access-control-allow-headers', 'content-type, x-ps-device, x-ps-signature, x-ps-actor');
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

      // AWW device sync (PWA): batch of measurements made offline, idempotent by device event id.
      if (req.method === 'POST' && p === '/v1/device/events') {
        const device = req.headers['x-ps-device'];
        if (!device) return json(res, 401, { error: 'missing x-ps-device' });
        const { events = [] } = JSON.parse(await readBody(req));
        const results = [];
        for (const ev of events.slice(0, 500)) {
          if (seenDevice.has(ev.id)) { results.push({ id: ev.id, duplicate: true }); continue; }
          const c = byPseudo.get(ev.beneficiaryRef);
          if (!c || sim.awcById[c.awcId].code !== device) { results.push({ id: ev.id, accepted: false, error: 'beneficiary not in this AWC' }); continue; }
          const r = ingest(c, { t: Date.parse(ev.measuredAt), weightKg: ev.weightKg, heightCm: ev.heightCm, muacMm: ev.muacMm ?? null, oedema: !!ev.oedema, danger: ev.danger || [], lying: ev.lying }, 'DEVICE_SYNC');
          seenDevice.add(ev.id);
          results.push({ id: ev.id, ...r });
        }
        return json(res, 200, { results });
      }
      if (req.method === 'GET' && p === '/health') return json(res, 200, { ok: true, pack: `${pack.id}@${pack.version}`, children: children.length, events: store.events.length });
      if (req.method === 'GET' && p === '/v1/pack') return json(res, 200, signed);

      if (req.method === 'POST' && p === '/v1/hooks/growth-event') {
        const body = await readBody(req);
        if (!safeEq(req.headers['x-ps-signature'], hmac(body))) return json(res, 401, { error: 'bad signature' });
        const m = JSON.parse(body);
        const c = byPseudo.get(m.beneficiaryRef);
        if (!c) return json(res, 404, { error: 'unknown beneficiary' });
        const t = m.measuredAt ? Date.parse(m.measuredAt) : undefined;
        return json(res, 202, ingest(c, { t, weightKg: m.weightKg, heightCm: m.heightCm, muacMm: m.muacMm ?? null, oedema: !!m.oedema, danger: m.danger || [], lying: m.lying }, 'API_SETU'));
      }

      if (req.method === 'POST' && p === '/v1/sms') {
        const { text } = JSON.parse(await readBody(req));
        const mt = /^PS\s+RA\s+(\d{4})\s+(OED|DNG|MUC)$/i.exec((text || '').trim());
        if (!mt) return json(res, 400, { error: 'format: PS RA <last 4 of beneficiary ref> <OED|DNG|MUC>' });
        const matches = children.filter((c) => c.pseudoId.endsWith(mt[1]));
        if (matches.length !== 1) return json(res, 409, { error: 'ambiguous or unknown ref — call back via IVR', candidates: matches.length });
        const c = matches[0];
        const v = c.eval.lastValid || {};
        const code = mt[2].toUpperCase();
        return json(res, 202, ingest(c, { weightKg: v.weightKg, heightCm: v.heightCm, lying: v.lying, muacMm: code === 'MUC' ? 110 : v.muacMm, oedema: code === 'OED', danger: code === 'DNG' ? ['LETHARGIC'] : [] }, 'SMS_FLASH'));
      }

      if (req.method === 'POST' && p === '/v1/ivr/dtmf') {
        const { taskId, digits } = JSON.parse(await readBody(req));
        const t = tasks.find((x) => x.id === taskId);
        if (!t) return json(res, 404, { error: 'unknown task' });
        if (!['1', '2', '3', '4'].includes(String(digits))) return json(res, 400, { error: 'digits must be 1-4' });
        addClosure(t, { by: 'ASHA', t: clock(), dtmf: Number(digits), channel: 'IVR' }, pack);
        audit.append({ at: clock(), actor: 'cpaas', role: 'ASHA', action: 'CLOSE', subject: t.id, detail: `DTMF ${digits}` });
        const e = escalation(t, clock(), pack);
        return json(res, 200, { taskId, state: e.state, missing: e.missing || [], open: e.open });
      }

      if (req.method === 'GET' && p === '/v1/tasks') {
        const awc = u.searchParams.get('awc');
        const onlyOpen = u.searchParams.get('open') === '1';
        const now = clock();
        const out = tasks.filter((t) => (!awc || sim.awcById[t.awcId].code === awc) && t.ingestedAt <= now)
          .map((t) => ({ t, e: escalation(t, now, pack) })).filter((x) => !onlyOpen || x.e.open)
          .map(({ t, e }) => ({ id: t.id, beneficiaryRef: children.find((c) => c.id === t.childId).pseudoId, awc: sim.awcById[t.awcId].code, tier: t.tier, measuredAt: new Date(t.measuredAt).toISOString(), dueAt: new Date(t.dueAt).toISOString(), state: e.state, level: e.level, lateArrival: e.lateArrival, packVersion: t.packVersion, reason: t.reasons[0] }));
        return json(res, 200, { count: out.length, tasks: out });
      }

      let mt;
      if (req.method === 'GET' && (mt = /^\/v1\/children\/([^/]+)\/fhir$/.exec(p))) {
        const c = byPseudo.get(mt[1]);
        if (!c) return json(res, 404, { error: 'unknown beneficiary' });
        const cs = consentStatus(c.consent, clock());
        audit.append({ at: clock(), actor: req.headers['x-ps-actor'] || 'anonymous', role: 'HIU', action: 'FHIR_READ', subject: c.pseudoId });
        res.writeHead(200, { 'content-type': 'application/fhir+json' });
        return res.end(JSON.stringify(wellnessBundle(c, c.eval.visits, c.current, cs.usable ? c.consent : null)));
      }
      if (req.method === 'GET' && (mt = /^\/v1\/tokens\/([0-9A-Za-z-]+)$/.exec(p))) {
        const tok = registry.lookupShort(mt[1], 'IVR');
        return tok ? json(res, 200, { qr: tok.qr, short: tok.short, home: tok.payload.h, tier: tok.payload.t }) : json(res, 404, { error: 'unknown or mistyped short code' });
      }
      // Static app (console at /, AWW PWA at /pwa/) so a phone on the same network can use it.
      if (req.method === 'GET' && !p.startsWith('/v1/')) return serveStatic(p, res);
      json(res, 404, { error: 'not found' });
    } catch (e) {
      json(res, 400, { error: e.message });
    }
  };
  return { handler, hmac, sim, tasks, audit, registry, children };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const svc = await createService();
  const port = Number(process.env.PORT || 8080);
  http.createServer(svc.handler).listen(port, '0.0.0.0', async () => {
    const os = await import('node:os');
    const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
    console.log(`PoshanSetu service on http://localhost:${port}  (console /, AWW app /pwa/, API /v1/…)`);
    if (lan) console.log(`On a phone on the same Wi-Fi: http://${lan}:${port}/pwa/`);
  });
}
