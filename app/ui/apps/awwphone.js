// The AWW's phone: offline-first. Measurements made without signal queue on the device with their
// real measurement time; when signal returns they sync, and every clock still counts from measurement.
import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { nameOf, ageLabel, ageAt, fmtDuration, HOUR } from '../common.js';
import { TIER_LABEL } from '../../engine/rulepack.js';

const COL = { RED_A: '#c8102e', RED_B: '#f0542d', AMBER: '#f2a20c', WATCH: '#3f7fe0', GREEN: '#1f9d6b' };
const queue = [];
let online = true;

export default {
  id: 'awwphone', title: 'AWW phone — offline-first', icon: ICONS.phone, dock: 'AWW phone', desk: 'AWW phone', size: [420, 760], key: 'f',
  mount(ctx) {
    let sel = null, form = null, msg = '';
    function awc() {
      if (store.role === 'AWW' || store.role === 'ASHA') return store.awcById[store.scope];
      return store.awcById[store.children()[0]?.awcId] || store.sim.district.awcs[0];
    }
    function render() {
      const a = awc();
      const kids = store.sim.district.children.filter((c) => c.awcId === a.id && c.current && (store.now - c.dob) / 86400000 / 30.44 < 60);
      const todo = kids.filter((c) => c.current.tier !== 'GREEN').sort((x, y) => ['RED_A', 'RED_B', 'AMBER', 'WATCH'].indexOf(x.current.tier) - ['RED_A', 'RED_B', 'AMBER', 'WATCH'].indexOf(y.current.tier));
      const screen = h('div', { style: { background: '#fff', border: '2px solid var(--ink)', height: '560px', overflow: 'auto', display: 'flex', flexDirection: 'column' } },
        h('div.row.between', { style: { background: 'var(--ink)', color: '#fff', padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: '11px' } },
          h('span', null, new Date(store.now + 5.5 * HOUR).toISOString().slice(11, 16)),
          h('span', null, online ? '▂▄▆ 4G' : '✕ no signal'),
          h('span', null, `queue ${queue.length}`)),
        h('div', { style: { padding: '8px 10px', background: 'var(--pink-2)', borderBottom: '2px solid var(--ink)' } },
          h('div', { style: { fontWeight: 800, fontSize: '16px' } }, `AWC ${a.name}`), h('div.small.mono', null, `${a.aww} · ${kids.length} children`)),
        form ? formView(form) : h('div', { style: { padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' } },
          h('div', { style: { fontFamily: 'Noto Sans Devanagari', fontWeight: 700 } }, 'आज का काम · today'),
          todo.slice(0, 20).map((c) => h('div', { onclick: () => { form = { id: c.id, w: c.eval.lastValid?.weightKg ?? '', m: c.eval.lastValid?.muacMm ?? '', oed: false }; render(); }, style: { border: '2px solid var(--ink)', borderLeft: `10px solid ${COL[c.current.tier]}`, padding: '6px 8px', cursor: 'pointer' } },
            h('div.row.between', null, h('b', null, nameOf(c)), h('span.mono.small', null, TIER_LABEL[c.current.tier])),
            h('div.small.muted', null, `${ageLabel(ageAt(c, store.now))} · ${c.current.reasons.find((r) => r.tier === c.current.tier)?.text || ''}`))),
          msg ? h('div.callout', null, msg) : null));
      mount(ctx.body, h('div', { style: { padding: '14px', background: 'var(--paper-2)', minHeight: '100%' } },
        h('div', { style: { background: '#2b2427', borderRadius: '26px', padding: '20px 12px 26px', boxShadow: 'var(--shadow)' } }, screen),
        h('div.row', { style: { marginTop: '12px', gap: '8px', flexWrap: 'wrap' } },
          h('div.seg', null, [[true, 'Online'], [false, 'Offline']].map(([v, l]) => h('button', { class: online === v ? 'on' : '', onclick: () => { online = v; if (v) flush(); render(); } }, l))),
          h('button.btn.sm.ghost', { onclick: () => store.advance(6 * HOUR) }, '+6 h'),
          h('span.small.mono', null, `${queue.length} waiting on device`)),
        h('div.small.muted', { style: { marginTop: '6px' } }, 'Offline: tap a child, record, save — it queues with the measurement time. Switch to Online after a few hours: it syncs, and the deadline is still counted from when you weighed.')));
    }
    function formView(f) {
      const c = store.childById[f.id];
      return h('div', { style: { padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' } },
        h('b', null, nameOf(c)),
        h('label.field', null, 'वज़न kg', h('input.input', { type: 'number', step: '0.1', value: f.w, oninput: (e) => (f.w = e.target.value) })),
        h('label.field', null, 'MUAC mm', h('input.input', { type: 'number', value: f.m, oninput: (e) => (f.m = e.target.value) })),
        h('label.row', { style: { gap: '6px' } }, h('input', { type: 'checkbox', checked: f.oed, onchange: (e) => (f.oed = e.target.checked) }), 'दोनों पैरों में सूजन · oedema'),
        h('div.row', { style: { gap: '6px' } }, h('button.btn.hot', { onclick: () => save(f) }, 'Save'), h('button.btn.ghost', { onclick: () => { form = null; render(); } }, 'Back')));
    }
    function save(f) {
      const c = store.childById[f.id], v = c.eval.lastValid || {};
      const m = { t: store.now, weightKg: f.w === '' ? null : +f.w, heightCm: v.heightCm, lying: v.lying, muacMm: f.m === '' ? null : +f.m, oedema: f.oed, danger: [] };
      if (online) { const r = store.capture(c.id, m); msg = `Synced via ${r.adapter.replace('_', ' ')} · ETA ${fmtDuration(Math.max(0, r.receivedAt - store.now))}`; }
      else { queue.push({ childId: c.id, m }); msg = `Saved on the phone at ${new Date(store.now + 5.5 * HOUR).toISOString().slice(11, 16)} — will sync when signal returns.`; }
      form = null; render();
    }
    function flush() {
      const n = queue.length;
      while (queue.length) { const q = queue.shift(); store.capture(q.childId, q.m); }
      if (n) msg = `Signal back: ${n} queued measurement(s) synced. Clocks count from when they were taken.`;
    }
    render();
    ctx.onCleanup(store.on('tick', render));
    ctx.onCleanup(store.on('role', render));
    ctx.onCleanup(store.on('ingested', render));
  },
};
