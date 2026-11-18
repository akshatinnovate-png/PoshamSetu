import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { tierChip, nameOf, ageLabel, ageAt, fmtDuration } from '../common.js';
import { evaluate } from '../../engine/triage.js';
import { indices, bivFlags } from '../../engine/growth.js';

export default {
  id: 'capture', title: 'Capture — growth day entry', icon: ICONS.capture, dock: 'Capture', size: [620, 700], key: 'c',
  mount(ctx, opts) {
    let childId = opts.childId || null;
    const f = { weightKg: '', heightCm: '', muacMm: '', oedema: false, danger: [], appetite: '', lying: null };
    let sent = null;
    function prefill() {
      const c = store.childById[childId];
      const v = c?.eval.lastValid;
      if (!v) return;
      f.weightKg = v.weightKg; f.heightCm = v.heightCm; f.muacMm = v.muacMm ?? ''; f.lying = ageAt(c, store.now) < 24; f.oedema = false; f.danger = []; f.appetite = '';
    }
    if (childId) prefill();

    function render() {
      const kids = store.children().sort((a, b) => (a.current ? 0 : 1) - (b.current ? 0 : 1) || a.name.localeCompare(b.name));
      if (!childId && kids.length) { childId = kids[0].id; prefill(); }
      const c = store.childById[childId];
      const num = (k, label, step, unit) => h('label.field', null, h('span', null, label), h('div.row', { style: { gap: '4px' } }, h('input.input', { type: 'number', step, value: f[k], style: { width: '110px' }, oninput: (e) => { f[k] = e.target.value; preview(); } }), h('span.mono.small', null, unit)));
      const chk = (label, on, fn) => h('label.row', { style: { gap: '6px', fontSize: '12px', cursor: 'pointer' } }, h('input', { type: 'checkbox', checked: on, onchange: (e) => { fn(e.target.checked); preview(); } }), label);
      const prev = h('div');
      mount(ctx.body,
        h('div.toolbar', null, h('b', null, 'AWW device'), h('span.small', null, 'Measurements are dated events — syncing never overwrites a record.')),
        h('div.col', { style: { padding: '12px', gap: '12px' } },
          h('label.field', null, h('span', null, 'Child'), h('select.input', { onchange: (e) => { childId = e.target.value; prefill(); sent = null; render(); } }, kids.map((k) => h('option', { value: k.id, selected: k.id === childId }, `${nameOf(k)} · ${ageLabel(ageAt(k, store.now))} · ${k.current?.tier || '—'}`)))),
          c ? h('div.card', null,
            h('div.row', { style: { gap: '14px', flexWrap: 'wrap' } },
              num('weightKg', 'Weight', '0.1', 'kg'), num('heightCm', 'Length/height', '0.1', 'cm'), num('muacMm', 'MUAC (6–59 mo)', '1', 'mm')),
            h('div.row', { style: { gap: '14px', marginTop: '10px', flexWrap: 'wrap' } },
              chk('Bilateral pitting oedema', f.oedema, (v) => (f.oedema = v)),
              chk('Vomits everything', f.danger.includes('VOMITING'), (v) => toggleD('VOMITING', v)),
              chk('Unusually weak/sleepy', f.danger.includes('LETHARGIC'), (v) => toggleD('LETHARGIC', v)),
              chk('Too weak to feed', f.danger.includes('UNABLE_TO_FEED'), (v) => toggleD('UNABLE_TO_FEED', v))),
            h('div.row', { style: { gap: '8px', marginTop: '10px' } }, h('span.small', null, 'Appetite test (RTUF):'),
              h('div.seg', null, [['', 'not done'], ['PASS', 'pass'], ['FAIL', 'fail']].map(([k, l]) => h('button', { class: f.appetite === k ? 'on' : '', onclick: () => { f.appetite = k; render(); } }, l))))) : null,
          prev,
          c ? h('div.row', { style: { gap: '8px' } },
            h('button.btn.hot', { onclick: submit }, 'Save & sync'),
            h('button.btn.ghost', { onclick: () => open('child', { childId }) }, 'Open record'),
            h('button.btn.ghost', { onclick: () => { f.weightKg = String(Number(f.weightKg) * 10); preview(); render(); } }, 'Demo: decimal slip')) : null,
          sent ? h('div.callout', null, h('b', null, `Queued on ${sent.adapter.replace('_', ' ')}. `), `ETA ${fmtDuration(Math.max(0, sent.receivedAt - store.now))}. The deadline clock already started at ${new Date(sent.event.t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} (measurement time). `, sent.routes.length > 1 ? 'RED sign: also sent by SMS flash.' : '', h('br'), h('button.btn.sm', { style: { marginTop: '6px' }, onclick: () => store.advance(Math.max(0, sent.receivedAt - store.now) + 60000) }, 'Fast-forward until it lands')) : null));
      preview();

      function preview() {
        if (!c) return;
        const m = mObj();
        const ageDays = (store.now - c.dob) / 86400000;
        const ix = indices(c.sex, ageDays, m);
        const biv = bivFlags(ix);
        const dry = evaluate(c, [...c.events, { id: 'preview', t: store.now, ...m }], c.signals, store.pack, { feedR: store.sim.feeds[c.awcId].R }).current;
        const hints = [];
        if (biv.length) hints.push(`Implausible ${biv.join(', ').toUpperCase()} — ${m.weightKg > 30 ? 'did you mean ' + (m.weightKg / 10).toFixed(1) + ' kg?' : 'check the scale and re-enter.'}`);
        const last = c.eval.lastValid;
        if (last && m.heightCm && m.heightCm < last.heightCm - 1.5) hints.push(`Height ${m.heightCm} cm is ${(last.heightCm - m.heightCm).toFixed(1)} cm below last visit — children do not shrink; re-measure.`);
        if (last && m.weightKg && last.weightKg === Number(m.weightKg)) hints.push('Same weight as last visit — fine once, but repeated identical weights lower the AWC reliability score.');
        mount(prev, h('div.card' + (dry.tier.startsWith('RED') ? '.pinkc' : ''), null,
          h('div.row.between', null, h('div.kicker', null, 'Before you save — what the rules will say'), tierChip(dry.tier)),
          h('div.row.mono.small', { style: { gap: '14px', margin: '6px 0' } }, h('span', null, `WAZ ${ix.waz ?? '—'}`), h('span', null, `HAZ ${ix.haz ?? '—'}`), h('span', null, `WHZ ${ix.whz ?? '—'}`)),
          dry.reasons.slice(0, 4).map((r) => h('div.reason', null, tierChip(r.tier), h('div', null, r.text), h('div.rule', null, r.rule))),
          hints.map((x) => h('div.callout', { style: { marginTop: '6px', borderColor: 'var(--amber)' } }, x))));
      }
    }
    function toggleD(k, on) { f.danger = on ? [...new Set([...f.danger, k])] : f.danger.filter((x) => x !== k); }
    function mObj() {
      const c = store.childById[childId];
      return { weightKg: f.weightKg === '' ? null : Number(f.weightKg), heightCm: f.heightCm === '' ? null : Number(f.heightCm), muacMm: f.muacMm === '' ? null : Number(f.muacMm), lying: ageAt(c, store.now) < 24, oedema: f.oedema, danger: f.danger, appetite: f.appetite || null };
    }
    function submit() { sent = store.capture(childId, mObj()); render(); }

    render();
    ctx.setRefresh((o) => { if (o?.childId) { childId = o.childId; prefill(); sent = null; } render(); });
    ctx.onCleanup(store.on('role', () => { childId = null; render(); }));
    ctx.onCleanup(store.on('tick', () => { if (sent) render(); }));
  },
};
