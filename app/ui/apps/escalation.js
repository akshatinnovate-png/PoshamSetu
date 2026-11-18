import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { tierChip, nameOf, fmtDuration, closureDots, HOUR, DAY } from '../common.js';
import { TIER_LABEL } from '../../engine/rulepack.js';

const VIS = ['Named children in own area', 'AWC deadline status; data-reliability flags', 'Block counts; overdue RED/AMBER; transfers; migration inflow', 'District totals and block breach counts (k-anonymous)'];
const span = (w) => (w.hours ? w.hours * HOUR : 0) + (w.days ? w.days * DAY : 0);
const fmtW = (w) => (w.hours ? `${w.hours} h` : `${w.days} d`);

export default {
  id: 'escalation', title: 'Escalation ladder — Table 3, live', icon: ICONS.ladder, dock: 'Ladder', desk: 'Ladder', size: [1100, 660], key: 'e',
  mount(ctx) {
    let showClosed = false;
    function render() {
      const L = store.pack.escalation;
      const items = store.scopedTasks().map((t) => ({ t, e: store.esc(t) })).filter((x) => showClosed || x.e.open);
      const lanes = [0, 1, 2, 3].map((lv) => items.filter((x) => x.e.level === lv).sort((a, b) => a.t.measuredAt - b.t.measuredAt));
      const ladder = h('table.grid', null,
        h('thead', null, h('tr', null, ['Level', 'Role', 'Sees', 'How often', 'Takes over when (from measurement time)'].map((x) => h('th', null, x)))),
        h('tbody', null, L.map((l, i) => h('tr', null, h('td', null, h('b', null, `L${l.level}`)), h('td', null, h('b', null, l.label)), h('td', null, VIS[i]), h('td', null, l.cadence),
          h('td', null, l.when ? h('div.row.wrap', { style: { gap: '4px' } }, Object.entries(l.when).map(([t, w]) => h('span.tag', null, `${TIER_LABEL[t]} > ${fmtW(w)}`))) : h('span.muted', null, 'first responders'))))));

      const card = ({ t, e }) => {
        const c = store.childById[t.childId];
        const last = L[L.length - 1].when[t.tier];
        const total = last ? span(last) * 1.15 : 14 * DAY;
        const W = 220, X = (ms) => 4 + Math.min(1, ms / total) * (W - 8);
        const bar = s('svg', { viewBox: `0 0 ${W} 18`, width: '100%', style: 'display:block' });
        bar.append(s('rect', { x: 4, y: 6, width: W - 8, height: 6, fill: '#fff', stroke: '#1f1b1d' }));
        bar.append(s('rect', { x: 4, y: 6, width: Math.max(0, X((e.open ? store.now : e.closedAt) - t.measuredAt) - 4), height: 6, fill: e.open ? (e.breached ? '#c8102e' : '#f2a20c') : '#1f9d6b' }));
        for (const l of L) if (l.when?.[t.tier]) bar.append(s('line', { x1: X(span(l.when[t.tier])), x2: X(span(l.when[t.tier])), y1: 2, y2: 16, stroke: '#1f1b1d', 'stroke-width': 1.5 }));
        bar.append(s('line', { x1: X(t.ingestedAt - t.measuredAt), x2: X(t.ingestedAt - t.measuredAt), y1: 0, y2: 18, stroke: '#e94fbf', 'stroke-width': 2 }));
        return h('div.card.flat', { style: { padding: '6px 8px', cursor: 'pointer', background: e.lateArrival ? '#ffe9ee' : '' }, onclick: () => open('child', { childId: c.id }) },
          h('div.row.between', null, tierChip(t.tier), h('span.mono.small', null, e.open ? `+${fmtDuration(store.now - t.measuredAt)}` : e.state.toLowerCase())),
          h('div', { style: { fontWeight: 600, margin: '3px 0', fontSize: '12px' } }, nameOf(c), h('span.muted.small', null, ` · ${store.awcById[t.awcId].name}`)),
          bar,
          h('div.row.between', { style: { marginTop: '3px' } }, closureDots(t, e), e.nextEscalationAt ? h('span.mono.small', null, `↑ ${fmtDuration(e.nextEscalationAt - store.now)}`) : null),
          e.lateArrival ? h('div.small', { style: { color: 'var(--red-a)', marginTop: '3px' } }, 'late arrival — pipeline breach') : null);
      };
      mount(ctx.body,
        h('div.toolbar', null, h('b', null, 'Each level acts when the one below misses its deadline.'), h('span.small', null, 'Bars: measured → now; ticks = level thresholds; pink = when PoshanSetu received it.'), h('div.grow'),
          h('label.row', { style: { gap: '6px', fontSize: '12px' } }, h('input', { type: 'checkbox', checked: showClosed, onchange: (e) => { showClosed = e.target.checked; render(); } }), 'include closed'),
          h('button.btn.sm', { onclick: () => store.advance(DAY) }, '+1 day'), h('button.btn.sm', { onclick: () => store.advance(7 * DAY) }, '+7 days')),
        h('div', { style: { padding: '10px 12px' } }, ladder),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', padding: '0 12px 12px' } },
          lanes.map((lane, i) => h('div', { style: { background: i === 0 ? 'var(--white)' : i === 1 ? '#fff4d6' : i === 2 ? '#ffe1e6' : 'var(--ink)', border: '2px solid var(--ink)', minHeight: '200px' } },
            h('div', { style: { padding: '6px 8px', borderBottom: '2px solid var(--ink)', fontFamily: 'var(--font-pixel)', fontSize: '19px', background: i === 3 ? 'var(--hot)' : 'var(--paper-2)' } }, `L${i} · ${L[i].label}  (${lane.length})`),
            h('div.col', { style: { gap: '6px', padding: '6px' } }, store.role === 'DPO' ? h('div', { style: { fontSize: '40px', fontWeight: 800, padding: '10px', color: i === 3 ? '#fff' : '' } }, lane.length, h('div.small', null, 'tasks (district view: counts only)')) : lane.slice(0, 40).map(card), lane.length > 40 ? h('div.small', { style: { color: i === 3 ? '#fff' : '' } }, `+${lane.length - 40} more`) : null)))));
    }
    render();
    ctx.onCleanup(store.on('tick', render));
    ctx.onCleanup(store.on('role', render));
    ctx.onCleanup(store.on('task', render));
    ctx.onCleanup(store.on('ingested', render));
  },
};
