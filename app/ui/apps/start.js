// "Start here": the first thing anyone sees. Four big choices, plain words, no jargon.
import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open, close } from '../wm.js';

export default {
  id: 'start', title: 'Start here', icon: ICONS.tour, dock: 'Start here', size: [780, 600], key: 'h',
  mount(ctx) {
    const go = (fn) => () => { close('start'); fn(); };
    const big = (icon, title, sub, fn, hot) => h('button', {
      onclick: fn,
      style: { display: 'flex', alignItems: 'center', gap: '18px', textAlign: 'left', width: '100%', padding: '16px 20px', cursor: 'pointer',
        background: hot ? 'var(--hot)' : 'var(--white)', color: 'var(--ink)', border: '2px solid var(--ink)', boxShadow: '4px 4px 0 var(--ink)', fontFamily: 'var(--font-display)' },
    },
    h('span', { style: { fontSize: '30px', width: '40px', textAlign: 'center', fontFamily: 'var(--font-mono)' } }, icon),
    h('span', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
      h('span', { style: { fontWeight: 800, fontSize: '21px', letterSpacing: '-0.02em' } }, title),
      h('span', { style: { fontSize: '14px', color: 'var(--ink-2)' } }, sub)));
    mount(ctx.body, h('div', { style: { padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--paper)', minHeight: '100%', boxSizing: 'border-box' } },
      h('div', null,
        h('div', { style: { fontWeight: 800, fontSize: '30px', letterSpacing: '-0.035em', lineHeight: 1 } }, 'What would you like to do?'),
        h('div', { style: { fontSize: '14px', color: 'var(--ink-2)', marginTop: '6px' } }, 'PoshanSetu warns Anganwadi workers months before a child becomes severely malnourished. Pick one:')),
      big('▶', 'Show me everything', 'A guided tour of every feature. Read the words on top, press → for the next step.', go(() => window.psLayout.demoLayout()), true),
      big('✎', 'Add children’s weights', 'Type notes like “Rohan, boy, 1 year, 8 kg, 74 cm”. It tells you what to do for each child.', go(() => { store.setRole('AWW', store.defaultScope('AWW')); open('assist'); })),
      big('☰', 'Who needs a visit today?', 'The Anganwadi worker’s to-do list, most urgent first.', go(() => { store.setRole('AWW', store.defaultScope('AWW')); open('worklist'); })),
      big('★', 'Riya’s story', 'The 10-minute pitch, told through one child and the people around her.', go(() => window.psLayout.storyLayout())),
      h('div.row', { style: { gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' } },
        h('button.btn.sm.ghost', { onclick: go(() => window.psLayout.juryLayout()) }, 'Short jury tour'),
        h('button.btn.sm.ghost', { onclick: go(() => {}) }, 'I’ll explore on my own'),
        h('div.grow'),
        h('span.small.mono', { style: { color: 'var(--muted)' } }, 'Keys: g tour · q add weights · s story · j jury · h this screen'))));
  },
};
