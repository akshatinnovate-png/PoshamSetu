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
import { gateSignals, FLAG_DICTIONARY } from '../engine/consent.js';
import { castStory } from '../engine/story.js';

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
  seed: 71100,
  journal: [],          // event-sourced user actions, persisted and replayed on boot
  replaying: false,
  consts: { NOW, LIVE_FROM, SILENT_FROM },

  on(evt, fn) { if (!listeners.has(evt)) listeners.set(evt, new Set()); listeners.get(evt).add(fn); return () => listeners.get(evt).delete(fn); },
  emit(evt, data) { for (const fn of listeners.get(evt) || []) { try { fn(data); } catch (e) { console.error(e); } } },

  async init(progress) {
    progress?.('signing rule pack (MoWCD + MoHFW, Ed25519)');
    this.signed = await signPack(this.pack);
    this.packVerified = await verifyPack(this.signed);
    progress?.('generating synthetic district — 3 blocks, 36 AWCs, 1,440 children');
    await tick();
    this.sim = generate({ pack: this.pack, seed: this.seed });
    this.story = castStory(this.sim, this.pack);
    this.childById = Object.fromEntries(this.sim.district.children.map((c) => [c.id, c]));
    this.awcById = this.sim.awcById;
    this.sectorById = Object.fromEntries(this.sim.district.sectors.map((s) => [s.id, s]));
    this.blockById = Object.fromEntries(this.sim.district.blocks.map((b) => [b.id, b]));
    this.tasks = this.sim.tasks;
    this.scope = this.defaultScope(this.role);
    this.audit.append({ at: this.now, actor: 'system', role: 'SYSTEM', action: 'PACK_ACTIVATED', subject: `${this.pack.id}@${this.pack.version}`, detail: 'Verified dual signature MoWCD + MoHFW' });
    const saved = await loadJournal();
    if (saved.length) {
      progress?.(`restoring saved session — replaying ${saved.length} action(s)`);
      await this.replay(saved);
    }
    progress?.('engine ready');
  },

  // ---------- persistence: an append-only journal of user actions ----------
  record(op) { if (this.replaying) return; this.journal.push(op); saveJournal(this.journal); },
  async replay(ops) {
    this.replaying = true;
    for (const o of ops) {
      try {
        if (o.op === 'capture') this.capture(o.childId, o.m, o.mode);
        else if (o.op === 'advance') this.advance(o.ms);
        else if (o.op === 'reset') this.resetClock();
        else if (o.op === 'role') this.setRole(o.role, o.scope);
        else if (o.op === 'close') { const t = this.tasks.find((x) => x.id === o.taskId); if (t) this.close(t, o.closure); }
        else if (o.op === 'milestone') this.milestone(o.taskId, o.kind, o.result);
        else if (o.op === 'promote') this.promote(o.taskId, o.reason);
        else if (o.op === 'breakGlass') this.grantBreakGlass(o.id, o.reason);
        else if (o.op === 'consent') this.applyConsent(o.childId, o.kind, o.mode);
        else if (o.op === 'pack') await this.activatePack(o.signed);
        else if (o.op === 'regenerate') this.regenerate(o.seed);
        else if (o.op === 'log') this.audit.append(o.e);
      } catch (e) { console.warn('replay skipped', o.op, e.message); }
    }
    this.journal = ops.slice();
    this.replaying = false;
  },
  clearSaved() { this.journal = []; saveJournal([]); },

  milestone(taskId, kind, result) {
    const t = this.tasks.find((x) => x.id === taskId); if (!t) return;
    this.record({ op: 'milestone', taskId, kind, result });
    t.milestones.push({ kind, t: this.now, result });
    this.audit.append({ at: this.now, actor: this.awcById[t.awcId].aww, role: 'AWW', action: kind, subject: t.id, detail: result });
    this.emit('task', t);
  },
  promote(taskId, reason) {
    const t = this.tasks.find((x) => x.id === taskId); if (!t) return;
    this.record({ op: 'promote', taskId, reason });
    t.queued = false; t.dueAt = t.measuredAt + this.pack.jointVisit.windowDays * DAY; t.required = ['AWW', 'ASHA'];
    this.audit.append({ at: this.now, actor: this.actorName(), role: this.role, action: 'CAP_OVERRIDE', subject: t.id, detail: reason });
    this.emit('task', t);
  },
  /** Guardian consent change: grant (mode), renew, or revoke — rules re-run with or without the flags. */
  applyConsent(childId, kind, mode = 'OTP') {
    const c = this.childById[childId]; if (!c) return null;
    this.record({ op: 'consent', childId, kind, mode });
    const before = c.current?.tier;
    if (kind === 'revoke' && c.consent) c.consent.revokedAt = this.now;
    if (kind === 'renew' && c.consent) { c.consent.revokedAt = null; c.consent.expiresAt = this.now + 180 * DAY; c.consent.reconfirmedAt = this.now; }
    if (kind === 'grant') c.consent = { id: `CA-${c.id}-N`, childId: c.id, guardian: c.mother, mode, purpose: { code: 'CAREMGT', text: 'Care management — early warning of child undernutrition' }, hiTypes: ['WellnessRecord', 'ImmunizationRecord'], hip: 'U-WIN / RCH (MoHFW)', hiu: 'PoshanSetu (MoWCD)', flags: Object.keys(FLAG_DICTIONARY), grantedAt: this.now, expiresAt: this.now + 180 * DAY, reconfirmBy: mode === 'ASSISTED' ? this.now + 30 * DAY : null, reconfirmedAt: null, revokedAt: null };
    const g = gateSignals(c.signalsRaw, c.consent, this.now);
    c.signals = kind === 'revoke' ? [] : g.allowed;
    c.signalsWithheld = kind === 'revoke' ? c.signalsRaw.map((x) => ({ ...x, why: 'Guardian revoked consent' })) : g.withheld;
    const ev = evaluate(c, c.events, c.signals, this.pack, { feedR: this.sim.feeds[c.awcId].R });
    c.eval = ev; c.current = ev.current;
    this.audit.append({ at: this.now, actor: this.actorName(), role: this.role, action: 'CONSENT_' + kind.toUpperCase(), subject: c.id, detail: c.consent?.id });
    this.emit('child', c.id);
    return { before, after: c.current?.tier };
  },

  /** Activate a dual-signed pack: future evaluations use it; past alerts keep the version that produced them. */
  async activatePack(signed) {
    const v = await verifyPack(signed);
    if (!v.ok) throw new Error('pack signatures invalid');
    this.record({ op: 'pack', signed });
    const prev = this.pack.version;
    this.signed = signed; this.packVerified = v; this.pack = signed.pack;
    for (const c of this.sim.district.children) {
      const ev = evaluate(c, c.events, c.signals, this.pack, { feedR: this.sim.feeds[c.awcId].R });
      c.eval = ev; c.current = ev.current;
    }
    this.audit.append({ at: this.now, actor: 'MoWCD + MoHFW', role: 'MINISTRY', action: 'PACK_ACTIVATED', subject: `${this.pack.id}@${this.pack.version}`, detail: `supersedes ${prev}` });
    this.emit('pack'); this.emit('role');
  },
  /** Regenerate the whole synthetic district with a new seed (shows nothing is hard-coded). */
  regenerate(seed) {
    this.record({ op: 'regenerate', seed });
    this.seed = seed;
    this.sim = generate({ pack: this.pack, seed });
    this.story = castStory(this.sim, this.pack);
    this.childById = Object.fromEntries(this.sim.district.children.map((c) => [c.id, c]));
    this.awcById = this.sim.awcById;
    this.sectorById = Object.fromEntries(this.sim.district.sectors.map((s) => [s.id, s]));
    this.blockById = Object.fromEntries(this.sim.district.blocks.map((b) => [b.id, b]));
    this.tasks = this.sim.tasks; this.inflight = []; this.now = this.startNow; this.breakGlass = new Set();
    this.scope = this.defaultScope(this.role);
    this.audit.append({ at: this.now, actor: 'system', role: 'SYSTEM', action: 'REGENERATE', subject: `seed ${seed}` });
    this.emit('regenerated'); this.emit('role'); this.emit('tick', this.now);
  },
  setRole(role, scope) {
    this.record({ op: 'role', role, scope });
    this.role = role;
    this.scope = scope ?? this.defaultScope(role);
    this.audit.append({ at: this.now, actor: this.actorName(), role, action: 'SESSION', subject: this.scope });
    this.emit('role');
  },
  defaultScope(role) {
    const d = this.sim.district;
    const sc = ROLES[role].scope, st = this.story;
    // Default scopes follow Riya's story: Kamla's AWC, Basanti's sector, Anita's block.
    if (sc === 'awc') return st?.awcId || d.awcs[0].id;
    if (sc === 'sector') return st?.sectorId || d.sectors[0].id;
    if (sc === 'block') return st?.blockId || d.blocks[0].id;
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

  /** Append a user-initiated audit entry and journal it, so a restart replays to the same chain head. */
  log(entry) {
    const e = { ...entry, at: entry.at ?? this.now };
    this.record({ op: 'log', e });
    return this.audit.append(e);
  },
  selectChild(id, why = 'VIEW') {
    this.selectedChildId = id;
    this.log({ actor: this.actorName(), role: this.role, action: why, subject: id });
    this.emit('child', id);
  },
  grantBreakGlass(id, reason) {
    this.record({ op: 'breakGlass', id, reason });
    this.breakGlass.add(id);
    this.audit.append({ at: this.now, actor: this.actorName(), role: this.role, action: 'BREAK_GLASS', subject: id, detail: reason });
    this.emit('child', id);
  },

  advance(ms) {
    if (ms) this.record({ op: 'advance', ms });
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
  resetClock() { this.record({ op: 'reset' }); this.now = this.startNow; this.emit('tick', this.now); },

  /** Capture a new measurement in the app (AWW device) and send it through the bridge. */
  capture(childId, m, mode = 'ROUND2') {
    m = { ...m, t: m.t ?? this.now };
    this.record({ op: 'capture', childId, m, mode });
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
    this.record({ op: 'close', taskId: task.id, closure });
    addClosure(task, closure, this.pack);
    this.audit.append({ at: closure.t, actor: closure.by === 'ASHA' ? this.awcById[task.awcId].asha : this.awcById[task.awcId].aww, role: closure.by, action: 'CLOSE', subject: task.id, detail: closure.dtmf ? `DTMF ${closure.dtmf}` : closure.outcome });
    this.emit('task', task);
  },
};

const tick = () => new Promise((r) => setTimeout(r, 0));
const KEY = 'ps-os1-journal-v1';
async function loadJournal() {
  try {
    if (globalThis.window?.psNative?.loadState) { const s = await window.psNative.loadState(); return Array.isArray(s) ? s : []; }
    const s = globalThis.localStorage?.getItem(KEY); return s ? JSON.parse(s) : [];
  } catch { return []; }
}
let saveTimer = null;
function saveJournal(ops) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      if (globalThis.window?.psNative?.saveState) window.psNative.saveState(ops);
      else globalThis.localStorage?.setItem(KEY, JSON.stringify(ops));
    } catch {}
  }, 150);
}
export { DAY, HOUR };
