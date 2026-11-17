import { h, mount } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { fmtDateTime } from '../common.js';

export default {
  id: 'audit', title: 'Audit chain — every access logged', icon: ICONS.log, dock: 'Audit', desk: 'Audit log', size: [920, 560], key: 'a',
  mount(ctx) {
    let result = null, tampered = null;
    function render() {
      const log = store.audit;
      const rows = log.entries.slice().reverse();
      mount(ctx.body,
        h('div.toolbar', null, h('b', null, `${log.entries.length} entries`), h('span.mono.small', null, `head ${log.head.slice(0, 24)}…`), h('div.grow'),
          h('button.btn.sm', { onclick: () => { result = log.verify(); render(); } }, 'Verify chain'),
          tampered ? h('button.btn.sm.ghost', { onclick: () => { log.entries[tampered.seq].subject = tampered.old; tampered = null; result = log.verify(); render(); } }, 'Undo tamper')
            : h('button.btn.sm.ghost', { disabled: log.entries.length < 2, onclick: () => { const e = log.entries[Math.floor(log.entries.length / 2)]; tampered = { seq: e.seq, old: e.subject }; e.subject = 'C00000'; result = log.verify(); render(); } }, 'Tamper with an entry')),
        result ? h('div.callout', { style: { margin: '10px', borderColor: result.ok ? 'var(--green)' : 'var(--red-a)' } }, result.ok ? `✓ Chain intact — ${result.length} entries, each hashing the previous one.` : `✗ Chain broken at entry #${result.brokenAt}. Any edit to past access records is detectable.`) : null,
        h('table.grid', null, h('thead', null, h('tr', null, ['#', 'When (sim)', 'Actor', 'Role', 'Action', 'Subject', 'Detail', 'Hash'].map((x) => h('th', null, x)))),
          h('tbody', null, rows.slice(0, 500).map((e) => h('tr', { style: tampered && e.seq === tampered.seq ? { background: '#ffd3da' } : null },
            h('td.num', null, e.seq), h('td', null, fmtDateTime(e.at)), h('td', null, e.actor), h('td', null, h('span.tag', null, e.role)), h('td', null, h('b', null, e.action)), h('td.mono', null, e.subject), h('td.small', null, e.detail || ''), h('td.mono.small', null, e.hash.slice(0, 10)))))));
    }
    render();
    const off = setInterval(() => { if (!tampered) render(); }, 3000);
    ctx.onCleanup(() => clearInterval(off));
  },
};
