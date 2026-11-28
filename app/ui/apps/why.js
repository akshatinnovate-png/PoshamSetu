// "The missing piece": India already weighs the child and already treats the child.
// The links in between are missing. One switch shows today's broken chain, then PoshanSetu filling it,
// with this district's own numbers flipping from "today" to "with PoshanSetu".
import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';

const LINKS = [
  { k: 'weigh', title: 'Child is weighed', exists: true, today: 'Every month at the Anganwadi, recorded in the Poshan Tracker — about 7.3 crore children.', withPs: 'Unchanged. PoshanSetu uses this data; no new app for the worker.', who: 'Poshan Tracker' },
  { k: 'spot', title: 'Danger spotted early', today: 'Judged one reading at a time. A slow fall never crosses a line, so nobody is told.', withPs: 'Reads the direction of growth: trend rules, WHO growth velocity and a forecast. Riya was flagged 125 days early.', app: 'child', btn: 'See Riya' },
  { k: 'task', title: 'A named person, a deadline', today: 'At best a list — no owner, no deadline, no reason in plain words.', withPs: 'A task for the Anganwadi worker and the ASHA, with the reason in plain words and a clock that starts at the weighing.', app: 'worklist', btn: 'See the to-do list' },
  { k: 'follow', title: 'Someone makes sure it happens', today: 'A missed visit surfaces at the monthly meeting, if at all.', withPs: 'Both workers report (app and phone call). A late task climbs to the supervisor, then the block, then the district.', app: 'escalation', btn: 'See escalation' },
  { k: 'join', title: 'Health data joined safely', today: 'Vaccines and diarrhoea sit in another ministry’s system. Migrant children drop out at the district border.', withPs: 'Small flags shared only with the mother’s consent through ABDM; a signed card follows children to the brick kiln.', app: 'consent', btn: 'See consent' },
  { k: 'treat', title: 'Child is treated', exists: true, today: 'CMAM treatment at the Anganwadi, the nutrition centre, the doctor — but the child arrives late, already severe.', withPs: 'The same treatment, reached months earlier, while recovery is still simple.', who: 'CMAM · NRC · doctor' },
];

export default {
  id: 'why', title: 'The missing piece', icon: ICONS.tour, dock: 'Why', desk: 'Why it matters', size: [1180, 760], key: 'w',
  mount(ctx, opts = {}) {
    let fixed = !!opts.fixed, stepIn = fixed ? LINKS.length : 0, timer = null;
    const m = store.sim.metrics;
    const pct = (x) => `${Math.round(x * 100)}%`;
    const warnDays = Math.round((m.leads || []).reduce((s, x) => s + x, 0));

    function fill() { fixed = true; stepIn = 0; clearInterval(timer); timer = setInterval(() => { stepIn++; render(); if (stepIn >= LINKS.length) clearInterval(timer); }, 380); render(); }
    function reset() { fixed = false; stepIn = 0; clearInterval(timer); render(); }
    ctx.onCleanup(() => clearInterval(timer));

    function node(l, i) {
      const done = fixed && i < stepIn;
      const gap = !l.exists && !done;
      const bg = l.exists ? 'var(--white)' : done ? 'var(--hot)' : '#ffe9ee';
      return h('div', { style: { flex: '1 1 0', minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 12px', background: bg, border: gap ? '3px dashed #c8102e' : '3px solid var(--ink)', boxShadow: gap ? 'none' : '5px 5px 0 var(--ink)', transition: 'background .3s, box-shadow .3s' } },
        h('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', color: gap ? '#c8102e' : 'var(--ink)', fontWeight: 700 } },
          l.exists ? `✓ exists · ${l.who}` : done ? '✓ PoshanSetu' : '✗ missing today'),
        h('div', { style: { fontWeight: 800, fontSize: '19px', letterSpacing: '-0.02em', lineHeight: 1.1 } }, l.title),
        h('div', { style: { fontSize: '13px', lineHeight: 1.4, color: 'var(--ink-2)' } }, done || (l.exists && fixed) ? l.withPs : l.today),
        done && l.app ? h('button.btn.sm', { style: { alignSelf: 'flex-start', marginTop: 'auto' }, onclick: () => openProof(l) }, `${l.btn} ▸`) : null);
    }
    const filled = (j) => LINKS[j].exists || (fixed && j < stepIn);
    function arrow(i) {
      const broken = !(filled(i) && filled(i + 1));
      return h('div', { style: { flex: 'none', alignSelf: 'center', fontSize: '26px', fontWeight: 800, color: broken ? '#c8102e' : 'var(--ink)', width: '24px', textAlign: 'center' } }, broken ? '⋯' : '→');
    }
    function openProof(l) {
      if (l.app === 'child') { store.setRole('AWW', store.defaultScope('AWW')); const id = store.story?.childId; if (id) { store.selectChild(id); open('child', { childId: id }); } return; }
      if (l.app === 'worklist') store.setRole('AWW', store.defaultScope('AWW'));
      if (l.app === 'escalation') store.setRole('MS', store.defaultScope('MS'));
      if (l.app === 'consent') { store.setRole('CDPO', store.defaultScope('CDPO')); open('consent', { childId: store.story?.childId, view: 'hie' }); return; }
      open(l.app);
    }
    const row = (label, today, withPs) => h('tr', null,
      h('td', { style: { padding: '8px 10px', fontWeight: 600 } }, label),
      h('td', { style: { padding: '8px 10px', color: '#c8102e', fontWeight: 700, fontFamily: 'var(--font-mono)' } }, today),
      h('td', { style: { padding: '8px 10px', fontWeight: 800, fontFamily: 'var(--font-mono)', background: fixed ? '#ffe3f5' : 'transparent', transition: 'background .3s' } }, fixed ? withPs : '?'));

    function render() {
      const done = fixed && stepIn >= LINKS.length;
      mount(ctx.body, h('div', { style: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px', background: 'var(--paper)', minHeight: '100%', boxSizing: 'border-box' } },
        h('div.row', { style: { alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' } },
          h('div', { style: { flex: 1, minWidth: '420px' } },
            h('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)' } }, 'Poshan Setu = the nutrition bridge'),
            h('div', { style: { fontWeight: 800, fontSize: '34px', letterSpacing: '-0.04em', lineHeight: 1.02, marginTop: '4px' } },
              'India already weighs the child and already treats the child.', h('br'),
              h('span', { style: { color: fixed ? 'var(--hot)' : '#c8102e' } }, fixed ? 'PoshanSetu is the bridge in between.' : 'The bridge in between is missing.'))),
          fixed ? h('button.btn', { onclick: reset }, '◂ Show today again') : h('button.btn.hot', { onclick: fill, style: { fontSize: '16px', padding: '12px 22px' } }, 'Fill the gaps with PoshanSetu ▸')),
        h('div', { style: { display: 'flex', alignItems: 'stretch', gap: '6px' } }, LINKS.flatMap((l, i) => (i < LINKS.length - 1 ? [node(l, i), arrow(i)] : [node(l, i)]))),
        !fixed ? h('div', { style: { fontSize: '15px', background: '#ffe9ee', borderLeft: '6px solid #c8102e', padding: '10px 14px' } },
          h('b', null, 'Today, a child like Riya falls through the red gaps: '), 'weighed every month, treated once she is severe, and nothing in between notices that she stopped growing.')
          : h('div', { style: { fontSize: '15px', background: '#ffe3f5', borderLeft: '6px solid var(--hot)', padding: '10px 14px' } },
            h('b', null, 'With PoshanSetu, the same weighings reach the same treatment months earlier. '), 'It does not replace the Tracker, the worker or the doctor; it connects them.'),
        h('div', { style: { background: 'var(--white)', border: '2px solid var(--ink)' } },
          h('div', { style: { padding: '8px 12px', borderBottom: '2px solid var(--ink)', fontWeight: 800 } }, `In this district (${m.children.toLocaleString('en-IN')} children, synthetic, one year)`),
          h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' } },
            h('tr', { style: { background: 'var(--paper)' } }, ['', 'Today', 'With PoshanSetu'].map((x) => h('th', { style: { textAlign: 'left', padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: '12px' } }, x))),
            row('Children who became severely malnourished, given a task before reaching the SAM list', `0 of ${m.samKids}`, `${m.flaggedEarlier} of ${m.samKids} (${pct(m.shareEarlier)})`),
            row('How early the task came', 'only after the SAM list', `median ${Math.round(m.leadMedian)} days before it`),
            row('Extra time to act, added up across those children', '0 days', `${warnDays.toLocaleString('en-IN')} child-days`),
            row('Alerts with a named person and a deadline', 'none', 'every alert'),
            row('A missed visit is noticed', 'monthly meeting, if at all', 'automatically, the day it is late'),
            row('Cost per child (pilot year)', '—', '₹330 · reuses existing systems')),
          done ? h('div', { style: { padding: '8px 12px', fontSize: '12px', color: 'var(--muted)' } }, 'Synthetic district matched to NFHS-5 levels. Phase 1 repeats this on real, anonymised Tracker data.') : null)));
    }
    render();
    ctx.setRefresh((o) => { if (o?.fixed) fill(); else if (o?.today) reset(); });
  },
};
