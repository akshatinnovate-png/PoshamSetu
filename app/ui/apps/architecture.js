import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';

const LAYERS = [
  { id: 'L1', t: 'L1 Capture', sub: 'Weight, height, MUAC, oedema as dated events', app: 'capture', files: ['engine/triage.js · buildVisits()', 'ui/apps/capture.js'], body: 'The AWW records in the Tracker as today. Each measurement is an immutable, dated event; two same-day readings that disagree trigger a re-weigh and both stay in the log. Validation happens at entry: implausible values (WHO limits) are caught before save.' },
  { id: 'BR', t: 'Event bridge', sub: 'API Setu webhook · SMS flash · CSV reconcile', app: 'bridge', fix: '01', files: ['engine/bridge.js', 'server/index.mjs'], body: 'Real-time ingestion replaces weekly exports. Idempotent append-only store, per-AWC watermarks, out-of-order detection. The deadline clock runs on measurement time; a late event escalates on arrival and is booked to the pipeline.' },
  { id: 'L2', t: 'L2 Analyse', sub: 'WHO z-scores · trend rules · reliability R · tier', app: 'reliability', fix: '04', files: ['engine/growth.js', 'engine/triage.js', 'engine/reliability.js'], body: 'WHO 2006 LMS z-scores (WAZ, HAZ, WHZ), Rules 1–3, infant velocity, consented signals. Feed reliability R with risk weights; BIV readings quarantined; low-R AMBER/WATCH alerts re-measure first; RED always acts.' },
  { id: 'L3', t: 'L3 Act', sub: 'Task queue · AWW card · ASHA IVR/SMS', app: 'joint', fix: '02', files: ['engine/tasks.js', 'ui/apps/joint.js'], body: 'Tasks with deadlines per tier; visit cap of 2 new AMBER per AWC per month with ranked queue. AMBER closes only when AWW (app) and ASHA (DTMF 1) have both confirmed — in either order, within 7 days.' },
  { id: 'L4', t: 'L4 Govern', sub: 'Deadline clock · escalation · audit chain', app: 'escalation', files: ['engine/tasks.js · escalation()', 'engine/audit.js', 'engine/access.js'], body: 'Table 3 as code: L0 AWW/ASHA → L1 Mukhya Sevika → L2 CDPO + BMO → L3 DPO + CMO. Role-scoped views, names masked above the sector, logged break-glass, k-anonymity above block, hash-chained audit.' },
];
const CROSS = [
  { t: 'ABDM consent gateway (FHIR R4)', sub: 'Only minimal flags, only under a consent artefact', app: 'consent', files: ['engine/consent.js', 'engine/fhir.js'] },
  { t: 'Migration module', sub: 'LTFU 45 d · signed token · eKYC fallback · routes', app: 'migration', fix: '03', files: ['engine/migration.js'] },
  { t: 'Signed rule pack (MoWCD + MoHFW)', sub: 'Version + reason on every alert', app: 'rulepack', files: ['engine/rulepack.js', 'engine/signing.js'] },
];
const THEME = [
  ['Q1 · Interoperability & data flow', 'Event bridge (API Setu), ABDM FHIR R4 flags under consent, migration tokens across states, Baal-ABHA / OTP / assisted consent fallbacks.', ['bridge', 'consent', 'migration']],
  ['Q2 · Decision rights & accountability', 'Table 3 in code: role-scoped views, event-time deadlines, four-level escalation, async joint-visit closure, workload cap.', ['escalation', 'joint', 'worklist']],
  ['Q3 · Data quality & safeguards', 'Entry-time validation, BIV quarantine, weighted R-score, re-measure-first, DPDP-aligned consent, k-anonymity, hash-chained audit.', ['reliability', 'audit', 'consent']],
];

export default {
  id: 'arch', title: 'Architecture — L1 → L4', icon: ICONS.arch, dock: 'Architecture', desk: 'Architecture', size: [1100, 680], key: 'A',
  mount(ctx) {
    let sel = 'BR';
    function render() {
      const W = 1040, H = 300;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'display:block;max-width:1200px;font-family:var(--font-mono)' });
      svg.append(s('defs', null, s('marker', { id: 'arr', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, s('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#1f1b1d' }))));
      const bw = 186, gap = 22;
      LAYERS.forEach((L, i) => {
        const x = 10 + i * (bw + gap), y = 20;
        const g = s('g', { style: 'cursor:pointer' });
        const on = sel === L.id;
        g.append(s('rect', { x: x + 4, y: y + 4, width: bw, height: 96, fill: '#1f1b1d' }), s('rect', { x, y, width: bw, height: 96, fill: on ? '#e94fbf' : L.id === 'BR' ? '#d3e8fb' : '#fff', stroke: '#1f1b1d', 'stroke-width': 2 }));
        g.append(s('text', { x: x + 10, y: y + 22, 'font-size': 14, 'font-weight': 700 }, L.t));
        wrap(L.sub, 26).forEach((ln, k) => g.append(s('text', { x: x + 10, y: y + 42 + k * 13, 'font-size': 10 }, ln)));
        if (L.fix) { g.append(s('rect', { x: x + bw - 62, y: y + 72, width: 54, height: 16, fill: '#1f1b1d' }), s('text', { x: x + bw - 35, y: y + 84, 'font-size': 9.5, fill: '#fff', 'text-anchor': 'middle' }, `FIX ${L.fix}`)); }
        g.addEventListener('click', () => { sel = L.id; render(); });
        svg.append(g);
        if (i < LAYERS.length - 1) svg.append(s('line', { x1: x + bw + 2, y1: y + 48, x2: x + bw + gap - 2, y2: y + 48, stroke: '#1f1b1d', 'stroke-width': 2, 'marker-end': 'url(#arr)' }));
      });
      CROSS.forEach((C, i) => {
        const x = 10 + i * 345, y = 160, w = 330;
        const g = s('g', { style: 'cursor:pointer' });
        const on = sel === 'C' + i;
        g.append(s('rect', { x, y, width: w, height: 70, fill: on ? '#e94fbf' : '#1f1b1d', stroke: '#1f1b1d', 'stroke-width': 2 }));
        g.append(s('text', { x: x + 10, y: y + 22, 'font-size': 12.5, 'font-weight': 700, fill: '#fff' }, C.t));
        g.append(s('text', { x: x + 10, y: y + 42, 'font-size': 10, fill: '#f6c2d1' }, C.sub));
        if (C.fix) g.append(s('text', { x: x + w - 10, y: y + 60, 'font-size': 9.5, fill: '#fff', 'text-anchor': 'end' }, `FIX ${C.fix}`));
        g.addEventListener('click', () => { sel = 'C' + i; render(); });
        svg.append(g);
      });
      svg.append(s('text', { x: 10, y: 150, 'font-size': 10, fill: '#6d6266' }, 'CROSS-CUTTING SERVICES'));
      svg.append(s('text', { x: 10, y: 262, 'font-size': 10, fill: '#6d6266' }, `All of it runs in this app: ${store.sim.district.children.length.toLocaleString('en-IN')} children · ${store.sim.district.history.events.length.toLocaleString('en-IN')} events · ${store.tasks.length} tasks · pack ${store.pack.version}`));
      const item = sel.startsWith('C') ? CROSS[+sel.slice(1)] : LAYERS.find((l) => l.id === sel);
      mount(ctx.body,
        h('div.toolbar', null, h('b', null, 'Left to right is the data flow.'), h('span.small', null, 'Click a block — then open the working module.')),
        h('div', { style: { padding: '12px' } }, svg),
        h('div.row', { style: { padding: '0 12px 12px', gap: '12px', alignItems: 'stretch' } },
          h('div.card.grow', null, h('div.kicker', null, item.fix ? `Audit fix ${item.fix}` : 'Module'), h('div.h2', null, item.t), h('p.p', { style: { marginTop: '6px' } }, item.body || item.sub),
            h('div.row.wrap', { style: { gap: '6px', marginTop: '8px' } }, item.files.map((f) => h('span.tag.dark', null, f))),
            h('button.btn.sm.hot', { style: { marginTop: '10px' }, onclick: () => open(item.app) }, `Open ${item.app} ▸`)),
          h('div.card', { style: { flex: '0 0 440px' } }, h('div.kicker', null, 'Theme 1 — all three questions'),
            THEME.map(([q, a, apps]) => h('div.reason', { style: { gridTemplateColumns: '1fr' } }, h('b', null, q), h('div.small', null, a), h('div.row', { style: { gap: '4px' } }, apps.map((x) => h('button.btn.sm.ghost', { onclick: () => open(x) }, x))))))));
    }
    render();
  },
};

function wrap(t, n) { const out = []; let cur = ''; for (const w of t.split(' ')) { if ((cur + ' ' + w).trim().length > n) { out.push(cur.trim()); cur = w; } else cur += ' ' + w; } if (cur.trim()) out.push(cur.trim()); return out; }
