import { h, mount, s } from '../dom.js';
import { store } from '../store.js';
import { ICONS } from '../icons.js';
import { open } from '../wm.js';
import { tierChip, nameOf, ageLabel, ageAt } from '../common.js';
import { kAnon, ROLES } from '../../engine/access.js';
import { TIER_RANK, TIER_LABEL } from '../../engine/rulepack.js';

const COL = { RED_A: '#c8102e', RED_B: '#f0542d', AMBER: '#f2a20c', WATCH: '#3f7fe0', GREEN: '#1f9d6b' };
const BLOCK_SHAPES = {
  KHU: 'M40,60 L250,30 L300,120 L290,300 L180,360 L60,330 L20,200 Z',
  TON: 'M300,40 L520,50 L560,170 L540,330 L420,370 L300,320 L310,130 Z',
  NOA: 'M560,60 L770,40 L800,190 L780,340 L660,380 L555,330 L575,170 Z',
};

export default {
  id: 'district', title: 'District map — Paschimi Singhbhum', icon: ICONS.map, dock: 'Map', desk: 'Map', size: [1060, 640], key: 'm',
  mount(ctx) {
    let sel = null;
    function summary(awc) {
      const kids = store.sim.district.children.filter((c) => c.awcId === awc.id && c.current);
      const counts = { RED_A: 0, RED_B: 0, AMBER: 0, WATCH: 0, GREEN: 0 };
      for (const c of kids) counts[c.current.tier]++;
      const tt = store.tasks.filter((t) => t.awcId === awc.id && t.ingestedAt <= store.now);
      const tasks = tt.map((t) => store.esc(t));
      const openTiers = tt.filter((t, i) => tasks[i].open).map((t) => t.tier);
      const worst = ['RED_A', 'RED_B', 'AMBER', 'WATCH'].find((t) => openTiers.includes(t)) || 'GREEN';
      return { kids, counts, worst, open: tasks.filter((e) => e.open).length, breached: tasks.filter((e) => e.open && e.breached).length, R: store.sim.feeds[awc.id].R };
    }
    function render() {
      const d = store.sim.district;
      const role = store.role;
      const W = 820, H = 410;
      const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'display:block;max-width:1100px;font-family:var(--font-mono)' });
      svg.append(s('defs', null, s('pattern', { id: 'dots', width: 6, height: 6, patternUnits: 'userSpaceOnUse' }, s('circle', { cx: 1.5, cy: 1.5, r: 1, fill: '#1f1b1d', opacity: 0.35 }))));
      svg.append(s('rect', { width: W, height: H, fill: '#f6a3b7' }));
      for (const b of d.blocks) {
        const inScope = role === 'DPO' || (ROLES[role].scope === 'block' && store.scope === b.id) || d.awcs.some((a) => a.blockId === b.id && store.inScope({ awcId: a.id }));
        svg.append(s('path', { d: BLOCK_SHAPES[b.id], fill: inScope ? '#fff' : '#f9d1dc', stroke: '#1f1b1d', 'stroke-width': 2 }));
        svg.append(s('path', { d: BLOCK_SHAPES[b.id], fill: 'url(#dots)' }));
        const cx = { KHU: 150, TON: 430, NOA: 680 }[b.id];
        svg.append(s('rect', { x: cx - 52, y: 12 + (b.id === 'TON' ? 20 : 30), width: 104, height: 20, fill: '#1f1b1d' }), s('text', { x: cx, y: 26 + (b.id === 'TON' ? 20 : 30), fill: '#fff', 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'VT323', style: 'font-size:17px' }, b.name.toUpperCase()));
      }
      for (const a of d.awcs) {
        const sm = summary(a);
        const bi = d.blocks.findIndex((b) => b.id === a.blockId);
        const local = d.awcs.filter((x) => x.blockId === a.blockId).indexOf(a);
        const bx = [70, 335, 588][bi];
        const x = bx + (local % 4) * 52 + 22 + ((a.x * 1000) % 1) * 14, y = 105 + Math.floor(local / 4) * 92 + ((a.y * 1000) % 1) * 18;
        const r = 7 + Math.sqrt(sm.counts.AMBER + sm.counts.RED_A * 3 + sm.counts.RED_B * 2);
        const g = s('g', { style: 'cursor:pointer' });
        g.append(s('rect', { x: x - r + 2.5, y: y - r + 2.5, width: r * 2, height: r * 2, fill: '#1f1b1d' }));
        g.append(s('rect', { x: x - r, y: y - r, width: r * 2, height: r * 2, fill: COL[sm.worst], stroke: '#1f1b1d', 'stroke-width': a.id === sel ? 3.5 : 1.5 }));
        if (sm.R < store.pack.reliability.cutoff) g.append(s('circle', { cx: x + r, cy: y - r, r: 4, fill: '#fff', stroke: '#1f1b1d', 'stroke-width': 1.5 }));
        if (sm.breached) g.append(s('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: '#fff' }, '!'));
        g.append(s('text', { x, y: y + r + 11, 'text-anchor': 'middle', 'font-size': 8.5, fill: '#1f1b1d' }, a.name));
        g.append(s('title', null, `${a.name} (${a.code}) — RED-A ${sm.counts.RED_A}, RED-B ${sm.counts.RED_B}, AMBER ${sm.counts.AMBER}; R ${sm.R}`));
        g.addEventListener('click', () => { sel = a.id; render(); });
        svg.append(g);
      }
      // legend
      const lg = s('g', { transform: `translate(14, ${H - 34})` });
      lg.append(s('rect', { width: 560, height: 24, fill: '#fff', stroke: '#1f1b1d', 'stroke-width': 1.5 }));
      Object.entries(COL).forEach(([t, c], i) => { lg.append(s('rect', { x: 8 + i * 80, y: 7, width: 10, height: 10, fill: c, stroke: '#1f1b1d' }), s('text', { x: 22 + i * 80, y: 16, 'font-size': 9.5 }, TIER_LABEL[t])); });
      lg.append(s('circle', { cx: 420, cy: 12, r: 4, fill: '#fff', stroke: '#1f1b1d' }), s('text', { x: 428, y: 16, 'font-size': 9.5 }, `R < ${store.pack.reliability.cutoff}  ! overdue`));
      svg.append(s('text', { x: W - 12, y: H - 42, 'text-anchor': 'end', 'font-size': 9.5 }, 'square = worst OPEN task tier · size = caseload'));
      svg.append(lg);

      // block table
      const blockRows = d.blocks.map((b) => {
        const kids = d.children.filter((c) => store.awcById[c.awcId].blockId === b.id && c.current);
        const ct = (t) => kids.filter((c) => c.current.tier === t).length;
        const tasks = store.tasks.filter((t) => store.awcById[t.awcId].blockId === b.id && t.ingestedAt <= store.now).map((t) => store.esc(t));
        return { b, n: kids.length, RA: ct('RED_A'), RB: ct('RED_B'), AM: ct('AMBER'), breach: tasks.filter((e) => e.open && e.breached).length, late: tasks.filter((e) => e.lateArrival).length };
      });
      const k = (n) => kAnon(n, role, store.pack.privacy.kAnonMin);
      const side = sel ? awcPanel(store.awcById[sel]) : h('div.col', { style: { gap: '10px' } },
        h('div.kicker', null, role === 'DPO' ? `District view · counts below ${store.pack.privacy.kAnonMin} suppressed` : 'Block view'),
        h('table.grid', null, h('thead', null, h('tr', null, ['Block', 'Children', 'RED-A', 'RED-B', 'AMBER', 'Overdue'].map((x) => h('th', null, x)))),
          h('tbody', null, blockRows.map((r) => h('tr', null, h('td', null, h('b', null, r.b.name)), h('td.num', null, k(r.n)), h('td.num', null, k(r.RA)), h('td.num', null, k(r.RB)), h('td.num', null, k(r.AM)), h('td.num', null, r.breach))))),
        h('div.small.muted', null, role === 'DPO' ? 'Breach counts are shown exactly (they are about the system, not children). Child counts in small cells are suppressed.' : 'Click an AWC square for its deadline status and data-reliability flags.'));

      mount(ctx.body, h('div.row', { style: { alignItems: 'stretch', gap: 0, height: '100%' } },
        h('div.grow', { style: { padding: '12px', overflow: 'auto' } }, svg),
        h('div', { style: { width: '330px', borderLeft: '2px solid var(--ink)', background: 'var(--white)', padding: '12px', overflow: 'auto' } }, side)));
    }

    function awcPanel(a) {
      const sm = summary(a);
      const canNames = store.inScope({ awcId: a.id }) && (ROLES[store.role].names);
      const list = sm.kids.filter((c) => c.current.tier !== 'GREEN').sort((x, y) => TIER_RANK[x.current.tier] - TIER_RANK[y.current.tier]);
      return h('div.col', { style: { gap: '10px' } },
        h('div.row.between', null, h('div', null, h('div.kicker', null, `AWC ${a.code}`), h('div.h2', null, a.name)), h('button.btn.sm.ghost', { onclick: () => { sel = null; render(); } }, '× back')),
        h('div.small.mono', null, `AWW ${a.aww} · ASHA ${a.asha}`),
        h('div.small.mono', null, `growth day ${a.growthDay} · connectivity ${a.connectivity} · ${store.sectorById[a.sectorId].name}`),
        h('div.row.wrap', { style: { gap: '6px' } }, Object.entries(sm.counts).map(([t, n]) => h('span.tag', { style: { background: COL[t], color: t === 'AMBER' ? '#1f1b1d' : '#fff' } }, `${TIER_LABEL[t]} ${kAnon(n, store.role)}`))),
        h('div.row', { style: { gap: '8px' } }, h('div.card.flat.grow', null, h('div.stat', null, h('div.v', null, sm.R), h('div.l', null, 'reliability R'))), h('div.card.flat.grow', null, h('div.stat', null, h('div.v', null, sm.open), h('div.l', null, `open tasks · ${sm.breached} overdue`)))),
        store.sim.feeds[a.id].flags.map((f) => h('div.callout', null, f.text)),
        h('div.kicker', null, 'Children needing action'),
        store.inScope({ awcId: a.id })
          ? list.slice(0, 30).map((c) => h('div.row.between', { style: { padding: '4px 0', borderBottom: '1px dashed #bbb', cursor: 'pointer' }, onclick: () => { store.selectChild(c.id); open('child', { childId: c.id }); } }, h('span', null, nameOf(c), h('span.muted.small', null, ` · ${ageLabel(ageAt(c, store.now))}`)), tierChip(c.current.tier)))
          : h('div.small.muted', null, 'Outside your scope — counts only (Table 3).'),
        !canNames ? h('div.small.muted', null, 'Names masked for this role; break-glass is available in the child record.') : null);
    }

    render();
    ctx.onCleanup(store.on('role', () => { sel = null; render(); }));
    ctx.onCleanup(store.on('tick', render));
    ctx.onCleanup(store.on('ingested', render));
  },
};
