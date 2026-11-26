// "Start here": one app for everyone. Pick who you are; PoshanSetu opens the windows that person needs,
// with the right role, side by side. Presenters get the demo, the story and the jury tour.
import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open, close, closeAll, place } from '../wm.js';

function sideBySide(left, right, lOpts, rOpts, split = 0.5) {
  const d = document.querySelector('.desktop');
  const W = d.clientWidth, H = d.clientHeight, g = 14, lw = Math.round((W - 3 * g) * split);
  open(left, lOpts); place(left, g, g, lw, H - 2 * g);
  if (right) { open(right, rOpts); place(right, 2 * g + lw, g, W - 3 * g - lw, H - 2 * g); }
}

const ROLES_UI = [
  { role: 'AWW', who: 'Anganwadi worker', name: () => store.awcById[store.defaultScope('AWW')]?.aww, does: 'See who to visit today, and add this month’s weights.', go: () => sideBySide('worklist', 'capture', {}, { mode: 'notes' }, 0.46) },
  { role: 'ASHA', who: 'ASHA (Sahiya)', name: () => store.awcById[store.defaultScope('ASHA')]?.asha, does: 'Home visits shared with the Anganwadi worker; report by phone call.', go: () => sideBySide('joint', 'worklist', {}, {}, 0.6) },
  { role: 'MS', who: 'Supervisor (Mukhya Sevika)', name: () => store.sectorById[store.defaultScope('MS')]?.mukhyaSevika, does: 'Which tasks are late, and which centres’ weights look unreliable.', go: () => sideBySide('escalation', 'worklist', {}, {}, 0.55) },
  { role: 'CDPO', who: 'Block officer (CDPO + Medical Officer)', name: () => store.blockById[store.defaultScope('CDPO')]?.cdpo, does: 'The whole block: urgent children, overdue tasks, data quality.', go: () => sideBySide('worklist', 'district', {}, {}, 0.55) },
  { role: 'DPO', who: 'District officer', name: () => 'District Programme Officer', does: 'Totals for the district and the monthly meeting report. No names.', go: () => sideBySide('district', 'report', {}, {}, 0.5) },
];

export default {
  id: 'start', title: 'Start here', icon: ICONS.tour, dock: 'Start here', size: [860, 690], key: 'h',
  mount(ctx) {
    const pick = (r) => () => { close('start'); closeAll(); store.setRole(r.role, store.defaultScope(r.role)); r.go(); };
    const present = (fn) => () => { close('start'); fn(); };
    const card = (r) => h('button', {
      onclick: pick(r),
      style: { display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left', padding: '12px 16px', cursor: 'pointer', background: 'var(--white)', color: 'var(--ink)', border: '2px solid var(--ink)', boxShadow: '4px 4px 0 var(--ink)', fontFamily: 'var(--font-display)' },
    },
    h('span', { style: { fontWeight: 800, fontSize: '19px', letterSpacing: '-0.02em' } }, r.who),
    h('span', { style: { fontSize: '13px', color: 'var(--ink-2)' } }, r.does),
    h('span', { style: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' } }, `opens as ${r.name() || r.who} ▸`));
    mount(ctx.body, h('div', { style: { padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--paper)', minHeight: '100%', boxSizing: 'border-box' } },
      h('div', null,
        h('div', { style: { fontWeight: 800, fontSize: '30px', letterSpacing: '-0.035em', lineHeight: 1 } }, 'Who is using PoshanSetu?'),
        h('div', { style: { fontSize: '14px', color: 'var(--ink-2)', marginTop: '6px' } }, 'It warns Anganwadi workers months before a child becomes severely malnourished. Pick who you are and it opens what you need. You can switch any time from the Role menu.')),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } }, ROLES_UI.map(card)),
      h('div', { style: { borderTop: '2px solid var(--ink)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' } },
        h('div', { style: { fontWeight: 800, fontSize: '19px' } }, 'Presenting PoshanSetu?'),
        h('div.row', { style: { gap: '10px', flexWrap: 'wrap' } },
          h('button.btn.hot', { onclick: present(() => window.psLayout.demoLayout()) }, '▶ Guided tour of every feature'),
          h('button.btn', { onclick: present(() => window.psLayout.storyLayout()) }, '★ Riya’s story'),
          h('button.btn.ghost', { onclick: present(() => window.psLayout.juryLayout()) }, 'Short jury tour'),
          h('button.btn.ghost', { onclick: () => close('start') }, 'Just explore'))),
      h('div.small.mono', { style: { color: 'var(--muted)' } }, 'Keys: h this screen · g tour · s story · j jury · q type notes · c form · ← → move in tours')));
  },
};
