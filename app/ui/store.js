// App state: the simulated district, the signed rule pack, role/scope, the sim clock,
// live (user-created) events, and the audit chain.
import { generate, NOW, LIVE_FROM, SILENT_FROM } from '../engine/simulate.js';
import { DEFAULT_PACK, signPack, verifyPack } from '../engine/rulepack.js';
import { escalation, makeTask, addClosure } from '../engine/tasks.js';
import { evaluate } from '../engine/triage.js';
import { AuditLog } from '../engine/audit.js';
import { ROLES, inScope } from '../engine/access.js';
import { sampleLagMs, routeFor } from '../engine/bridge.js';
import { rng, DAY, HOUR } from '../engine/util.js';

const listeners = new Map();

export const store = {
  sim: null, pack: DEFAULT_PACK, signed: null, packVerified: null,
  now: NOW, startNow: NOW,
  role: 'CDPO', scope: 'KHU',
  selectedChildId: null,
  breakGlass: new Set(),
  audit: new AuditLog(),
  inflight: [],          // events captured in the app, waiting on the bridge
  liveSeq: 0,
  silentMode: false,     // when true, alerts are logged but not shown (silent trial)
  rnd: rng(9001),
  consts: { NOW, LIVE_FROM, SILENT_FROM },

  on(evt, fn) { if (!listeners.has(evt)) listeners.set(evt, new Set()); listeners.get(evt).add(fn); return () => listeners.get(evt).delete(fn); },
  emit(evt, data) { for (const fn of listeners.get(evt) || []) { try { fn(data); } catch (e) { console.error(e); } } },

  async init(progress) {
    progress?.('signing rule pack (MoWCD + MoHFW, Ed25519)');
    this.signed = await signPack(this.pack);
    this.packVerified = await verifyPack(this.signed);
    progress?.('generating synthetic district — 3 blocks, 36 AWCs, 1,440 children');
    await tick();
    this.sim = generate({ pack: this.pack });
    this.childById = Object.fromEntries(this.sim.district.children.map((c) => [c.id, c]));
    this.awcById = this.sim.awcById;
    this.sectorById = Object.fromEntries(this.sim.district.sectors.map((s) => [s.id, s]));
    this.blockById = Object.fromEntries(this.sim.district.blocks.map((b) => [b.id, b]));
    this.tasks = this.sim.tasks;
    this.audit.append({ at: this.now, actor: 'system', role: 'SYSTEM', action: 'PACK_ACTIVATED', subject: `${this.pack.id}@${this.pack.version}`, detail: 'Verified dual signature MoWCD + MoHFW' });
    progress?.('engine ready');
  },

  /** Activate a dual-signed pack: future evaluations use it; past alerts keep the version that produced them. */
  async activatePack(signed) {
    const v = await verifyPack(signed);
    if (!v.ok) throw new Error('pack signatures invalid');
    const prev = this.pack.version;
    this.signed = signed; this.packVerified = v; this.pack = signed.pack;
    for (const c of this.sim.district.children) {
      const ev = evaluate(c, c.events, c.signals, this.pack, { feedR: this.sim.feeds[c.awcId].R });
      c.eval = ev; c.current = ev.current;
    }
    this.audit.append({ at: this.now, actor: 'MoWCD + MoHFW', role: 'MINISTRY', action: 'PACK_ACTIVATED', subject: `${this.pack.id}@${this.pack.version}`, detail: `supersedes ${prev}` });
    this.emit('pack'); this.emit('role');
  },
  setRole(role, scope) {
    this.role = role;
    this.scope = scope ?? this.defaultScope(role);
    this.audit.append({ at: this.now, actor: this.actorName(), role, action: 'SESSION', subject: this.scope });
    this.emit('role');
  },
  defaultScope(role) {
    const d = this.sim.district;
    const sc = ROLES[role].scope;
    if (sc === 'awc') return d.awcs[0].id;
    if (sc === 'sector') return d.sectors[0].id;
    if (sc === 'block') return d.blocks[0].id;
    return 'DISTRICT';
  },
  scopeLabel() {
    const sc = ROLES[this.role].scope;
    if (sc === 'awc') { const a = this.awcById[this.scope]; return `AWC ${a.name} · ${a.code}`; }
    if (sc === 'sector') return this.sectorById[this.scope].name;
    if (sc === 'block') return `${this.blockById[this.scope].name} block`;
    return 'Paschimi Singhbhum district';
  },
  actorName() {
    const sc = ROLES[this.role].scope;
    if (this.role === 'AWW') return this.awcById[this.scope].aww;
    if (this.role === 'ASHA') return this.awcById[this.scope].asha;
    if (sc === 'sector') return this.sectorById[this.scope].mukhyaSevika;
    if (sc === 'block') return this.blockById[this.scope].cdpo;
    return 'District Programme Officer';
  },
  inScope(child) { return inScope(this.role, this.scope, child, this.awcById); },
  children() { return this.sim.district.children.filter((c) => this.inScope(c)); },
  scopedTasks() { return this.tasks.filter((t) => this.inScope(this.childById[t.childId]) && t.ingestedAt <= this.now); },
  esc(task) { return escalation(task, this.now, this.pack); },

  selectChild(id, why = 'VIEW') {
    this.selectedChildId = id;
    this.audit.append({ at: this.now, actor: this.actorName(), role: this.role, action: why, subject: id });
    this.emit('child', id);
  },
  grantBreakGlass(id, reason) {
    this.breakGlass.add(id);
    this.audit.append({ at: this.now, actor: this.actorName(), role: this.role, action: 'BREAK_GLASS', subject: id, detail: reason });
    this.emit('child', id);
  },

  advance(ms) {
    const before = this.now;
    this.now += ms;
    // deliver in-flight bridge events whose arrival time has passed
    const arrived = this.inflight.filter((x) => x.receivedAt <= this.now);
    this.inflight = this.inflight.filter((x) => x.receivedAt > this.now);
    for (const a of arrived) this.ingest(a);
    // detect new escalations
    for (const t of this.tasks) {
      const e1 = escalation(t, before, this.pack), e2 = escalation(t, this.now, this.pack);
      if (e2.open && e2.level > e1.level && t.ingestedAt <= this.now) this.emit('escalated', { task: t, esc: e2 });
    }
    this.emit('tick', this.now);
  },
  resetClock() { this.now = this.startNow; this.emit('tick', this.now); },

  /** Capture a new measurement in the app (AWW device) and send it through the bridge. */
  capture(childId, m, mode = 'ROUND2') {
    const c = this.childById[childId];
    const e = { id: `L${++this.liveSeq}`, childId, awcId: c.awcId, t: m.t ?? this.now, by: 'AWW', ...m };
    const routes = routeFor(e, mode);
    let best = null;
    for (const r of routes) {
      const lag = sampleLagMs(r, this.rnd) * (mode === 'ROUND2' && this.awcById[c.awcId].connectivity === 'poor' && r === 'API_SETU' ? 2 : 1);
      if (!best || lag < best.lag) best = { adapter: r, lag };
    }
    const rec = { event: e, adapter: best.adapter, receivedAt: Math.max(this.now, e.t) + best.lag * (e.t < this.now - 3600000 ? 0.1 : 1), routes };
    this.inflight.push(rec);
    this.audit.append({ at: this.now, actor: this.actorName(), role: this.role, action: 'CAPTURE', subject: childId, detail: `${best.adapter} ETA ${Math.round(best.lag / 60000)} min` });
    this.emit('inflight', rec);
    if (rec.receivedAt <= this.now) this.advance(0);
    return rec;
  },
  ingest(rec) {
    const c = this.childById[rec.event.childId];
    rec.event.receivedAt = rec.receivedAt;
    rec.event.adapter = rec.adapter;
    c.events = [...c.events, rec.event];
    const ev = evaluate(c, c.events, c.signals, this.pack, { feedR: this.sim.feeds[c.awcId].R });
    c.eval = ev; c.current = ev.current; c.lastMeasuredAt = ev.lastValid ? ev.lastValid.t : c.lastMeasuredAt;
    const res = ev.current;
    let task = null;
    if (res && res.tier !== 'GREEN' && (res.kind === 'NEW' || res.kind === 'WORSENING' || res.remeasure)) {
      task = makeTask({ child: c, result: res, pack: this.pack, ingestedAt: rec.receivedAt, id: `T-LIVE-${this.liveSeq}` });
      this.tasks.unshift(task);
    }
    this.audit.append({ at: rec.receivedAt, actor: 'bridge', role: 'SYSTEM', action: 'INGEST', subject: c.id, detail: `${rec.adapter} lag ${Math.round((rec.receivedAt - rec.event.t) / 60000)} min → ${res?.tier}` });
    this.emit('ingested', { rec, child: c, task });
  },
  close(task, closure) {
    addClosure(task, closure, this.pack);
    this.audit.append({ at: closure.t, actor: closure.by === 'ASHA' ? this.awcById[task.awcId].asha : this.awcById[task.awcId].aww, role: closure.by, action: 'CLOSE', subject: task.id, detail: closure.dtmf ? `DTMF ${closure.dtmf}` : closure.outcome });
    this.emit('task', task);
  },
};

const tick = () => new Promise((r) => setTimeout(r, 0));
export { DAY, HOUR };
